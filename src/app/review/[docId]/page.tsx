'use client'

import { useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useDocument } from '@/hooks/useDocument'
import DocumentToolbar from '@/components/editor/DocumentToolbar'
import EditorLayout, { EditorLayoutRef } from '@/components/editor/EditorLayout'
import type { SelectionInfo, CommentAnchor } from '@/components/editor/CodeMirrorEditor'
import Toast, { ToastType } from '@/components/ui/Toast'
import CommentsPanel, { TextAnchor } from '@/components/comments/CommentsPanel'

export default function ReviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const docId = params.docId as string
  const token = searchParams.get('invite') || ''

  const {
    document,
    loading,
    error,
    errorCode,
    isNetworkError,
    acquireLock,
    releaseLock,
    hasLock,
    retry,
  } = useDocument({
    docId,
    token,
    tokenType: 'invite',
  })

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [localContent, setLocalContent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<EditorLayoutRef>(null)
  const [showCommentsPanel, setShowCommentsPanel] = useState(false)
  const [selectedCommentAnchor, setSelectedCommentAnchor] = useState<TextAnchor | null>(null)
  const [currentSelection, setCurrentSelection] = useState<SelectionInfo | null>(null)
  const [comments, setComments] = useState<CommentAnchor[]>([])

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  // Load comments for highlighting
  const loadComments = useCallback(async () => {
    if (!document) return
    try {
      const url = new URL(`/api/documents/${docId}/comments`, window.location.origin)
      url.searchParams.set('invite', token)
      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        // Transform comments to CommentAnchor format
        const anchors: CommentAnchor[] = (data.comments || []).map(
          (c: { id: string; textAnchor: TextAnchor; status: 'open' | 'resolved' }) => ({
            id: c.id,
            startLine: c.textAnchor.startLine,
            endLine: c.textAnchor.endLine,
            startChar: c.textAnchor.startChar,
            endChar: c.textAnchor.endChar,
            status: c.status,
          })
        )
        setComments(anchors)
      }
    } catch {
      // Silently fail
    }
  }, [document, docId, token])

  useEffect(() => {
    if (document) {
      loadComments()
    }
  }, [document, loadComments])

  const handleCommentClick = useCallback((anchor: TextAnchor) => {
    // Scroll editor to the anchor position
    editorRef.current?.scrollToAnchor(anchor)
    // Close the comments panel to see the highlighted text
    setShowCommentsPanel(false)
  }, [])

  const handleSelectionChange = useCallback((selection: SelectionInfo) => {
    setCurrentSelection(selection.hasSelection ? selection : null)
  }, [])

  const handleAddCommentClick = useCallback(() => {
    if (currentSelection && currentSelection.hasSelection) {
      const anchor: TextAnchor = {
        startLine: currentSelection.startLine,
        endLine: currentSelection.endLine,
        startChar: currentSelection.startChar,
        endChar: currentSelection.endChar,
      }
      setSelectedCommentAnchor(anchor)
      setShowCommentsPanel(true)
      setCurrentSelection(null) // Clear floating button
    }
  }, [currentSelection])

  // Initialize local content when doc loads
  useEffect(() => {
    if (document && localContent === null) {
      setLocalContent(document.content)
    }
  }, [document, localContent])

  // Auto-acquire lock if reviewer can suggest changes
  useEffect(() => {
    if (
      document &&
      document.permissions === 'suggest_changes' &&
      document.status !== 'finalized' &&
      !hasLock
    ) {
      acquireLock()
    }
    return () => {
      releaseLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, document?.permissions, document?.status])

  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent(content)

      // Debounce auto-save for reviewer edits (PATCH the content directly)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaving(true)
          const url = new URL(`/api/documents/${docId}`, window.location.origin)
          url.searchParams.set('invite', token)

          const response = await fetch(url.toString(), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          })

          if (!response.ok) {
            const data = await response.json()
            showToast(data.error?.message || 'Failed to save', 'error')
          }
        } catch {
          showToast('Failed to save changes', 'error')
        } finally {
          setSaving(false)
        }
      }, 2000)
    },
    [docId, token, showToast]
  )

  const handleManualSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (localContent === null) return

    try {
      setSaving(true)
      const url = new URL(`/api/documents/${docId}`, window.location.origin)
      url.searchParams.set('invite', token)

      const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: localContent }),
      })

      if (!response.ok) {
        const data = await response.json()
        showToast(data.error?.message || 'Failed to save', 'error')
      } else {
        showToast('Changes saved', 'success')
      }
    } catch {
      showToast('Failed to save changes', 'error')
    } finally {
      setSaving(false)
    }
  }, [docId, token, localContent, showToast])

  const handleDownload = useCallback(
    (format: 'md' | 'pdf') => {
      const url = new URL(`/api/documents/${docId}/download`, window.location.origin)
      url.searchParams.set('invite', token)
      url.searchParams.set('format', format)
      window.location.href = url.toString()
    },
    [docId, token]
  )

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // ─── Loading State ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--muted)]">Loading document...</p>
        </div>
      </div>
    )
  }

  // ─── Error State ────────────────────────────────────────────

  if (error || !document) {
    const isExpired = errorCode === 'SHARE_EXPIRED'
    const isRevoked = errorCode === 'SHARE_REVOKED'

    const getErrorIcon = () => {
      if (isNetworkError) return '🌐'
      if (isExpired) return '⏰'
      if (isRevoked) return '🚫'
      if (errorCode === 'INVALID_TOKEN') return '🔒'
      return '📄'
    }

    const getErrorTitle = () => {
      if (isNetworkError) return 'Connection Error'
      if (isExpired) return 'Link Expired'
      if (isRevoked) return 'Link Revoked'
      if (errorCode === 'INVALID_TOKEN') return 'Invalid Access Link'
      return 'Error'
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 max-w-md text-center shadow-sm">
          <div className="text-4xl mb-3">{getErrorIcon()}</div>
          <h1 className="text-xl font-semibold mb-2">{getErrorTitle()}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {error || 'The document could not be accessed.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isNetworkError && (
              <button
                onClick={retry}
                className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            )}
            <Link
              href="/"
              className={`inline-flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isNetworkError
                  ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              }`}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── Compute editor state ──────────────────────────────────

  const isViewOnly = document.permissions === 'view_only'
  const isFinalized = document.status === 'finalized'
  const isReadOnly = isViewOnly || isFinalized
  const canSuggestChanges = document.permissions === 'suggest_changes' && !isFinalized

  return (
    <div className="h-screen flex flex-col">
      <DocumentToolbar
        title={document.title}
        status={document.status}
        role={document.role}
        reviewerName={document.reviewerName}
        saving={saving}
        hasLock={hasLock}
        lockedBy={document.lockedBy}
        commentsCount={comments.filter((c) => c.status === 'open').length}
        onSave={canSuggestChanges ? handleManualSave : undefined}
        onDownload={handleDownload}
        onToast={showToast}
        onOpenComments={() => setShowCommentsPanel(true)}
      />

      <div className="flex-1 min-h-0 relative">
        <EditorLayout
          ref={editorRef}
          content={localContent ?? document.content}
          onContentChange={canSuggestChanges ? handleContentChange : undefined}
          onSelectionChange={handleSelectionChange}
          readOnly={isReadOnly}
          reviewerMode={canSuggestChanges}
          comments={comments}
        />

        {/* Floating Add Comment Button */}
        {currentSelection &&
          currentSelection.hasSelection &&
          !isFinalized &&
          currentSelection.coords && (
            <button
              onClick={handleAddCommentClick}
              style={{
                position: 'fixed',
                top: currentSelection.coords.top + 8,
                left: currentSelection.coords.left,
              }}
              className="z-50 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg shadow-lg hover:bg-[var(--primary-hover)] transition-colors animate-fade-in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Add Comment
            </button>
          )}
      </div>

      {/* Comments Panel */}
      <CommentsPanel
        docId={docId}
        token={token}
        tokenType="invite"
        isOpen={showCommentsPanel}
        isOwner={false}
        reviewerName={document.reviewerName}
        documentStatus={document.status}
        onClose={() => {
          setShowCommentsPanel(false)
          setSelectedCommentAnchor(null)
          // Reload comments to update highlighting
          loadComments()
        }}
        onCommentClick={handleCommentClick}
        selectedAnchor={selectedCommentAnchor}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
