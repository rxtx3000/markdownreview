import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { generateToken } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * POST /api/documents
 * Creates a new document and returns the Owner URL with raw token.
 * No authentication required (anyone can create a document).
 *
 * Request Body:
 * {
 *   title: string (required),
 *   content?: string (optional, defaults to empty)
 * }
 *
 * Response:
 * {
 *   id: string,
 *   title: string,
 *   status: 'draft',
 *   ownerUrl: string,
 *   createdAt: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Title is required and must be a non-empty string.',
          },
        },
        { status: 400 }
      )
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

    // Generate owner token
    const { raw: rawToken, hash: tokenHash } = generateToken()

    // Create document
    const document = await prisma.document.create({
      data: {
        title: body.title.trim(),
        contentRaw: body.content || '',
        ownerTokenHash: tokenHash,
        status: 'draft',
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    })

    // Build owner URL
    // Get base URL from request headers or use a default
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const ownerUrl = `${baseUrl}/edit/${document.id}?auth=${rawToken}`

    return NextResponse.json(
      {
        id: document.id,
        title: document.title,
        status: document.status,
        ownerUrl,
        createdAt: document.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the document.',
        },
      },
      { status: 500 }
    )
  }
}
