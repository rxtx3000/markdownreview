import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticate, createErrorResponse } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await authenticate(request, id)

    const versions = await prisma.documentVersion.findMany({
      where: { docId: id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        changeSummary: true,
        createdBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ versions })
  } catch (error) {
    return createErrorResponse(error)
  }
}
