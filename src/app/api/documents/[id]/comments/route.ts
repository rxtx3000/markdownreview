import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { authenticate, createErrorResponse, AuthErrors, UserRole } from '@/lib/auth'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Validates the text_anchor JSON structure.
 * Required fields: startLine, endLine, startChar, endChar (all integers)
 */
function validateTextAnchor(anchor: unknown): { valid: boolean; error?: string } {
  if (typeof anchor !== 'object' || anchor === null) {
    return { valid: false, error: 'text_anchor must be an object.' }
  }

  const obj = anchor as Record<string, unknown>

  const requiredFields = ['startLine', 'endLine', 'startChar', 'endChar']
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return { valid: false, error: `text_anchor.${field} is required.` }
    }
    if (typeof obj[field] !== 'number' || !Number.isInteger(obj[field])) {
      return { valid: false, error: `text_anchor.${field} must be an integer.` }
    }
    if ((obj[field] as number) < 0) {
      return { valid: false, error: `text_anchor.${field} must be non-negative.` }
    }
  }

  // Validate logical constraints
  const { startLine, endLine, startChar, endChar } = obj as {
    startLine: number
    endLine: number
    startChar: number
    endChar: number
  }

  if (startLine > endLine) {
    return { valid: false, error: 'text_anchor.startLine must be <= endLine.' }
  }

  if (startLine === endLine && startChar > endChar) {
    return {
      valid: false,
      error: 'text_anchor.startChar must be <= endChar when on the same line.',
    }
  }

  return { valid: true }
}

/**
 * GET /api/documents/:id/comments
 * Lists all comments for a document.
 * Requires Owner or Reviewer token.
 *
 * Query Parameters:
 * - status: 'open' | 'resolved' (optional filter)
 *
 * Response:
 * {
 *   comments: [
 *     {
 *       id: string,
 *       authorName: string,
 *       textAnchor: object,
 *       commentBody: string,
 *       status: 'open' | 'resolved',
 *       resolvedAt: string | null,
 *       createdAt: string
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId } = await params

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
      throw AuthErrors.insufficientPermission()
    }

    // Parse status filter from query params
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Validate status filter if provided
    if (statusFilter && !['open', 'resolved'].includes(statusFilter)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status filter must be either "open" or "resolved".',
          },
        },
        { status: 400 }
      )
    }

    // Build query conditions
    const whereClause: Record<string, unknown> = { docId }
    if (statusFilter) {
      whereClause.status = statusFilter
    }

    // Fetch comments
    const comments = await prisma.comment.findMany({
      where: whereClause,
      select: {
        id: true,
        authorName: true,
        textAnchor: true,
        commentBody: true,
        status: true,
        resolvedAt: true,
        createdAt: true,
        shareId: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Map comments to response format
    const mappedComments = comments.map((comment: (typeof comments)[number]) => ({
      id: comment.id,
      authorName: comment.authorName,
      textAnchor: comment.textAnchor,
      commentBody: comment.commentBody,
      status: comment.status,
      resolvedAt: comment.resolvedAt?.toISOString() ?? null,
      createdAt: comment.createdAt.toISOString(),
    }))

    return NextResponse.json({
      comments: mappedComments,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * POST /api/documents/:id/comments
 * Creates a new comment on the document.
 * Requires Owner or Reviewer token.
 * Note: Even view_only reviewers can create comments (per SPEC.md §2B).
 *
 * Request Body:
 * {
 *   text_anchor: {
 *     startLine: number,
 *     endLine: number,
 *     startChar: number,
 *     endChar: number
 *   },
 *   comment_body: string
 * }
 *
 * Response (201 Created):
 * {
 *   id: string,
 *   authorName: string,
 *   textAnchor: object,
 *   commentBody: string,
 *   status: 'open',
 *   createdAt: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId } = await params

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
      throw AuthErrors.insufficientPermission()
    }

    // Check if document is finalized
    if (document.status === 'finalized') {
      throw AuthErrors.documentFinalized()
    }

    // Parse request body
    const body = await request.json()

    // Validate text_anchor
    if (!body.text_anchor) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'text_anchor is required.',
          },
        },
        { status: 400 }
      )
    }

    const anchorValidation = validateTextAnchor(body.text_anchor)
    if (!anchorValidation.valid) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: anchorValidation.error,
          },
        },
        { status: 400 }
      )
    }

    // Validate comment_body
    if (
      !body.comment_body ||
      typeof body.comment_body !== 'string' ||
      body.comment_body.trim() === ''
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'comment_body is required and must be a non-empty string.',
          },
        },
        { status: 400 }
      )
    }

    // Determine author name and share ID
    let authorName: string
    let shareId: string | null = null

    if (auth.role === UserRole.OWNER) {
      authorName = 'Owner'
    } else if (auth.reviewerInfo) {
      authorName = auth.reviewerInfo.reviewerName
      shareId = auth.reviewerInfo.shareId
    } else {
      throw AuthErrors.invalidToken()
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        docId,
        shareId,
        authorName,
        textAnchor: body.text_anchor,
        commentBody: body.comment_body.trim(),
        status: 'open',
      },
      select: {
        id: true,
        authorName: true,
        textAnchor: true,
        commentBody: true,
        status: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        id: comment.id,
        authorName: comment.authorName,
        textAnchor: comment.textAnchor,
        commentBody: comment.commentBody,
        status: comment.status,
        createdAt: comment.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error)
  }
}
