/**
 * Document Locking Module
 *
 * This module provides pessimistic locking for document editing.
 * It implements the concurrency model from SPEC.md §2D.
 *
 * Key Features:
 * - Document-level locks to prevent concurrent editing
 * - Automatic lock expiration after 5 minutes of inactivity
 * - Lock acquisition and release utilities
 */

import { PrismaClient } from '@/generated/prisma/client'
import { AuthErrors } from '@/lib/auth'
import { isLockExpired, LOCK_TIMEOUT_MS, LockResult } from './utils'

// Re-export utilities for external use
export { isLockExpired, LOCK_TIMEOUT_MS, type LockResult } from './utils'

const prisma = new PrismaClient()

/**
 * Acquires a document-level lock for editing.
 *
 * If the document is already locked by another user and the lock hasn't expired,
 * this will throw a DOCUMENT_LOCKED error.
 *
 * If the document is locked by the same user, the lock is refreshed.
 *
 * If the lock has expired, it will be acquired by the new user.
 *
 * @param docId - The document ID to lock
 * @param userName - The name/ID of the user acquiring the lock
 * @returns The lock result with the new lock state
 * @throws AuthError with DOCUMENT_LOCKED if document is locked by another user
 */
export async function acquireLock(docId: string, userName: string): Promise<LockResult> {
  // Fetch current document state
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      lockedBy: true,
      lockExpiresAt: true,
    },
  })

  if (!document) {
    throw AuthErrors.documentNotFound()
  }

  // Check if document is currently locked by another user
  if (document.lockedBy && !isLockExpired(document.lockExpiresAt)) {
    // If locked by same user, just refresh the lock
    if (document.lockedBy === userName) {
      const newExpiry = new Date(Date.now() + LOCK_TIMEOUT_MS)
      await prisma.document.update({
        where: { id: docId },
        data: { lockExpiresAt: newExpiry },
      })
      return {
        success: true,
        lockedBy: userName,
        lockExpiresAt: newExpiry,
      }
    }

    // Locked by another user - throw error
    throw AuthErrors.documentLocked(document.lockedBy)
  }

  // Lock is available (no lock or expired) - acquire it
  const lockExpiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS)
  await prisma.document.update({
    where: { id: docId },
    data: {
      lockedBy: userName,
      lockExpiresAt,
    },
  })

  return {
    success: true,
    lockedBy: userName,
    lockExpiresAt,
  }
}

/**
 * Releases a document-level lock.
 *
 * Only the user who holds the lock can release it, unless the lock has expired.
 *
 * @param docId - The document ID to unlock
 * @param userName - Optional: The name/ID of the user releasing the lock.
 *                   If provided, only releases if this user holds the lock.
 *                   If not provided, releases the lock unconditionally.
 * @returns The lock result with the cleared state
 */
export async function releaseLock(docId: string, userName?: string): Promise<LockResult> {
  // Fetch current document state
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      lockedBy: true,
      lockExpiresAt: true,
    },
  })

  if (!document) {
    throw AuthErrors.documentNotFound()
  }

  // If userName is provided, only release if this user holds the lock
  // or if the lock has expired
  if (userName && document.lockedBy && document.lockedBy !== userName) {
    if (!isLockExpired(document.lockExpiresAt)) {
      // Another user still holds a valid lock - don't release
      return {
        success: false,
        lockedBy: document.lockedBy,
        lockExpiresAt: document.lockExpiresAt,
      }
    }
  }

  // Clear the lock
  await prisma.document.update({
    where: { id: docId },
    data: {
      lockedBy: null,
      lockExpiresAt: null,
    },
  })

  return {
    success: true,
    lockedBy: null,
    lockExpiresAt: null,
  }
}

/**
 * Refreshes an existing lock's expiration time.
 *
 * This should be called periodically during an editing session to prevent
 * the lock from expiring while the user is still actively editing.
 *
 * @param docId - The document ID
 * @param userName - The name/ID of the user who should hold the lock
 * @returns The lock result with the refreshed expiration
 * @throws AuthError with DOCUMENT_LOCKED if document is locked by another user
 */
export async function refreshLock(docId: string, userName: string): Promise<LockResult> {
  // Fetch current document state
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      lockedBy: true,
      lockExpiresAt: true,
    },
  })

  if (!document) {
    throw AuthErrors.documentNotFound()
  }

  // Check if the user currently holds the lock
  if (document.lockedBy !== userName) {
    // If locked by another user and not expired, throw error
    if (document.lockedBy && !isLockExpired(document.lockExpiresAt)) {
      throw AuthErrors.documentLocked(document.lockedBy)
    }

    // Lock is not held by this user (either no lock or expired)
    // Acquire the lock instead
    return acquireLock(docId, userName)
  }

  // User holds the lock - refresh it
  const newExpiry = new Date(Date.now() + LOCK_TIMEOUT_MS)
  await prisma.document.update({
    where: { id: docId },
    data: { lockExpiresAt: newExpiry },
  })

  return {
    success: true,
    lockedBy: userName,
    lockExpiresAt: newExpiry,
  }
}

/**
 * Gets the current lock status of a document.
 *
 * @param docId - The document ID
 * @returns The current lock state, with expired locks reported as unlocked
 */
export async function getLockStatus(docId: string): Promise<LockResult> {
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      lockedBy: true,
      lockExpiresAt: true,
    },
  })

  if (!document) {
    throw AuthErrors.documentNotFound()
  }

  // If lock is expired, report as unlocked
  if (isLockExpired(document.lockExpiresAt)) {
    return {
      success: true,
      lockedBy: null,
      lockExpiresAt: null,
    }
  }

  return {
    success: true,
    lockedBy: document.lockedBy,
    lockExpiresAt: document.lockExpiresAt,
  }
}

/**
 * Checks if a document is locked and throws an error if locked by another user.
 *
 * This is a convenience function for use in API route handlers before allowing
 * edit operations.
 *
 * @param docId - The document ID
 * @param userName - The name/ID of the user attempting the operation
 * @throws AuthError with DOCUMENT_LOCKED if document is locked by another user
 */
export async function checkLock(docId: string, userName: string): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      lockedBy: true,
      lockExpiresAt: true,
    },
  })

  if (!document) {
    throw AuthErrors.documentNotFound()
  }

  // If there's a valid lock by another user, throw error
  if (
    document.lockedBy &&
    document.lockedBy !== userName &&
    !isLockExpired(document.lockExpiresAt)
  ) {
    throw AuthErrors.documentLocked(document.lockedBy)
  }
}

/**
 * Clears expired locks from the database.
 *
 * This function can be called periodically (e.g., via a cron job or scheduled task)
 * to clean up orphaned locks. While locks are also checked at read time,
 * this provides a proactive cleanup mechanism.
 *
 * @returns The number of locks cleared
 */
export async function clearExpiredLocks(): Promise<number> {
  const result = await prisma.document.updateMany({
    where: {
      lockExpiresAt: {
        lt: new Date(),
      },
      lockedBy: {
        not: null,
      },
    },
    data: {
      lockedBy: null,
      lockExpiresAt: null,
    },
  })

  return result.count
}
