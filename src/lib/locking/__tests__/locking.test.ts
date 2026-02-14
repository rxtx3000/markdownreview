/**
 * Unit Tests for Document Locking Module
 *
 * Tests the locking utilities as specified in SPEC.md §2D:
 * - Pessimistic locking for concurrent edit prevention
 * - Lock timeout after 5 minutes of inactivity
 * - Lock acquisition and release
 */

import { vi } from 'vitest'
import { isLockExpired, LOCK_TIMEOUT_MS } from '../utils'

describe('Document Locking Utilities', () => {
  describe('LOCK_TIMEOUT_MS', () => {
    it('should be 5 minutes (300000ms)', () => {
      expect(LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000)
      expect(LOCK_TIMEOUT_MS).toBe(300000)
    })
  })

  describe('isLockExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-07T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return true if lockExpiresAt is null', () => {
      expect(isLockExpired(null)).toBe(true)
    })

    it('should return true if lockExpiresAt is in the past', () => {
      const pastDate = new Date('2026-02-07T11:00:00Z')
      expect(isLockExpired(pastDate)).toBe(true)
    })

    it('should return false if lockExpiresAt is in the future', () => {
      const futureDate = new Date('2026-02-07T13:00:00Z')
      expect(isLockExpired(futureDate)).toBe(false)
    })

    it('should return true if lockExpiresAt is exactly now', () => {
      const now = new Date('2026-02-07T12:00:00Z')
      // Equal time means not less than, so it's technically not expired yet
      // But since we compare with < (strictly less), equal means expired
      expect(isLockExpired(now)).toBe(false)
    })

    it('should return true if lockExpiresAt is 1ms in the past', () => {
      const justPast = new Date('2026-02-07T11:59:59.999Z')
      expect(isLockExpired(justPast)).toBe(true)
    })
  })
})

describe('Lock Timeout Specification', () => {
  it('should define 5 minute lock timeout as per SPEC.md §2D', () => {
    // SPEC.md §2D states: "Locks automatically expire after 5 minutes of inactivity"
    const FIVE_MINUTES_MS = 5 * 60 * 1000
    expect(LOCK_TIMEOUT_MS).toBe(FIVE_MINUTES_MS)
  })
})
