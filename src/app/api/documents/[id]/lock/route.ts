import { NextRequest, NextResponse } from 'next/server'
import { authenticate, createErrorResponse, UserRole } from '@/lib/auth'
import { acquireLock, releaseLock, refreshLock, getLockStatus } from '@/lib/locking'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/documents/:id/lock
 * Acquires or refreshes a lock on the document for editing.
 *
 * Request Body:
 * {
 *   action: 'acquire' | 'refresh' | 'release'
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   lockedBy: string | null,
 *   lockExpiresAt: string | null
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Authenticate user (owner or reviewer with suggest_changes)
    const auth = await authenticate(request, id)

    // Determine the user name based on role
    let userName: string
    if (auth.role === UserRole.OWNER) {
      userName = 'Owner'
    } else if (auth.reviewerInfo) {
      userName = auth.reviewerInfo.reviewerName
    } else {
      userName = 'Unknown'
    }

    // Parse request body
    const body = await request.json()
    const action = body.action as string

    if (!action || !['acquire', 'refresh', 'release'].includes(action)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: "Action must be one of: 'acquire', 'refresh', 'release'.",
          },
        },
        { status: 400 }
      )
    }

    let result

    switch (action) {
      case 'acquire':
        result = await acquireLock(id, userName)
        break
      case 'refresh':
        result = await refreshLock(id, userName)
        break
      case 'release':
        result = await releaseLock(id, userName)
        break
      default:
        throw new Error('Invalid action')
    }

    return NextResponse.json({
      success: result.success,
      lockedBy: result.lockedBy,
      lockExpiresAt: result.lockExpiresAt?.toISOString() || null,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

/**
 * GET /api/documents/:id/lock
 * Gets the current lock status of a document.
 *
 * Response:
 * {
 *   isLocked: boolean,
 *   lockedBy: string | null,
 *   lockExpiresAt: string | null
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Authenticate user (any valid user can check lock status)
    await authenticate(request, id)

    const status = await getLockStatus(id)

    return NextResponse.json({
      isLocked: status.lockedBy !== null,
      lockedBy: status.lockedBy,
      lockExpiresAt: status.lockExpiresAt?.toISOString() || null,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
