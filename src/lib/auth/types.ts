/**
 * User role types for authentication context
 */
export enum UserRole {
  OWNER = 'OWNER',
  REVIEWER = 'REVIEWER',
}

/**
 * Reviewer permission levels as defined in SPEC.md §2C
 */
export enum ReviewerPermission {
  VIEW_ONLY = 'view_only',
  SUGGEST_CHANGES = 'suggest_changes',
}

/**
 * Authentication context passed to API routes after middleware verification
 */
export interface AuthContext {
  role: UserRole
  documentId: string
  // For OWNER: always has full permissions
  // For REVIEWER: specific permission level and share info
  reviewerInfo?: {
    shareId: string
    reviewerName: string
    permission: ReviewerPermission
  }
}

/**
 * Extended NextRequest with authentication context
 */
export interface AuthenticatedRequest {
  auth: AuthContext
}
