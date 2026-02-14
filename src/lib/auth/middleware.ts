import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { hashToken } from './token'
import { AuthErrors } from './errors'
import { AuthContext, UserRole, ReviewerPermission } from './types'

const prisma = new PrismaClient()

/**
 * Extracts authentication token from query parameters.
 * Checks for 'auth' (owner token) or 'invite' (reviewer token).
 *
 * @param request - The incoming Next.js request
 * @returns The raw token string or null if not found
 */
export function extractToken(request: NextRequest): {
  token: string
  type: 'owner' | 'reviewer'
} | null {
  const { searchParams } = new URL(request.url)

  const ownerToken = searchParams.get('auth')
  if (ownerToken) {
    return { token: ownerToken, type: 'owner' }
  }

  const reviewerToken = searchParams.get('invite')
  if (reviewerToken) {
    return { token: reviewerToken, type: 'reviewer' }
  }

  return null
}

/**
 * Verifies an owner token against the database.
 *
 * @param documentId - The document ID to verify ownership for
 * @param rawToken - The raw token from the URL
 * @returns AuthContext if valid, null otherwise
 */
export async function verifyOwnerToken(
  documentId: string,
  rawToken: string
): Promise<AuthContext | null> {
  const tokenHash = hashToken(rawToken)

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, ownerTokenHash: true },
  })

  if (!document) {
    return null
  }

  if (document.ownerTokenHash !== tokenHash) {
    return null
  }

  return {
    role: UserRole.OWNER,
    documentId: document.id,
  }
}

/**
 * Verifies a reviewer token (invite link) against the database.
 * Checks for expiration and revocation.
 *
 * @param documentId - The document ID to verify access for
 * @param rawToken - The raw invite token from the URL
 * @returns AuthContext if valid, throws AuthError otherwise
 */
export async function verifyReviewerToken(
  documentId: string,
  rawToken: string
): Promise<AuthContext> {
  const tokenHash = hashToken(rawToken)

  const share = await prisma.share.findFirst({
    where: {
      docId: documentId,
      inviteTokenHash: tokenHash,
    },
    select: {
      id: true,
      reviewerName: true,
      permissions: true,
      isActive: true,
      expiresAt: true,
    },
  })

  if (!share) {
    throw AuthErrors.invalidToken()
  }

  // Check if share has been revoked
  if (!share.isActive) {
    throw AuthErrors.shareRevoked()
  }

  // Check if share has expired
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    throw AuthErrors.shareExpired()
  }

  return {
    role: UserRole.REVIEWER,
    documentId,
    reviewerInfo: {
      shareId: share.id,
      reviewerName: share.reviewerName,
      permission: share.permissions as ReviewerPermission,
    },
  }
}

/**
 * Main authentication middleware for API routes.
 * Extracts token from query params and verifies it against the database.
 *
 * Usage in API routes:
 * ```typescript
 * export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
 *   const auth = await authenticate(request, params.id);
 *   // Use auth.role, auth.documentId, auth.reviewerInfo
 * }
 * ```
 *
 * @param request - The incoming Next.js request
 * @param documentId - The document ID from the route params
 * @returns AuthContext if authentication succeeds
 * @throws AuthError if authentication fails
 */
export async function authenticate(request: NextRequest, documentId: string): Promise<AuthContext> {
  const tokenData = extractToken(request)

  if (!tokenData) {
    throw AuthErrors.invalidToken()
  }

  const { token, type } = tokenData

  if (type === 'owner') {
    const auth = await verifyOwnerToken(documentId, token)
    if (!auth) {
      // Token exists but doesn't match or document not found
      throw AuthErrors.invalidToken()
    }
    return auth
  } else {
    // type === 'reviewer'
    return await verifyReviewerToken(documentId, token)
  }
}

/**
 * Middleware wrapper that ensures only owners can access a route.
 *
 * @param request - The incoming Next.js request
 * @param documentId - The document ID from the route params
 * @returns AuthContext if user is owner
 * @throws AuthError with INSUFFICIENT_PERMISSION if user is not owner
 */
export async function requireOwner(request: NextRequest, documentId: string): Promise<AuthContext> {
  const auth = await authenticate(request, documentId)

  if (auth.role !== UserRole.OWNER) {
    throw AuthErrors.insufficientPermission()
  }

  return auth
}

/**
 * Middleware wrapper that ensures reviewer has specific permission level.
 *
 * @param auth - The authentication context from authenticate()
 * @param requiredPermission - The minimum required permission level
 * @throws AuthError with INSUFFICIENT_PERMISSION if permission is insufficient
 */
export function requirePermission(auth: AuthContext, requiredPermission: ReviewerPermission): void {
  if (auth.role === UserRole.OWNER) {
    // Owner has all permissions
    return
  }

  if (!auth.reviewerInfo) {
    throw AuthErrors.insufficientPermission()
  }

  // For now, we only have two levels: view_only and suggest_changes
  // suggest_changes includes all view_only permissions
  if (
    requiredPermission === ReviewerPermission.SUGGEST_CHANGES &&
    auth.reviewerInfo.permission === ReviewerPermission.VIEW_ONLY
  ) {
    throw AuthErrors.insufficientPermission()
  }
}

/**
 * Helper to create error responses in the standard format (SPEC.md §7).
 *
 * @param error - The AuthError to convert to a response
 * @returns NextResponse with appropriate status code and error body
 */
export function createErrorResponse(error: unknown): NextResponse {
  // Check if it's an AuthError instance
  if (error instanceof Error && 'code' in error && 'statusCode' in error && 'toJSON' in error) {
    const authError = error as unknown as {
      statusCode: number
      toJSON: () => object
    }
    return NextResponse.json(authError.toJSON(), {
      status: authError.statusCode,
    })
  }

  // Fallback for unexpected errors
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 }
  )
}
