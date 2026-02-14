/**
 * API Client
 *
 * Centralized client for making API calls from frontend components.
 * Handles token passing via query parameters.
 */

export interface ApiError {
  code: string
  message: string
}

export interface ApiErrorResponse {
  error: ApiError
}

export class ApiClientError extends Error {
  code: string
  statusCode: number
  isNetworkError: boolean

  constructor(code: string, message: string, statusCode: number, isNetworkError = false) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.statusCode = statusCode
    this.isNetworkError = isNetworkError
  }
}

/**
 * Network error class for retry handling
 */
export class NetworkError extends ApiClientError {
  retryable: boolean

  constructor(message: string, retryable = true) {
    super('NETWORK_ERROR', message, 0, true)
    this.name = 'NetworkError'
    this.retryable = retryable
  }
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in ms between retries (default: 1000) */
  baseDelay?: number
  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff?: boolean
  /** Callback when a retry is about to happen */
  onRetry?: (attempt: number, error: Error, delay: number) => void
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx server errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return error.retryable
  }
  if (error instanceof ApiClientError) {
    // Retry on server errors (5xx)
    return error.statusCode >= 500 && error.statusCode < 600
  }
  return false
}

/**
 * Build URL with auth query parameter
 */
function buildUrl(
  path: string,
  token: string,
  tokenType: 'auth' | 'invite',
  extraParams?: Record<string, string>
): string {
  const url = new URL(path, window.location.origin)
  url.searchParams.set(tokenType, token)
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

/**
 * Generic fetch wrapper with error handling and retry support
 */
async function apiFetch<T>(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })

      // Try to parse JSON, but handle non-JSON responses
      let data: unknown
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = { error: { code: 'UNKNOWN_ERROR', message: text || 'Unknown error' } }
      }

      if (!response.ok) {
        const errorData = data as ApiErrorResponse
        const error = new ApiClientError(
          errorData.error?.code || 'UNKNOWN_ERROR',
          errorData.error?.message || 'An unknown error occurred',
          response.status
        )

        // Only retry on retryable errors (5xx)
        if (attempt < opts.maxRetries && isRetryableError(error)) {
          lastError = error
          const delay = opts.exponentialBackoff
            ? opts.baseDelay * Math.pow(2, attempt)
            : opts.baseDelay
          opts.onRetry?.(attempt + 1, error, delay)
          await sleep(delay)
          continue
        }

        throw error
      }

      return data as T
    } catch (error) {
      // Handle network errors (fetch throws on network failures)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new NetworkError(
          'Unable to connect to the server. Please check your internet connection.'
        )

        if (attempt < opts.maxRetries) {
          lastError = networkError
          const delay = opts.exponentialBackoff
            ? opts.baseDelay * Math.pow(2, attempt)
            : opts.baseDelay
          opts.onRetry?.(attempt + 1, networkError, delay)
          await sleep(delay)
          continue
        }

        throw networkError
      }

      // Re-throw ApiClientErrors and other errors
      if (error instanceof ApiClientError) {
        throw error
      }

      // Wrap unknown errors
      if (error instanceof Error) {
        throw new NetworkError(error.message)
      }

      throw new NetworkError('An unexpected error occurred')
    }
  }

  // If we exhausted all retries
  throw lastError || new NetworkError('Request failed after multiple retries')
}

/**
 * Create a retryable fetch call with custom options
 */
export function createRetryableFetch(defaultRetryOptions?: RetryOptions) {
  return <T>(url: string, options?: RequestInit, retryOptions?: RetryOptions): Promise<T> => {
    return apiFetch<T>(url, options, { ...defaultRetryOptions, ...retryOptions })
  }
}

// ─── Document Types ──────────────────────────────────────────────

export interface DocumentResponse {
  id: string
  title: string
  content: string
  status: 'draft' | 'in_review' | 'finalized'
  lockedBy: string | null
  createdAt: string
  updatedAt: string
  role: 'OWNER' | 'REVIEWER'
  permissions?: 'view_only' | 'suggest_changes'
  reviewerName?: string
}

export interface CreateDocumentResponse {
  id: string
  title: string
  status: string
  ownerUrl: string
  createdAt: string
}

export interface UpdateDocumentResponse {
  id: string
  title: string
  content: string
  status: string
  updatedAt: string
}

export interface LockResponse {
  success: boolean
  lockedBy: string | null
  lockExpiresAt: string | null
}

export interface RotateTokenResponse {
  message: string
  ownerUrl: string
}

// ─── Document API ────────────────────────────────────────────────

export const documentsApi = {
  /** Create a new document (no auth required) */
  async create(title: string, content: string = ''): Promise<CreateDocumentResponse> {
    return apiFetch<CreateDocumentResponse>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    })
  },

  /** Upload a markdown file (no auth required) */
  async upload(file: File): Promise<CreateDocumentResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      const errorData = data as ApiErrorResponse
      throw new ApiClientError(
        errorData.error?.code || 'UNKNOWN_ERROR',
        errorData.error?.message || 'Upload failed',
        response.status
      )
    }

    return data as CreateDocumentResponse
  },

  /** Get document by ID */
  async get(docId: string, token: string, tokenType: 'auth' | 'invite'): Promise<DocumentResponse> {
    const url = buildUrl(`/api/documents/${docId}`, token, tokenType)
    return apiFetch<DocumentResponse>(url)
  },

  /** Update document (owner only) */
  async update(
    docId: string,
    token: string,
    data: { title?: string; content?: string; status?: string }
  ): Promise<UpdateDocumentResponse> {
    const url = buildUrl(`/api/documents/${docId}`, token, 'auth')
    return apiFetch<UpdateDocumentResponse>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /** Delete document (owner only) */
  async delete(docId: string, token: string): Promise<{ message: string }> {
    const url = buildUrl(`/api/documents/${docId}`, token, 'auth')
    return apiFetch<{ message: string }>(url, { method: 'DELETE' })
  },

  /** Acquire, refresh, or release a lock */
  async lock(
    docId: string,
    token: string,
    tokenType: 'auth' | 'invite',
    action: 'acquire' | 'refresh' | 'release'
  ): Promise<LockResponse> {
    const url = buildUrl(`/api/documents/${docId}/lock`, token, tokenType)
    return apiFetch<LockResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ action }),
    })
  },

  /** Rotate owner token */
  async rotateToken(docId: string, token: string): Promise<RotateTokenResponse> {
    const url = buildUrl(`/api/documents/${docId}/rotate-token`, token, 'auth')
    return apiFetch<RotateTokenResponse>(url, { method: 'POST' })
  },
}
