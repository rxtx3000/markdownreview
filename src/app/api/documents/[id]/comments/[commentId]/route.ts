import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticate, createErrorResponse, AuthErrors, UserRole } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>
}

/**
 * PATCH /api/documents/:id/comments/:commentId
 * Resolves a comment (sets status to 'resolved').
 * Requires Owner or Comment author token.
 *
 * Request Body:
 * {
 *   status: 'resolved'
 * }
 *
 * Response:
 * {
 *   id: string,
 *   authorName: string,
 *   textAnchor: object,
 *   commentBody: string,
 *   status: 'resolved',
 *   resolvedAt: string,
 *   createdAt: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId, commentId } = await params

    // Authenticate user (owner or reviewer)
    const auth = await authenticate(request, docId)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, status: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Check if reviewer can access draft document
    if (document.status === 'draft' && auth.role === UserRole.REVIEWER) {
      throw AuthErrors.documentNotInReview()
    }

    // Check if comment exists and belongs to this document
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        docId: docId,
      },
      select: {
        id: true,
        shareId: true,
        status: true,
      },
    })

    if (!existingComment) {
      return NextResponse.json(
        {
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'The requested comment does not exist.',
          },
        },
        { status: 404 }
      )
    }

    // Check authorization: Owner or comment author can resolve
    if (auth.role === UserRole.REVIEWER) {
      // Reviewer can only resolve their own comments
      if (existingComment.shareId !== auth.reviewerInfo?.shareId) {
        throw AuthErrors.insufficientPermission()
      }
    }
    // Owner can resolve any comment

    // Parse request body
    const body = await request.json()

    // Validate status - only 'resolved' is allowed for PATCH
    if (body.status !== 'resolved') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Only status: "resolved" is allowed.',
          },
        },
        { status: 400 }
      )
    }

    // Check if already resolved
    if (existingComment.status === 'resolved') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Comment is already resolved.',
          },
        },
        { status: 400 }
      )
    }

    // Update comment to resolved
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
      select: {
        id: true,
        authorName: true,
        textAnchor: true,
        commentBody: true,
        status: true,
        resolvedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      id: updatedComment.id,
      authorName: updatedComment.authorName,
      textAnchor: updatedComment.textAnchor,
      commentBody: updatedComment.commentBody,
      status: updatedComment.status,
      resolvedAt: updatedComment.resolvedAt?.toISOString() ?? null,
      createdAt: updatedComment.createdAt.toISOString(),
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
