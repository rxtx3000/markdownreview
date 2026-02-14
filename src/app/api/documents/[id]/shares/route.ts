import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { requireOwner, createErrorResponse, generateToken, AuthErrors } from '@/lib/auth'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/documents/:id/shares
 * Generates a new reviewer link with a hashed token.
 * Requires Owner token.
 *
 * Request Body:
 * {
 *   reviewer_name: string (required),
 *   permissions?: 'view_only' | 'suggest_changes' (default: 'suggest_changes'),
 *   expires_at?: string (ISO 8601 date, optional)
 * }
 *
 * Response (201 Created):
 * {
 *   id: string,
 *   reviewerName: string,
 *   permissions: string,
 *   isActive: boolean,
 *   expiresAt: string | null,
 *   reviewerUrl: string,
 *   createdAt: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId } = await params

    // Only owner can create shares
    await requireOwner(request, docId)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, status: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Parse request body
    const body = await request.json()

    // Validate reviewer_name
    if (
      !body.reviewer_name ||
      typeof body.reviewer_name !== 'string' ||
      body.reviewer_name.trim() === ''
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reviewer_name is required and must be a non-empty string.',
          },
        },
        { status: 400 }
      )
    }

    // Validate permissions if provided
    const validPermissions = ['view_only', 'suggest_changes']
    if (body.permissions !== undefined && !validPermissions.includes(body.permissions)) {
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

    // Validate expires_at if provided
    let expiresAt: Date | null = null
    if (body.expires_at !== undefined) {
      const parsedDate = new Date(body.expires_at)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'expires_at must be a valid ISO 8601 date string.',
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
      expiresAt = parsedDate
    }

    // Generate reviewer token
    const { raw: rawToken, hash: tokenHash } = generateToken()

    // Create share record
    const share = await prisma.share.create({
      data: {
        docId,
        reviewerName: body.reviewer_name.trim(),
        inviteTokenHash: tokenHash,
        permissions: body.permissions || 'suggest_changes',
        expiresAt,
      },
      select: {
        id: true,
        reviewerName: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Build reviewer URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const reviewerUrl = `${baseUrl}/review/${docId}?invite=${rawToken}`

    return NextResponse.json(
      {
        id: share.id,
        reviewerName: share.reviewerName,
        permissions: share.permissions,
        isActive: share.isActive,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        reviewerUrl,
        createdAt: share.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * GET /api/documents/:id/shares
 * Lists all share links for the document.
 * Requires Owner token.
 *
 * Response:
 * {
 *   shares: [
 *     {
 *       id: string,
 *       reviewerName: string,
 *       permissions: string,
 *       isActive: boolean,
 *       expiresAt: string | null,
 *       createdAt: string
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId } = await params

    // Only owner can list shares
    await requireOwner(request, docId)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Fetch all shares for this document
    const shares = await prisma.share.findMany({
      where: { docId },
      select: {
        id: true,
        reviewerName: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map shares to response format, adding computed expired status
    const now = new Date()
    const sharesWithStatus = shares.map((share: (typeof shares)[number]) => ({
      id: share.id,
      reviewerName: share.reviewerName,
      permissions: share.permissions,
      isActive: share.isActive,
      isExpired: share.expiresAt ? new Date(share.expiresAt) < now : false,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    }))

    return NextResponse.json({
      shares: sharesWithStatus,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
