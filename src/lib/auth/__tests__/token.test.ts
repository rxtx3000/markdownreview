/**
 * Unit tests for token utilities
 *
 * These tests verify SHA-256 hashing and UUID v4 token generation.
 */

import { hashToken, generateToken } from '../token'

describe('Token Utilities', () => {
  describe('hashToken', () => {
    it('should generate consistent SHA-256 hashes for the same input', () => {
      const token = 'test-token-123'
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 produces 64-character hex string
    })

    it('should generate different hashes for different inputs', () => {
      const hash1 = hashToken('token-1')
      const hash2 = hashToken('token-2')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce deterministic hashes', () => {
      const token = '550e8400-e29b-41d4-a716-446655440000'

      // Verify the hash is consistent across calls
      const actualHash = hashToken(token)
      expect(actualHash).toBe(hashToken(token))
    })
  })

  describe('generateToken', () => {
    it('should generate a token with raw and hash properties', () => {
      const token = generateToken()

      expect(token).toHaveProperty('raw')
      expect(token).toHaveProperty('hash')
      expect(typeof token.raw).toBe('string')
      expect(typeof token.hash).toBe('string')
    })

    it('should generate unique tokens on each call', () => {
      const token1 = generateToken()
      const token2 = generateToken()

      expect(token1.raw).not.toBe(token2.raw)
      expect(token1.hash).not.toBe(token2.hash)
    })

    it('should generate tokens in UUID v4 format', () => {
      const token = generateToken()
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(token.raw).toMatch(uuidV4Regex)
    })

    it('should generate hash that matches the raw token', () => {
      const token = generateToken()
      const manualHash = hashToken(token.raw)

      expect(token.hash).toBe(manualHash)
    })

    it('should generate 64-character hex hashes', () => {
      const token = generateToken()

      expect(token.hash).toHaveLength(64)
      expect(token.hash).toMatch(/^[0-9a-f]{64}$/i)
    })
  })
})
