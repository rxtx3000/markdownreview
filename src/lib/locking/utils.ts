/**
 * Document Locking Utilities
 *
 * Pure utility functions for document locking that don't depend on Prisma.
 * These can be safely imported in unit tests without database initialization.
 */

/**
 * Lock timeout duration in milliseconds (5 minutes as per SPEC.md §2D)
 */
export const LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Result of a lock operation
 */
export interface LockResult {
  success: boolean
  lockedBy: string | null
  lockExpiresAt: Date | null
}

/**
 * Checks if a lock has expired
 * @param lockExpiresAt - The expiration timestamp of the lock
 * @returns true if the lock has expired or is null
 */
export function isLockExpired(lockExpiresAt: Date | null): boolean {
  if (!lockExpiresAt) return true
  return new Date(lockExpiresAt) < new Date()
}
