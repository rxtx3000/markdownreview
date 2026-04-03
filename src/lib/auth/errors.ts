/**
 * Standard error codes as defined in SPEC.md §7
 */
export enum AuthErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSION = 'INSUFFICIENT_PERMISSION',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  SHARE_EXPIRED = 'SHARE_EXPIRED',
  SHARE_REVOKED = 'SHARE_REVOKED',
  DOCUMENT_LOCKED = 'DOCUMENT_LOCKED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DOCUMENT_FINALIZED = 'DOCUMENT_FINALIZED',
  PENDING_CHANGES = 'PENDING_CHANGES',
}

/**
 * Standard error response structure as defined in SPEC.md §7
 */
export interface ErrorResponse {
  error: {
    code: AuthErrorCode
    message: string
  }
}

/**
 * Custom error class for authentication failures
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode
  public readonly statusCode: number

  constructor(code: AuthErrorCode, message: string, statusCode: number) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.name = 'AuthError'
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    }
  }
}

/**
 * Factory functions for common auth errors
 */
export const AuthErrors = {
  invalidToken: () =>
    new AuthError(AuthErrorCode.INVALID_TOKEN, 'Invalid or missing authentication token.', 401),

  insufficientPermission: () =>
    new AuthError(
      AuthErrorCode.INSUFFICIENT_PERMISSION,
      'You do not have permission to perform this action.',
      403
    ),

  documentNotInReview: () =>
    new AuthError(
      AuthErrorCode.INSUFFICIENT_PERMISSION,
      'Currently the document is not in review state.',
      403
    ),

  documentNotFound: () =>
    new AuthError(
      AuthErrorCode.DOCUMENT_NOT_FOUND,
      'The requested document does not exist or has been deleted.',
      404
    ),

  shareExpired: () =>
    new AuthError(AuthErrorCode.SHARE_EXPIRED, 'This share link has expired.', 410),

  shareRevoked: () =>
    new AuthError(
      AuthErrorCode.SHARE_REVOKED,
      'This share link has been revoked by the document owner.',
      403
    ),

  documentLocked: (lockedBy: string) =>
    new AuthError(
      AuthErrorCode.DOCUMENT_LOCKED,
      `Document is currently being edited by ${lockedBy}.`,
      409
    ),

  fileTooLarge: (maxSizeMB?: number) =>
    new AuthError(
      AuthErrorCode.FILE_TOO_LARGE,
      `File size exceeds the maximum limit of ${maxSizeMB ?? 5} MB.`,
      413
    ),

  documentFinalized: () =>
    new AuthError(
      AuthErrorCode.DOCUMENT_FINALIZED,
      'This document has been finalized and no longer accepts edits.',
      403
    ),

  pendingChanges: () =>
    new AuthError(
      AuthErrorCode.PENDING_CHANGES,
      'You must accept or reject all pending changes before making direct edits.',
      409
    ),
}
