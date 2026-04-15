import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, createErrorResponse, AuthErrors } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string; shareId: string }>
}

/**
 * PATCH /api/documents/:id/shares/:shareId
 * Updates a share link (e.g., revoke by setting is_active: false).
 * Requires Owner token.
 *
 * Request Body (all optional):
 * {
 *   is_active?: boolean,
 *   permissions?: 'view_only' | 'suggest_changes',
 *   expires_at?: string | null (ISO 8601 date, null to remove expiration)
 * }
 *
 * Response:
 * {
 *   id: string,
 *   reviewerName: string,
 *   permissions: string,
 *   isActive: boolean,
 *   expiresAt: string | null,
 *   updatedAt: string
 * }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId, shareId } = await params

    // Only owner can update shares
    await requireOwner(request, docId)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Check if share exists and belongs to this document
    const existingShare = await prisma.share.findFirst({
      where: {
        id: shareId,
        docId: docId,
      },
      select: { id: true },
    })

    if (!existingShare) {
      return NextResponse.json(
        {
          error: {
            code: 'SHARE_NOT_FOUND',
            message: 'The requested share does not exist.',
          },
        },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Build update data
    const updateData: Record<string, unknown> = {}

    // Validate and add is_active if provided
    if (body.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'is_active must be a boolean.',
            },
          },
          { status: 400 }
        )
      }
      updateData.isActive = body.is_active
    }

    // Validate and add permissions if provided
    const validPermissions = ['view_only', 'suggest_changes']
    if (body.permissions !== undefined) {
      if (!validPermissions.includes(body.permissions)) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `permissions must be one of: ${validPermissions.join(', ')}.`,
            },
          },
          { status: 400 }
        )
      }
      updateData.permissions = body.permissions
    }

    // Validate and add expires_at if provided
    if (body.expires_at !== undefined) {
      if (body.expires_at === null) {
        updateData.expiresAt = null
      } else {
        const parsedDate = new Date(body.expires_at)
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'expires_at must be a valid ISO 8601 date string or null.',
              },
            },
            { status: 400 }
          )
        }
        if (parsedDate <= new Date()) {
          return NextResponse.json(
            {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'expires_at must be a future date.',
              },
            },
            { status: 400 }
          )
        }
        updateData.expiresAt = parsedDate
      }
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one field (is_active, permissions, expires_at) must be provided.',
          },
        },
        { status: 400 }
      )
    }

    // Update share
    const updatedShare = await prisma.share.update({
      where: { id: shareId },
      data: updateData,
      select: {
        id: true,
        reviewerName: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      id: updatedShare.id,
      reviewerName: updatedShare.reviewerName,
      permissions: updatedShare.permissions,
      isActive: updatedShare.isActive,
      expiresAt: updatedShare.expiresAt?.toISOString() ?? null,
      createdAt: updatedShare.createdAt.toISOString(),
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
