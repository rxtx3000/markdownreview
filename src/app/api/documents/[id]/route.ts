import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  authenticate,
  requireOwner,
  requirePermission,
  createErrorResponse,
  AuthErrors,
  UserRole,
  ReviewerPermission,
} from '@/lib/auth'
import { checkLock, isLockExpired } from '@/lib/locking'
import { hasUnresolvedChanges } from '@/lib/criticmarkup'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/documents/:id
 * Retrieves document metadata and content.
 * Requires Owner or Reviewer token.
 *
 * Response:
 * {
 *   id: string,
 *   title: string,
 *   content: string,
 *   status: 'draft' | 'in_review' | 'finalized',
 *   lockedBy: string | null,
 *   createdAt: string,
 *   updatedAt: string,
 *   role: 'OWNER' | 'REVIEWER',
 *   permissions?: 'view_only' | 'suggest_changes'
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Authenticate user (owner or reviewer)
    const auth = await authenticate(request, id)

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        contentRaw: true,
        status: true,
        lockedBy: true,
        lockExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Check if document is in draft and user is a reviewer (not allowed)
    if (document.status === 'draft' && auth.role === UserRole.REVIEWER) {
      throw AuthErrors.documentNotInReview()
    }

    // Check if lock has expired and clear it
    if (document.lockExpiresAt && isLockExpired(document.lockExpiresAt)) {
      await prisma.document.update({
        where: { id },
        data: { lockedBy: null, lockExpiresAt: null },
      })
      document.lockedBy = null
    }

    // Build response based on role
    const response: Record<string, unknown> = {
      id: document.id,
      title: document.title,
      content: document.contentRaw,
      status: document.status,
      lockedBy: document.lockedBy,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      role: auth.role,
    }

    // Add reviewer-specific info
    if (auth.role === UserRole.REVIEWER && auth.reviewerInfo) {
      response.permissions = auth.reviewerInfo.permission
      response.reviewerName = auth.reviewerInfo.reviewerName
    }

    return NextResponse.json(response)
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * PATCH /api/documents/:id
 * Updates document content, title, or status.
 * - Owner: can update title, content, and status
 * - Reviewer (suggest_changes): can update content only
 *
 * Request Body (all optional):
 * {
 *   title?: string,
 *   content?: string,
 *   status?: 'draft' | 'in_review' | 'finalized'
 * }
 *
 * Response:
 * {
 *   id: string,
 *   title: string,
 *   content: string,
 *   status: string,
 *   updatedAt: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Authenticate user (owner or reviewer)
    const auth = await authenticate(request, id)

    // Determine if this is a reviewer with suggest_changes permission
    const isReviewer = auth.role === UserRole.REVIEWER
    if (isReviewer) {
      requirePermission(auth, ReviewerPermission.SUGGEST_CHANGES)
    }

    // Fetch current document state
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        contentRaw: true,
        status: true,
        lockedBy: true,
        lockExpiresAt: true,
      },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Check if document is finalized
    if (document.status === 'finalized') {
      throw AuthErrors.documentFinalized()
    }

    // Reviewers can only edit documents that are in_review
    if (isReviewer && document.status !== 'in_review') {
      throw AuthErrors.documentNotInReview()
    }

    // Parse request body
    const body = await request.json()

    // Reviewers can only update content, not title or status
    if (isReviewer && (body.title !== undefined || body.status !== undefined)) {
      return NextResponse.json(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSION',
            message: 'Reviewers can only update document content.',
          },
        },
        { status: 403 }
      )
    }

    // Check if document is locked by another user
    // Use reviewer name or 'Owner' for owner
    const userName = isReviewer && auth.reviewerInfo ? auth.reviewerInfo.reviewerName : 'Owner'
    await checkLock(id, userName)

    // Validate title if provided
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Title must be a non-empty string.',
            },
          },
          { status: 400 }
        )
      }
    }

    // Validate content if provided
    if (body.content !== undefined && typeof body.content !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Content must be a string.',
          },
        },
        { status: 400 }
      )
    }

    // Block direct content edits by OWNER if there are unresolved CriticMarkup changes
    // Owner must accept or reject all pending changes before making direct edits
    // Reviewers are allowed to add CriticMarkup changes
    if (!isReviewer && body.content !== undefined && hasUnresolvedChanges(document.contentRaw)) {
      throw AuthErrors.pendingChanges()
    }

    // Validate status if provided
    const validStatuses = ['draft', 'in_review', 'finalized']
    if (body.status !== undefined && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Status must be one of: ${validStatuses.join(', ')}.`,
          },
        },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      updateData.title = body.title.trim()
    }

    if (body.content !== undefined) {
      updateData.contentRaw = body.content
    }

    if (body.status !== undefined) {
      updateData.status = body.status
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one field (title, content, status) must be provided.',
          },
        },
        { status: 400 }
      )
    }

    // If content was modified, create a version snapshot
    if (body.content !== undefined) {
      const latestVersion = await prisma.documentVersion.findFirst({
        where: { docId: id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      })
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1

      const [updatedDocument] = await prisma.$transaction([
        prisma.document.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            title: true,
            contentRaw: true,
            status: true,
            updatedAt: true,
          },
        }),
        prisma.documentVersion.create({
          data: {
            docId: id,
            versionNumber,
            contentSnapshot: body.content,
            changeSummary: 'Manual save',
            createdBy: userName, // Reused from line 182
          },
          select: { id: true },
        }),
      ])

      return NextResponse.json({
        id: updatedDocument.id,
        title: updatedDocument.title,
        content: updatedDocument.contentRaw,
        status: updatedDocument.status,
        updatedAt: updatedDocument.updatedAt.toISOString(),
      })
    }

    // Update document without version snapshot (e.g. status or title only)
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        contentRaw: true,
        status: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      id: updatedDocument.id,
      title: updatedDocument.title,
      content: updatedDocument.contentRaw,
      status: updatedDocument.status,
      updatedAt: updatedDocument.updatedAt.toISOString(),
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * DELETE /api/documents/:id
 * Permanently deletes the document and all related data (shares, comments, versions).
 * Requires Owner token.
 *
 * Response:
 * {
 *   message: string
 * }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Only owner can delete documents
    await requireOwner(request, id)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Delete document (cascades to shares, comments, versions due to Prisma schema)
    await prisma.document.delete({
      where: { id },
    })

    return NextResponse.json({
      message: 'Document deleted successfully.',
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
