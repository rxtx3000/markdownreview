import { prisma } from '@/lib/prisma'

/**
 * Automatically determines the next version number and creates a DocumentVersion snapshot.
 */
export async function createNextVersionSnapshot(
  docId: string,
  contentSnapshot: string,
  changeSummary: string | null,
  createdBy: string
) {
  // Find highest current version number
  const latestVersion = await prisma.documentVersion.findFirst({
    where: { docId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  })

  const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1

  return await prisma.documentVersion.create({
    data: {
      docId,
      versionNumber,
      contentSnapshot,
      changeSummary,
      createdBy,
    },
    select: {
      id: true,
      versionNumber: true,
      createdAt: true,
    },
  })
}
