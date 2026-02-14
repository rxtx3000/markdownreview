/**
 * POST /api/documents/:id/changes/reject
 *
 * Rejects specified CriticMarkup changes (removes markup, keeps original text).
 * Creates a DocumentVersion snapshot after processing.
 * Only the owner can access this endpoint.
 *
 * Request Body:
 * {
 *   change_ids?: string[],   // Specific change IDs to reject
 *   all?: boolean            // Reject all changes
 * }
 *
 * Response:
 * {
 *   content: string,
 *   changesProcessed: number,
 *   summary: string,
 *   versionId: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { requireOwner, createErrorResponse, AuthErrors } from '@/lib/auth'
import { rejectChanges, parseChanges } from '@/lib/criticmarkup'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Only owner can reject changes
    await requireOwner(request, id)

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        contentRaw: true,
        status: true,
      },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Cannot modify finalized documents
    if (document.status === 'finalized') {
      throw AuthErrors.documentFinalized()
    }

    // Parse request body
    const body = await request.json()
    const { change_ids, all } = body

    // Validate request - must specify either change_ids or all
    if (!all && (!change_ids || !Array.isArray(change_ids) || change_ids.length === 0)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Must specify either change_ids array or all: true.',
          },
        },
        { status: 400 }
      )
    }

    // Check if there are any changes to process
    const currentChanges = parseChanges(document.contentRaw)
    if (!currentChanges.hasUnresolvedChanges) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No pending changes to reject.',
          },
        },
        { status: 400 }
      )
    }

    // Reject the changes
    const result = rejectChanges(document.contentRaw, {
      all: !!all,
      changeIds: change_ids,
    })

    // If no changes were processed (e.g., invalid IDs), return error
    if (result.changesProcessed === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No matching changes found to reject.',
          },
        },
        { status: 400 }
      )
    }

    // Update document and create version snapshot in a transaction
    const [updatedDocument, version] = await prisma.$transaction([
      prisma.document.update({
        where: { id },
        data: { contentRaw: result.content },
        select: {
          id: true,
          contentRaw: true,
          updatedAt: true,
        },
      }),
      prisma.documentVersion.create({
        data: {
          docId: id,
          contentSnapshot: result.content,
          changeSummary: result.summary,
          createdBy: 'Owner',
        },
        select: {
          id: true,
        },
      }),
    ])

    return NextResponse.json({
      content: updatedDocument.contentRaw,
      changesProcessed: result.changesProcessed,
      summary: result.summary,
      versionId: version.id,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
