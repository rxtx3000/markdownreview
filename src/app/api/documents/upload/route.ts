import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { generateToken } from '@/lib/auth'
import { AuthErrors } from '@/lib/auth/errors'

const prisma = new PrismaClient()

/**
 * Get the maximum upload size in bytes from environment variable.
 * Default: 5 MB as specified in SPEC.md §2A
 */
function getMaxUploadSizeBytes(): number {
  const maxSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10)
  // Ensure we have a valid positive number, default to 5 if invalid
  const validMaxSizeMB = isNaN(maxSizeMB) || maxSizeMB <= 0 ? 5 : maxSizeMB
  return validMaxSizeMB * 1024 * 1024
}

/**
 * Get the maximum upload size in MB for error messages
 */
function getMaxUploadSizeMB(): number {
  const maxSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10)
  return isNaN(maxSizeMB) || maxSizeMB <= 0 ? 5 : maxSizeMB
}

/**
 * Validate that content is valid UTF-8 encoded text.
 * Returns true if valid UTF-8, false otherwise.
 */
function isValidUtf8(buffer: ArrayBuffer): boolean {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    decoder.decode(buffer)
    return true
  } catch {
    return false
  }
}

/**
 * Extract title from markdown content or filename.
 * Attempts to find an H1 heading first, falls back to filename.
 */
function extractTitle(content: string, filename: string): string {
  // Try to find first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m)
  if (h1Match && h1Match[1].trim()) {
    return h1Match[1].trim()
  }

  // Fall back to filename without extension
  const nameWithoutExtension = filename.replace(/\.md$/i, '')
  return nameWithoutExtension || 'Untitled Document'
}

/**
 * POST /api/documents/upload
 * Upload a .md file to create a new document.
 * No authentication required (anyone can create a document).
 *
 * Request: multipart/form-data with a 'file' field containing the .md file
 *
 * Constraints (from SPEC.md §2A):
 * - File must be UTF-8 encoded
 * - File must not exceed MAX_UPLOAD_SIZE_MB (default: 5 MB)
 *
 * Response:
 * {
 *   id: string,
 *   title: string,
 *   status: 'draft',
 *   ownerUrl: string,
 *   createdAt: string
 * }
 *
 * Errors:
 * - 400: No file provided or invalid file type
 * - 413: File size exceeds limit (FILE_TOO_LARGE)
 * - 400: Invalid UTF-8 encoding
 */
export async function POST(request: NextRequest) {
  try {
    const maxSizeBytes = getMaxUploadSizeBytes()
    const maxSizeMB = getMaxUploadSizeMB()

    // Check Content-Length header first for early rejection
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (!isNaN(size) && size > maxSizeBytes) {
        const error = AuthErrors.fileTooLarge(maxSizeMB)
        return NextResponse.json(error.toJSON(), { status: error.statusCode })
      }
    }

    // Parse the multipart form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid form data. Please upload a file using multipart/form-data.',
          },
        },
        { status: 400 }
      )
    }

    // Get the file from the form data
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file provided. Please upload a .md file.',
          },
        },
        { status: 400 }
      )
    }

    // Validate file extension
    const filename = file.name
    if (!filename.toLowerCase().endsWith('.md')) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid file type. Only .md (Markdown) files are accepted.',
          },
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > maxSizeBytes) {
      const error = AuthErrors.fileTooLarge(maxSizeMB)
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }

    // Read file content as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Validate UTF-8 encoding
    if (!isValidUtf8(arrayBuffer)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid file encoding. File must be UTF-8 encoded.',
          },
        },
        { status: 400 }
      )
    }

    // Decode content as UTF-8 string
    const decoder = new TextDecoder('utf-8')
    const content = decoder.decode(arrayBuffer)

    // Extract title from content or filename
    const title = extractTitle(content, filename)

    // Generate owner token
    const { raw: rawToken, hash: tokenHash } = generateToken()

    // Create document
    const document = await prisma.document.create({
      data: {
        title,
        contentRaw: content,
        ownerTokenHash: tokenHash,
        status: 'draft',
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    })

    // Build owner URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const ownerUrl = `${baseUrl}/edit/${document.id}?auth=${rawToken}`

    return NextResponse.json(
      {
        id: document.id,
        title: document.title,
        status: document.status,
        ownerUrl,
        createdAt: document.createdAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while uploading the document.',
        },
      },
      { status: 500 }
    )
  }
}
