import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { authenticate, createErrorResponse } from '@/lib/auth'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string; version_number: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, version_number } = await params
    await authenticate(request, id)

    const versionNumber = parseInt(version_number, 10)
    if (isNaN(versionNumber)) {
      return NextResponse.json(
        { error: { code: 'INVALID_VERSION', message: 'Version number must be an integer.' } },
        { status: 400 }
      )
    }

    const version = await prisma.documentVersion.findFirst({
      where: { docId: id, versionNumber },
    })

    if (!version) {
      return NextResponse.json(
        { error: { code: 'VERSION_NOT_FOUND', message: 'Version not found.' } },
        { status: 404 }
      )
    }

    // active comments: created at or before version created AND (resolved null or resolved after version created)
    const activeComments = await prisma.comment.findMany({
      where: {
        docId: id,
        createdAt: { lte: version.createdAt },
        OR: [{ resolvedAt: null }, { resolvedAt: { gt: version.createdAt } }],
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      version,
      comments: activeComments,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
