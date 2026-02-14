/**
 * Authentication Module
 *
 * This module provides token-based authentication for MarkdownReview Hub.
 * It implements the security specifications from SPEC.md §2C and §8.
 *
 * Key Features:
 * - SHA-256 token hashing
 * - UUID v4 token generation
 * - Owner and Reviewer authentication
 * - Share link expiration and revocation checks
 * - Standard error responses (SPEC.md §7)
 */

// Token utilities
export { hashToken, generateToken } from './token'

// Authentication middleware
export {
  extractToken,
  verifyOwnerToken,
  verifyReviewerToken,
  authenticate,
  requireOwner,
  requirePermission,
  createErrorResponse,
} from './middleware'

// Error types and factories
export { AuthErrorCode, AuthError, AuthErrors } from './errors'
export type { ErrorResponse } from './errors'

// Type definitions
export { UserRole, ReviewerPermission } from './types'
export type { AuthContext, AuthenticatedRequest } from './types'
