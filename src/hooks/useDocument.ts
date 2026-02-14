'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { documentsApi, DocumentResponse, ApiClientError, NetworkError } from '@/lib/api-client'

export interface UseDocumentOptions {
  docId: string
  token: string
  tokenType: 'auth' | 'invite'
}

export interface UseDocumentReturn {
  document: DocumentResponse | null
  loading: boolean
  error: string | null
  errorCode: string | null
  /** Whether the error is a network error (can be retried) */
  isNetworkError: boolean
  /** Reload document from server */
  refresh: () => Promise<void>
  /** Update document content (owner only) */
  updateContent: (content: string) => Promise<void>
  /** Update document title (owner only) */
  updateTitle: (title: string) => Promise<void>
  /** Update document status (owner only) */
  updateStatus: (status: 'draft' | 'in_review' | 'finalized') => Promise<void>
  /** Delete document (owner only) */
  deleteDocument: () => Promise<void>
  /** Rotate owner token (owner only) */
  rotateToken: () => Promise<string>
  /** Acquire editing lock */
  acquireLock: () => Promise<boolean>
  /** Release editing lock */
  releaseLock: () => Promise<void>
  /** Whether the user currently holds the lock */
  hasLock: boolean
  /** Whether a save is in progress */
  saving: boolean
  /** Retry a failed operation */
  retry: () => Promise<void>
}

export function useDocument({ docId, token, tokenType }: UseDocumentOptions): UseDocumentReturn {
  const [document, setDocument] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isNetworkError, setIsNetworkError] = useState(false)
  const [hasLock, setHasLock] = useState(false)
  const [saving, setSaving] = useState(false)
  const lockRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setErrorCode(null)
      setIsNetworkError(false)
      const doc = await documentsApi.get(docId, token, tokenType)
      setDocument(doc)
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(err.message)
        setErrorCode(err.code)
        setIsNetworkError(true)
      } else if (err instanceof ApiClientError) {
        setError(err.message)
        setErrorCode(err.code)
        setIsNetworkError(err.isNetworkError)
      } else {
        setError('Failed to load document')
        setErrorCode('UNKNOWN_ERROR')
        setIsNetworkError(false)
      }
    } finally {
      setLoading(false)
    }
  }, [docId, token, tokenType])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Clean up lock refresh interval on unmount
  useEffect(() => {
    return () => {
      if (lockRefreshInterval.current) {
        clearInterval(lockRefreshInterval.current)
      }
    }
  }, [])

  const updateContent = useCallback(
    async (content: string) => {
      if (tokenType !== 'auth') return
      try {
        setSaving(true)
        const updated = await documentsApi.update(docId, token, { content })
        setDocument((prev) =>
          prev
            ? {
                ...prev,
                content: updated.content,
                updatedAt: updated.updatedAt,
              }
            : null
        )
      } catch (err) {
        if (err instanceof ApiClientError) {
          throw err
        }
        throw new Error('Failed to save document')
      } finally {
        setSaving(false)
      }
    },
    [docId, token, tokenType]
  )

  const updateTitle = useCallback(
    async (title: string) => {
      if (tokenType !== 'auth') return
      try {
        setSaving(true)
        const updated = await documentsApi.update(docId, token, { title })
        setDocument((prev) =>
          prev
            ? {
                ...prev,
                title: updated.title,
                updatedAt: updated.updatedAt,
              }
            : null
        )
      } catch (err) {
        if (err instanceof ApiClientError) {
          throw err
        }
        throw new Error('Failed to update title')
      } finally {
        setSaving(false)
      }
    },
    [docId, token, tokenType]
  )

  const updateStatus = useCallback(
    async (status: 'draft' | 'in_review' | 'finalized') => {
      if (tokenType !== 'auth') return
      try {
        setSaving(true)
        const updated = await documentsApi.update(docId, token, { status })
        setDocument((prev) =>
          prev
            ? {
                ...prev,
                status: updated.status as DocumentResponse['status'],
                updatedAt: updated.updatedAt,
              }
            : null
        )
      } catch (err) {
        if (err instanceof ApiClientError) {
          throw err
        }
        throw new Error('Failed to update status')
      } finally {
        setSaving(false)
      }
    },
    [docId, token, tokenType]
  )

  const deleteDocument = useCallback(async () => {
    if (tokenType !== 'auth') return
    await documentsApi.delete(docId, token)
  }, [docId, token, tokenType])

  const rotateToken = useCallback(async () => {
    if (tokenType !== 'auth') return ''
    const result = await documentsApi.rotateToken(docId, token)
    return result.ownerUrl
  }, [docId, token, tokenType])

  const acquireLock = useCallback(async () => {
    try {
      const result = await documentsApi.lock(docId, token, tokenType, 'acquire')
      if (result.success) {
        setHasLock(true)
        // Start refreshing lock every 3 minutes (before 5-minute expiry)
        lockRefreshInterval.current = setInterval(
          async () => {
            try {
              await documentsApi.lock(docId, token, tokenType, 'refresh')
            } catch {
              // Lock refresh failed, stop trying
              if (lockRefreshInterval.current) {
                clearInterval(lockRefreshInterval.current)
              }
              setHasLock(false)
            }
          },
          3 * 60 * 1000
        )
        return true
      }
      return false
    } catch {
      return false
    }
  }, [docId, token, tokenType])

  const releaseLock = useCallback(async () => {
    try {
      await documentsApi.lock(docId, token, tokenType, 'release')
    } finally {
      setHasLock(false)
      if (lockRefreshInterval.current) {
        clearInterval(lockRefreshInterval.current)
        lockRefreshInterval.current = null
      }
    }
  }, [docId, token, tokenType])

  // Retry function for network errors
  const retry = useCallback(async () => {
    await refresh()
  }, [refresh])

  return {
    document,
    loading,
    error,
    errorCode,
    isNetworkError,
    refresh,
    updateContent,
    updateTitle,
    updateStatus,
    deleteDocument,
    rotateToken,
    acquireLock,
    releaseLock,
    hasLock,
    saving,
    retry,
  }
}
