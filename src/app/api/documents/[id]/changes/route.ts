/**
 * GET /api/documents/:id/changes
 *
 * Lists all pending CriticMarkup change regions in the document.
 * Only the owner can access this endpoint.
 *
 * Response:
 * {
 *   changes: Array<{
 *     id: string,
 *     type: 'addition' | 'deletion' | 'substitution',
 *     original: string | null,
 *     replacement: string | null,
 *     position: {
 *       startOffset: number,
 *       endOffset: number,
 *       startLine: number,
 *       endLine: number
 *     }
 *   }>,
 *   hasUnresolvedChanges: boolean
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { requireOwner, createErrorResponse, AuthErrors } from '@/lib/auth'
import { parseChanges } from '@/lib/criticmarkup'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Only owner can view changes
    await requireOwner(request, id)

    // Fetch document content
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        contentRaw: true,
      },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Parse the document for CriticMarkup changes
    const result = parseChanges(document.contentRaw)

    // Return changes in API-friendly format
    return NextResponse.json({
      changes: result.changes.map((change) => ({
        id: change.id,
        type: change.type,
        original: change.original,
        replacement: change.replacement,
        position: change.position,
      })),
      hasUnresolvedChanges: result.hasUnresolvedChanges,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
