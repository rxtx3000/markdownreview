'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Toast, { ToastType } from '@/components/ui/Toast'

export interface TextAnchor {
  startLine: number
  endLine: number
  startChar: number
  endChar: number
}

export interface Comment {
  id: string
  authorName: string
  textAnchor: TextAnchor
  commentBody: string
  status: 'open' | 'resolved'
  resolvedAt: string | null
  createdAt: string
}

interface CommentsPanelProps {
  docId: string
  token: string
  tokenType: 'auth' | 'invite'
  isOpen: boolean
  isOwner: boolean
  reviewerName?: string
  documentStatus: 'draft' | 'in_review' | 'finalized'
  onClose: () => void
  onCommentClick?: (anchor: TextAnchor) => void
  selectedAnchor?: TextAnchor | null
  onAddComment?: (anchor: TextAnchor, body: string) => Promise<void>
}

export default function CommentsPanel({
  docId,
  token,
  tokenType,
  isOpen,
  isOwner,
  reviewerName,
  documentStatus,
  onClose,
  onCommentClick,
  selectedAnchor,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open'>('all')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [showAddComment, setShowAddComment] = useState(false)
  const [newCommentBody, setNewCommentBody] = useState('')
  const [newCommentAnchor, setNewCommentAnchor] = useState<TextAnchor | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      const url = new URL(`/api/documents/${docId}/comments`, window.location.origin)
      url.searchParams.set(tokenType, token)
      if (filter === 'open') {
        url.searchParams.set('status', 'open')
      }
      const response = await fetch(url.toString())
      const data = await response.json()
      if (response.ok) {
        setComments(data.comments)
      } else {
        setToast({ message: data.error?.message || 'Failed to load comments', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to load comments', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [docId, token, tokenType, filter])

  // Load comments when panel opens
  useEffect(() => {
    if (isOpen) {
      loadComments()
    }
  }, [isOpen, loadComments])

  // Handle selected anchor for new comment
  useEffect(() => {
    if (selectedAnchor && isOpen) {
      setNewCommentAnchor(selectedAnchor)
      setShowAddComment(true)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [selectedAnchor, isOpen])

  // Reload when filter changes
  useEffect(() => {
    if (isOpen) {
      loadComments()
    }
  }, [filter, isOpen, loadComments])

  const handleAddComment = useCallback(async () => {
    if (!newCommentBody.trim() || !newCommentAnchor) {
      setToast({ message: 'Please enter a comment', type: 'error' })
      return
    }

    try {
      setSubmitting(true)
      const url = new URL(`/api/documents/${docId}/comments`, window.location.origin)
      url.searchParams.set(tokenType, token)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_anchor: newCommentAnchor,
          comment_body: newCommentBody.trim(),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setComments((prev) => [...prev, data])
        setNewCommentBody('')
        setNewCommentAnchor(null)
        setShowAddComment(false)
        setToast({ message: 'Comment added', type: 'success' })
      } else {
        setToast({ message: data.error?.message || 'Failed to add comment', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to add comment', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [docId, token, tokenType, newCommentBody, newCommentAnchor])

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      try {
        const url = new URL(`/api/documents/${docId}/comments/${commentId}`, window.location.origin)
        url.searchParams.set(tokenType, token)

        const response = await fetch(url.toString(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' }),
        })

        const data = await response.json()
        if (response.ok) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === commentId
                ? { ...c, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
                : c
            )
          )
          setToast({ message: 'Comment resolved', type: 'success' })
        } else {
          setToast({ message: data.error?.message || 'Failed to resolve comment', type: 'error' })
        }
      } catch {
        setToast({ message: 'Failed to resolve comment', type: 'error' })
      }
    },
    [docId, token, tokenType]
  )

  const canAddCommentToSelection = documentStatus !== 'finalized'
  const currentAuthorName = isOwner ? 'Owner' : reviewerName

  // Filter displayed comments
  const displayedComments =
    filter === 'open' ? comments.filter((c) => c.status === 'open') : comments

  const openCount = comments.filter((c) => c.status === 'open').length

  if (!isOpen) return null

  // Handle keyboard navigation for the panel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-xl z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-panel-title"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <h2 id="comments-panel-title" className="text-lg font-semibold">
              Comments
            </h2>
            {openCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)] text-white"
                aria-label={`${openCount} open comments`}
              >
                {openCount} open
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Filter Toggle */}
        <div className="px-4 py-2 border-b border-[var(--border)]">
          <div
            className="flex gap-1 bg-[var(--background)] p-1 rounded-lg"
            role="tablist"
            aria-label="Filter comments"
          >
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white shadow text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
              role="tab"
              aria-selected={filter === 'all'}
              aria-controls="comments-list"
            >
              All ({comments.length})
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === 'open'
                  ? 'bg-white shadow text-[var(--foreground)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
              role="tab"
              aria-selected={filter === 'open'}
              aria-controls="comments-list"
            >
              Open ({openCount})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" id="comments-list" role="tabpanel">
          {/* Add Comment Form */}
          {showAddComment && newCommentAnchor && (
            <div className="bg-[var(--primary-light)] border border-[var(--primary)] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--primary)]">New Comment</span>
                <button
                  onClick={() => {
                    setShowAddComment(false)
                    setNewCommentAnchor(null)
                    setNewCommentBody('')
                  }}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Line {newCommentAnchor.startLine + 1}
                {newCommentAnchor.startLine !== newCommentAnchor.endLine &&
                  ` - ${newCommentAnchor.endLine + 1}`}
              </p>
              <textarea
                ref={textareaRef}
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                placeholder="Write your comment..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 resize-none"
                rows={3}
                aria-label="Comment text"
              />
              <button
                onClick={handleAddComment}
                disabled={submitting || !newCommentBody.trim()}
                className="w-full px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          )}

          {/* Add Comment Button */}
          {!showAddComment && canAddCommentToSelection && (
            <div className="bg-[var(--background)] rounded-lg p-4 text-center">
              <p className="text-sm text-[var(--muted)] mb-2">
                Select text in the editor and click &quot;Add Comment&quot; to comment on a specific
                section.
              </p>
            </div>
          )}

          {/* Comments List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayedComments.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              {filter === 'open' ? 'No open comments.' : 'No comments yet.'}
            </p>
          ) : (
            <ul className="space-y-3" role="list" aria-label="Comments">
              {displayedComments.map((comment) => {
                const isResolved = comment.status === 'resolved'
                const canResolve =
                  !isResolved &&
                  (isOwner || comment.authorName === currentAuthorName) &&
                  documentStatus !== 'finalized'

                return (
                  <li
                    key={comment.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      isResolved
                        ? 'border-[var(--border)] bg-[var(--surface-hover)] opacity-70'
                        : 'border-[var(--border)] bg-white hover:border-[var(--primary)]'
                    }`}
                    onClick={() => onCommentClick?.(comment.textAnchor)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onCommentClick?.(comment.textAnchor)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Comment by ${comment.authorName}: ${comment.commentBody.substring(0, 50)}${comment.commentBody.length > 50 ? '...' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comment.authorName}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {isResolved && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--success-light)] text-[var(--success)]">
                          Resolved
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[var(--muted)] mb-1">
                      Line {comment.textAnchor.startLine + 1}
                      {comment.textAnchor.startLine !== comment.textAnchor.endLine &&
                        ` - ${comment.textAnchor.endLine + 1}`}
                    </p>

                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                      {comment.commentBody}
                    </p>

                    {canResolve && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResolveComment(comment.id)
                        }}
                        className="mt-2 px-2 py-1 text-xs font-medium text-[var(--success)] border border-[var(--success)] rounded hover:bg-[var(--success-light)] transition-colors"
                        aria-label={`Resolve comment by ${comment.authorName}`}
                      >
                        Resolve
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
