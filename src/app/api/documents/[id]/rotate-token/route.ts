import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, createErrorResponse, generateToken, AuthErrors } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/documents/:id/rotate-token
 * Regenerates the owner token, invalidating the previous one.
 * Returns the new Owner URL.
 * Requires Owner token (the current one, which will be invalidated).
 *
 * Response:
 * {
 *   message: string,
 *   ownerUrl: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: docId } = await params

    // Verify current owner token first
    await requireOwner(request, docId)

    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Generate new owner token
    const { raw: newRawToken, hash: newTokenHash } = generateToken()

    // Update the document with the new token hash
    await prisma.document.update({
      where: { id: docId },
      data: {
        ownerTokenHash: newTokenHash,
      },
    })

    // Build new owner URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const ownerUrl = `${baseUrl}/edit/${docId}?auth=${newRawToken}`

    return NextResponse.json({
      message: 'Owner token has been rotated successfully. The previous token is now invalid.',
      ownerUrl,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
