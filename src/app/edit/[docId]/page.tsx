'use client'

import { useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useDocument } from '@/hooks/useDocument'
import { ApiClientError } from '@/lib/api-client'
import DocumentToolbar from '@/components/editor/DocumentToolbar'
import EditorLayout, { EditorLayoutRef } from '@/components/editor/EditorLayout'
import type { SelectionInfo, CommentAnchor } from '@/components/editor/CodeMirrorEditor'
import Toast, { ToastType } from '@/components/ui/Toast'
import ShareManagementPanel from '@/components/sharing/ShareManagementPanel'
import CommentsPanel, { TextAnchor } from '@/components/comments/CommentsPanel'
import ChangeReviewPanel from '@/components/changes/ChangeReviewPanel'
import VersionHistoryPanel from '@/components/versions/VersionHistoryPanel'
import VersionComparisonView from '@/components/versions/VersionComparisonView'

export default function EditPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const docId = params.docId as string
  const token = searchParams.get('auth') || ''

  const {
    document,
    loading,
    error,
    errorCode,
    isNetworkError,
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
  } = useDocument({ docId, token, tokenType: 'auth' })

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const pendingContentRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<EditorLayoutRef>(null)

  // Panel states
  const [showSharesPanel, setShowSharesPanel] = useState(false)
  const [showCommentsPanel, setShowCommentsPanel] = useState(false)
  const [showChangesPanel, setShowChangesPanel] = useState(false)
  const [pendingChangesCount, setPendingChangesCount] = useState(0)
  const [selectedCommentAnchor, setSelectedCommentAnchor] = useState<TextAnchor | null>(null)
  const [currentSelection, setCurrentSelection] = useState<SelectionInfo | null>(null)
  const [comments, setComments] = useState<CommentAnchor[]>([])

  // Version Comparison states
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [selectedVersionData, setSelectedVersionData] = useState<{
    number: number
    content: string
  } | null>(null)

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type })
  }, [])

  // Load comments for highlighting
  const loadComments = useCallback(async () => {
    if (!document) return
    try {
      const url = new URL(`/api/documents/${docId}/comments`, window.location.origin)
      url.searchParams.set('auth', token)
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

  // Auto-acquire lock when page loads and document is editable
  useEffect(() => {
    if (document && document.status !== 'finalized' && !hasLock) {
      acquireLock()
    }
    // Release lock when unmounting
    return () => {
      releaseLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id, document?.status])

  // Load pending changes count
  const loadPendingChangesCount = useCallback(async () => {
    if (!document) return
    try {
      const url = new URL(`/api/documents/${docId}/changes`, window.location.origin)
      url.searchParams.set('auth', token)
      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setPendingChangesCount(data.changes?.length || 0)
      }
    } catch {
      // Silently fail
    }
  }, [document, docId, token])

  useEffect(() => {
    if (document) {
      loadPendingChangesCount()
    }
  }, [document, loadPendingChangesCount])

  const handleChangesProcessed = useCallback(() => {
    loadPendingChangesCount()
    // Refresh document to get updated content
    window.location.reload()
  }, [loadPendingChangesCount])

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

  const handleContentChange = useCallback(
    (content: string) => {
      pendingContentRef.current = content

      // Debounce auto-save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (pendingContentRef.current !== null) {
          try {
            await updateContent(pendingContentRef.current)
            pendingContentRef.current = null
          } catch (err) {
            if (err instanceof ApiClientError) {
              showToast(err.message, 'error')
            }
          }
        }
      }, 2000) // Auto-save after 2 seconds of inactivity
    },
    [updateContent, showToast]
  )

  const handleManualSave = useCallback(async () => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (pendingContentRef.current !== null) {
      try {
        await updateContent(pendingContentRef.current)
        pendingContentRef.current = null
        showToast('Document saved', 'success')
      } catch (err) {
        if (err instanceof ApiClientError) {
          showToast(err.message, 'error')
        } else {
          showToast('Failed to save document', 'error')
        }
      }
    } else {
      showToast('No changes to save', 'info')
    }
  }, [updateContent, showToast])

  const handleDownload = useCallback(
    (format: 'md' | 'pdf') => {
      const url = new URL(`/api/documents/${docId}/download`, window.location.origin)
      url.searchParams.set('auth', token)
      url.searchParams.set('format', format)
      window.location.href = url.toString()
    },
    [docId, token]
  )

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleSelectVersion = useCallback(
    async (versionNumber: number) => {
      try {
        const url = new URL(
          `/api/documents/${docId}/versions/${versionNumber}`,
          window.location.origin
        )
        url.searchParams.set('auth', token)
        const res = await fetch(url.toString())
        if (!res.ok) throw new Error('Failed to load version details')
        const data = await res.json()
        setSelectedVersionData({ number: versionNumber, content: data.version.contentSnapshot })
        setShowHistoryPanel(false) // Close panel after selecting
      } catch {
        showToast('Failed to load version content.', 'error')
      }
    },
    [docId, token, showToast]
  )

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
    const getErrorIcon = () => {
      if (isNetworkError) return '🌐'
      if (errorCode === 'INVALID_TOKEN') return '🔒'
      if (errorCode === 'DOCUMENT_NOT_FOUND') return '📄'
      return '⚠️'
    }

    const getErrorTitle = () => {
      if (isNetworkError) return 'Connection Error'
      if (errorCode === 'INVALID_TOKEN') return 'Invalid Access Token'
      if (errorCode === 'DOCUMENT_NOT_FOUND') return 'Document Not Found'
      return 'Error'
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 max-w-md text-center shadow-sm">
          <div className="text-4xl mb-3">{getErrorIcon()}</div>
          <h1 className="text-xl font-semibold mb-2">{getErrorTitle()}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {error || 'The document could not be loaded.'}
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

  // ─── Main Edit View ─────────────────────────────────────────

  const isFinalized = document.status === 'finalized'

  return (
    <div className="h-screen flex flex-col">
      <DocumentToolbar
        title={document.title}
        status={document.status}
        role={document.role}
        saving={saving}
        hasLock={hasLock}
        lockedBy={document.lockedBy}
        pendingChangesCount={pendingChangesCount}
        commentsCount={comments.filter((c) => c.status === 'open').length}
        onTitleChange={updateTitle}
        onStatusChange={updateStatus}
        onDelete={deleteDocument}
        onRotateToken={rotateToken}
        onSave={handleManualSave}
        onDownload={handleDownload}
        onToast={showToast}
        onOpenShares={() => setShowSharesPanel(true)}
        onOpenComments={() => setShowCommentsPanel(true)}
        onOpenChanges={() => setShowChangesPanel(true)}
        onOpenHistory={() => setShowHistoryPanel(true)}
      />

      <div className="flex-1 min-h-0 relative">
        {selectedVersionData ? (
          <VersionComparisonView
            originalTitle={`Version ${selectedVersionData.number}`}
            originalContent={selectedVersionData.content}
            newTitle="Current Draft"
            newContent={document.content}
            onClose={() => setSelectedVersionData(null)}
          />
        ) : (
          <EditorLayout
            ref={editorRef}
            content={document.content}
            onContentChange={handleContentChange}
            onSelectionChange={handleSelectionChange}
            readOnly={isFinalized}
            comments={comments}
          />
        )}

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

      {/* Share Management Panel */}
      <ShareManagementPanel
        docId={docId}
        token={token}
        isOpen={showSharesPanel}
        documentStatus={document.status}
        onClose={() => setShowSharesPanel(false)}
        onStatusChange={updateStatus}
      />

      {/* Comments Panel */}
      <CommentsPanel
        docId={docId}
        token={token}
        tokenType="auth"
        isOpen={showCommentsPanel}
        isOwner={true}
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

      {/* Change Review Panel */}
      <ChangeReviewPanel
        docId={docId}
        token={token}
        isOpen={showChangesPanel}
        onClose={() => setShowChangesPanel(false)}
        onChangesProcessed={handleChangesProcessed}
      />

      {/* Version History Panel */}
      <VersionHistoryPanel
        docId={docId}
        token={token}
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        onSelectVersion={handleSelectVersion}
        currentVersionNumber={selectedVersionData?.number}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
