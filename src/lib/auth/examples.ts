/**
 * Authentication Module Usage Examples
 *
 * This file contains example code snippets showing how to use the authentication
 * middleware in Next.js API routes. These are not runnable tests, but documentation.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { NextRequest, NextResponse } from 'next/server'
import {
  authenticate,
  requireOwner,
  requirePermission,
  createErrorResponse,
  generateToken,
  ReviewerPermission,
  UserRole,
} from './index'

/**
 * Example 1: Basic authentication in a GET endpoint
 * This allows both owners and reviewers to access the document
 */
export async function exampleGetDocument(request: NextRequest, params: { id: string }) {
  try {
    // Authenticate the request - works for both ?auth= and ?invite= tokens
    const auth = await authenticate(request, params.id)

    // Check user role and customize response
    if (auth.role === UserRole.OWNER) {
      // Owner gets full document with edit history
      return NextResponse.json({
        document: '...',
        editHistory: '...',
        shares: '...',
      })
    } else {
      // Reviewers get limited view based on their permissions
      const canEdit = auth.reviewerInfo?.permission === ReviewerPermission.SUGGEST_CHANGES

      return NextResponse.json({
        document: '...',
        canEdit,
        reviewerName: auth.reviewerInfo?.reviewerName,
      })
    }
  } catch (error) {
    // Returns standardized error response with proper status code
    return createErrorResponse(error)
  }
}

/**
 * Example 2: Owner-only endpoint (DELETE document)
 * Only the owner can delete a document
 */
export async function exampleDeleteDocument(request: NextRequest, params: { id: string }) {
  try {
    // This will throw INSUFFICIENT_PERMISSION if user is not owner
    await requireOwner(request, params.id)

    // Proceed with deletion...
    // await prisma.document.delete({ where: { id: params.id } });

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 3: Editing document with permission check
 * Reviewers need suggest_changes permission to edit
 */
export async function exampleEditDocument(request: NextRequest, params: { id: string }) {
  try {
    const auth = await authenticate(request, params.id)

    // Ensure user can suggest changes (not view_only)
    requirePermission(auth, ReviewerPermission.SUGGEST_CHANGES)

    const body = await request.json()

    // For reviewers, wrap changes in CriticMarkup
    if (auth.role === UserRole.REVIEWER) {
      // Apply CriticMarkup wrapping logic...
      // body.content = wrapInCriticMarkup(body.content);
    }

    // Update document...
    return NextResponse.json({ updated: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 4: Creating a new document and generating owner token
 */
export async function exampleCreateDocument(request: NextRequest) {
  try {
    const body = await request.json()

    // Generate owner token
    const { raw: ownerToken, hash: ownerTokenHash } = generateToken()

    // Create document in database
    // const document = await prisma.document.create({
    //   data: {
    //     title: body.title,
    //     content_raw: body.content,
    //     owner_token_hash: ownerTokenHash,
    //     status: 'draft',
    //   },
    // });

    const documentId = 'example-doc-id'

    // Return the Owner URL with raw token
    const ownerUrl = `${process.env.NEXTAUTH_URL}/edit/${documentId}?auth=${ownerToken}`

    return NextResponse.json({
      id: documentId,
      ownerUrl,
      // IMPORTANT: The raw token is shown only once!
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 5: Creating a share link for a reviewer
 */
export async function exampleCreateShare(request: NextRequest, params: { id: string }) {
  try {
    // Only owner can create shares
    await requireOwner(request, params.id)

    const body = await request.json()

    // Generate invite token for reviewer
    const { raw: inviteToken, hash: inviteTokenHash } = generateToken()

    // Create share in database
    // const share = await prisma.share.create({
    //   data: {
    //     doc_id: params.id,
    //     reviewer_name: body.reviewerName,
    //     invite_token_hash: inviteTokenHash,
    //     permissions: body.permissions, // 'view_only' or 'suggest_changes'
    //     is_active: true,
    //     expires_at: body.expiresAt, // optional
    //   },
    // });

    // Return the Reviewer URL with raw token
    const reviewerUrl = `${process.env.NEXTAUTH_URL}/review/${params.id}?invite=${inviteToken}`

    return NextResponse.json({
      shareId: 'example-share-id',
      reviewerUrl,
      expiresAt: body.expiresAt,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 6: Revoking a share link
 */
export async function exampleRevokeShare(
  request: NextRequest,
  params: { id: string; shareId: string }
) {
  try {
    // Only owner can revoke shares
    await requireOwner(request, params.id)

    // Update share to inactive
    // await prisma.share.update({
    //   where: { id: params.shareId },
    //   data: { is_active: false },
    // });

    return NextResponse.json({ revoked: true })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 7: Rotating owner token
 */
export async function exampleRotateToken(request: NextRequest, params: { id: string }) {
  try {
    // Verify current owner token
    await requireOwner(request, params.id)

    // Generate new owner token
    const { raw: newOwnerToken, hash: newOwnerTokenHash } = generateToken()

    // Update document with new token hash
    // await prisma.document.update({
    //   where: { id: params.id },
    //   data: { owner_token_hash: newOwnerTokenHash },
    // });

    // Return new Owner URL (old URL is now invalid)
    const newOwnerUrl = `${process.env.NEXTAUTH_URL}/edit/${params.id}?auth=${newOwnerToken}`

    return NextResponse.json({
      newOwnerUrl,
      message: 'Token rotated successfully. Save your new URL securely!',
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * Example 8: Adding a comment (both owner and reviewers can comment)
 */
export async function exampleCreateComment(request: NextRequest, params: { id: string }) {
  try {
    // Authenticate - both owners and reviewers can comment
    const auth = await authenticate(request, params.id)

    const body = await request.json()

    // Determine author info
    const authorName =
      auth.role === UserRole.OWNER ? 'Owner' : (auth.reviewerInfo?.reviewerName ?? 'Unknown')

    const shareId = auth.role === UserRole.OWNER ? null : auth.reviewerInfo?.shareId

    // Create comment
    // const comment = await prisma.comment.create({
    //   data: {
    //     doc_id: params.id,
    //     share_id: shareId,
    //     author_name: authorName,
    //     text_anchor: body.textAnchor, // { startLine, endLine, startChar, endChar }
    //     comment_body: body.commentBody,
    //     status: 'open',
    //   },
    // });

    return NextResponse.json({
      commentId: 'example-comment-id',
      authorName,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
