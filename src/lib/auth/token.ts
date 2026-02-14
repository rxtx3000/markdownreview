import { createHash, randomUUID } from 'crypto'

/**
 * Hashes a token using SHA-256.
 * @param token - The raw token string to hash
 * @returns The SHA-256 hash of the token as a hexadecimal string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Generates a new token with both raw and hashed versions.
 * The raw token should be sent to the user (in URL).
 * The hash should be stored in the database.
 * @returns An object containing the raw token and its SHA-256 hash
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomUUID()
  const hash = hashToken(raw)
  return { raw, hash }
}
