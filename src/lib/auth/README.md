# Authentication Module

This module implements token-based authentication for MarkdownReview Hub as specified in SPEC.md §2C and §8.

## Overview

The authentication system uses:

- **UUID v4** for token generation
- **SHA-256** for one-way token hashing
- **Query parameters** for token transmission (`?auth=` for owners, `?invite=` for reviewers)
- **Database-stored hashes** to prevent token recovery if the database is compromised

## Architecture

### Token Types

1. **Owner Token (`auth` parameter)**
   - Full administrative access to the document
   - Format: `domain.com/edit/[doc_id]?auth=[owner_token]`
   - Stored as `owner_token_hash` in the `documents` table

2. **Reviewer Token (`invite` parameter)**
   - Limited access based on permission level
   - Format: `domain.com/review/[doc_id]?invite=[reviewer_token]`
   - Stored as `invite_token_hash` in the `shares` table
   - Subject to expiration and revocation

### Permission Levels

- **OWNER**: Full access to all document operations
- **REVIEWER with `suggest_changes`**: Can edit document (wrapped in CriticMarkup) and comment
- **REVIEWER with `view_only`**: Can view document and add comments only

## Usage

### Basic Authentication in API Routes

```typescript
import { authenticate, createErrorResponse } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Authenticate the request
    const auth = await authenticate(request, params.id)

    // Use auth.role to determine user capabilities
    if (auth.role === 'OWNER') {
      // Owner-specific logic
    } else {
      // Reviewer logic - check auth.reviewerInfo.permission
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Owner-Only Routes

```typescript
import { requireOwner, createErrorResponse } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // This will throw if user is not the owner
    const auth = await requireOwner(request, params.id)

    // Proceed with owner-only operation
    // ...

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Permission Checks

```typescript
import {
  authenticate,
  requirePermission,
  ReviewerPermission,
  createErrorResponse,
} from '@/lib/auth'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await authenticate(request, params.id)

    // Ensure user can suggest changes (not view_only)
    requirePermission(auth, ReviewerPermission.SUGGEST_CHANGES)

    // Proceed with edit operation
    // ...

    return NextResponse.json({ updated: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}
```

### Token Generation

```typescript
import { generateToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Creating a document with owner token
const { raw: ownerToken, hash: ownerTokenHash } = generateToken()

const document = await prisma.document.create({
  data: {
    title: 'My Document',
    content_raw: '# Hello World',
    owner_token_hash: ownerTokenHash,
    status: 'draft',
  },
})

// Return the owner URL with raw token
const ownerUrl = `${process.env.NEXTAUTH_URL}/edit/${document.id}?auth=${ownerToken}`

// Creating a reviewer share link
const { raw: inviteToken, hash: inviteTokenHash } = generateToken()

const share = await prisma.share.create({
  data: {
    doc_id: document.id,
    reviewer_name: 'Alice',
    invite_token_hash: inviteTokenHash,
    permissions: 'suggest_changes',
    is_active: true,
  },
})

const reviewerUrl = `${process.env.NEXTAUTH_URL}/review/${document.id}?invite=${inviteToken}`
```

## Error Handling

The module provides standardized error responses that match SPEC.md §7:

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or missing authentication token."
  }
}
```

### Available Error Types

- **401 INVALID_TOKEN**: Token is missing, malformed, or doesn't match database
- **403 INSUFFICIENT_PERMISSION**: Token is valid but lacks required permissions
- **403 SHARE_REVOKED**: Share link has been deactivated by the owner
- **404 DOCUMENT_NOT_FOUND**: Document doesn't exist or has been deleted
- **410 SHARE_EXPIRED**: Share link has passed its expiration date

### Using Error Helpers

```typescript
import { AuthErrors, createErrorResponse } from '@/lib/auth'

// Manually throw specific errors
if (!documentExists) {
  throw AuthErrors.documentNotFound()
}

// All errors are automatically handled by createErrorResponse()
```

## Security Considerations

1. **Token Storage**: Only hashes are stored in the database. Raw tokens are never persisted.
2. **Token Transmission**: Tokens are sent via HTTPS query parameters. The `Referrer-Policy: no-referrer` header prevents leakage.
3. **Token Rotation**: Owners can regenerate their token, invalidating the previous one.
4. **Expiration**: Reviewer tokens can have optional expiration dates.
5. **Revocation**: Owners can revoke reviewer access at any time.

## Implementation Details

### Token Hashing

```typescript
// SHA-256 hash generation
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

### Token Verification Flow

1. Extract token from query params (`?auth=` or `?invite=`)
2. Hash the incoming token using SHA-256
3. Query database for matching hash
4. For reviewer tokens: check `is_active` and `expires_at`
5. Return `AuthContext` with role and permissions

### Database Queries

- **Owner verification**: Single query to `documents` table
- **Reviewer verification**: Single query to `shares` table with filters for active/non-expired

## Testing

Example test cases for authentication:

```typescript
// Test owner token validation
const validOwnerToken = '...'
const auth = await verifyOwnerToken(docId, validOwnerToken)
expect(auth.role).toBe('OWNER')

// Test invalid token
await expect(verifyOwnerToken(docId, 'invalid-token')).rejects.toThrow()

// Test expired share
const expiredShare = { expires_at: new Date('2020-01-01') }
await expect(verifyReviewerToken(docId, expiredToken)).rejects.toThrow('SHARE_EXPIRED')
```

## Module Structure

```
src/lib/auth/
├── index.ts          # Public API exports
├── token.ts          # Token generation and hashing
├── middleware.ts     # Authentication logic
├── errors.ts         # Error definitions
├── types.ts          # TypeScript types
└── README.md         # This file
```
