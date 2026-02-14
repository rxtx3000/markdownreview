'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface DocumentToolbarProps {
  title: string
  status: 'draft' | 'in_review' | 'finalized'
  role: 'OWNER' | 'REVIEWER'
  reviewerName?: string
  saving: boolean
  hasLock: boolean
  lockedBy: string | null
  pendingChangesCount?: number
  commentsCount?: number
  onTitleChange?: (title: string) => Promise<void>
  onStatusChange?: (status: 'draft' | 'in_review' | 'finalized') => Promise<void>
  onDelete?: () => Promise<void>
  onRotateToken?: () => Promise<string>
  onSave?: () => Promise<void>
  onDownload?: (format: 'md' | 'pdf') => void
  onToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
  onOpenShares?: () => void
  onOpenComments?: () => void
  onOpenChanges?: () => void
}

export default function DocumentToolbar({
  title,
  status,
  role,
  reviewerName,
  saving,
  hasLock,
  lockedBy,
  pendingChangesCount = 0,
  commentsCount = 0,
  onTitleChange,
  onStatusChange,
  onDelete,
  onRotateToken,
  onSave,
  onDownload,
  onToast,
  onOpenShares,
  onOpenComments,
  onOpenChanges,
}: DocumentToolbarProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(title)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRotateModal, setShowRotateModal] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTitleValue(title)
  }, [title])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  // Close status menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false)
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTitleSubmit = async () => {
    setEditingTitle(false)
    if (titleValue.trim() && titleValue.trim() !== title) {
      try {
        await onTitleChange?.(titleValue.trim())
        onToast?.('Title updated', 'success')
      } catch {
        setTitleValue(title) // Revert on failure
        onToast?.('Failed to update title', 'error')
      }
    } else {
      setTitleValue(title) // Revert if empty
    }
  }

  const handleDelete = async () => {
    setShowDeleteModal(false)
    setDeleting(true)
    try {
      await onDelete?.()
      onToast?.('Document deleted', 'success')
      // Redirect to home after deletion
      window.location.href = '/'
    } catch {
      onToast?.('Failed to delete document', 'error')
      setDeleting(false)
    }
  }

  const handleRotateToken = async () => {
    setShowRotateModal(false)
    try {
      const newUrl = await onRotateToken?.()
      if (newUrl) {
        onToast?.('Token rotated. Redirecting to new URL...', 'success')
        // Navigate to the new URL
        setTimeout(() => {
          window.location.href = newUrl
        }, 1500)
      }
    } catch {
      onToast?.('Failed to rotate token', 'error')
    }
  }

  const handleStatusChange = async (newStatus: 'draft' | 'in_review' | 'finalized') => {
    setShowStatusMenu(false)
    try {
      await onStatusChange?.(newStatus)
      onToast?.(`Status changed to ${newStatus.replace('_', ' ')}`, 'success')
    } catch {
      onToast?.('Failed to change status', 'error')
    }
  }

  const isOwner = role === 'OWNER'

  const statusOptions: { value: 'draft' | 'in_review' | 'finalized'; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'in_review', label: 'In Review' },
    { value: 'finalized', label: 'Finalized' },
  ]

  return (
    <>
      <header className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title + Status */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Home link */}
            <Link
              href="/"
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
              aria-label="Go to home page"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </Link>

            {/* Title */}
            {editingTitle && isOwner ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit()
                  if (e.key === 'Escape') {
                    setTitleValue(title)
                    setEditingTitle(false)
                  }
                }}
                className="text-lg font-semibold bg-transparent border-b-2 border-[var(--primary)] outline-none px-1 py-0 min-w-0 flex-1 max-w-md"
                aria-label="Document title"
              />
            ) : (
              <button
                type="button"
                className={`text-lg font-semibold truncate text-left ${isOwner ? 'cursor-pointer hover:text-[var(--primary)]' : 'cursor-default'}`}
                onClick={() => isOwner && setEditingTitle(true)}
                onKeyDown={(e) => {
                  if (isOwner && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setEditingTitle(true)
                  }
                }}
                title={isOwner ? 'Click to edit title' : title}
                aria-label={
                  isOwner
                    ? `Document title: ${title}. Press Enter to edit`
                    : `Document title: ${title}`
                }
                disabled={!isOwner}
              >
                {title}
              </button>
            )}

            {/* Status Badge + Dropdown */}
            <div className="relative shrink-0" ref={statusMenuRef}>
              <button
                onClick={() =>
                  isOwner && status !== 'finalized' && setShowStatusMenu(!showStatusMenu)
                }
                className={isOwner && status !== 'finalized' ? 'cursor-pointer' : 'cursor-default'}
                disabled={!isOwner || status === 'finalized'}
                aria-label="Change document status"
                aria-haspopup="listbox"
                aria-expanded={showStatusMenu}
              >
                <StatusBadge status={status} />
              </button>

              {showStatusMenu && (
                <div
                  className="absolute top-full left-0 mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-20 min-w-[140px] animate-fade-in"
                  role="listbox"
                >
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      disabled={opt.value === status}
                      className={`
                        block w-full text-left px-3 py-2 text-sm transition-colors
                        ${opt.value === status ? 'text-[var(--muted)] bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}
                      `}
                      role="option"
                      aria-selected={opt.value === status}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reviewer info */}
            {role === 'REVIEWER' && reviewerName && (
              <span className="text-xs text-[var(--muted)] bg-[var(--surface-hover)] px-2 py-1 rounded">
                👤 {reviewerName}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Save indicator */}
            {saving && (
              <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-spin" />
                Saving...
              </span>
            )}

            {/* Lock indicator */}
            {lockedBy && !hasLock && (
              <span className="text-xs text-[var(--warning)] bg-[var(--warning-light)] px-2 py-1 rounded">
                🔒 Locked by {lockedBy}
              </span>
            )}

            {/* Save button (owner and reviewers with save capability) */}
            {onSave && status !== 'finalized' && (
              <button
                onClick={onSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
                aria-label="Save document"
              >
                <span aria-hidden="true">💾</span> Save
              </button>
            )}

            {/* Download button with dropdown (both roles) */}
            {onDownload && (
              <div className="relative" ref={downloadMenuRef}>
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1"
                  aria-label="Download document"
                  aria-haspopup="menu"
                  aria-expanded={showDownloadMenu}
                >
                  <span aria-hidden="true">⬇️</span> Download
                  <span className="ml-1 text-xs" aria-hidden="true">
                    ▼
                  </span>
                </button>
                {showDownloadMenu && (
                  <div
                    className="absolute right-0 mt-1 w-44 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden\"
                    role="menu"
                    aria-label="Download format options"
                  >
                    <button
                      onClick={() => {
                        onDownload('md')
                        setShowDownloadMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2"
                      role="menuitem"
                    >
                      <span aria-hidden="true">📄</span> Markdown (.md)
                    </button>
                    <button
                      onClick={() => {
                        onDownload('pdf')
                        setShowDownloadMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
                      role="menuitem"
                    >
                      <span aria-hidden="true">📕</span> PDF (.pdf)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Comments button (both roles) */}
            {onOpenComments && (
              <button
                onClick={onOpenComments}
                className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors relative"
                aria-label={`Open comments panel${commentsCount > 0 ? `, ${commentsCount} comments` : ''}`}
              >
                <span aria-hidden="true">💬</span> Comments
                {commentsCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--primary)] text-white text-xs font-bold rounded-full flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {commentsCount > 9 ? '9+' : commentsCount}
                  </span>
                )}
              </button>
            )}

            {/* Owner-only actions */}
            {isOwner && (
              <>
                {/* Changes button with badge */}
                {onOpenChanges && (
                  <button
                    onClick={onOpenChanges}
                    className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors relative"
                    aria-label={`Review changes${pendingChangesCount > 0 ? `, ${pendingChangesCount} pending` : ''}`}
                  >
                    <span aria-hidden="true">📝</span> Changes
                    {pendingChangesCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--warning)] text-white text-xs font-bold rounded-full flex items-center justify-center"
                        aria-hidden="true"
                      >
                        {pendingChangesCount > 9 ? '9+' : pendingChangesCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Shares button */}
                {onOpenShares && (
                  <button
                    onClick={onOpenShares}
                    className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    aria-label="Manage shares"
                  >
                    <span aria-hidden="true">🔗</span> Share
                  </button>
                )}

                <button
                  onClick={() => setShowRotateModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label="Rotate access token"
                >
                  <span aria-hidden="true">🔑</span> Rotate Token
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm font-medium text-[var(--danger)] border border-[var(--danger)] rounded-lg hover:bg-[var(--danger-light)] disabled:opacity-50 transition-colors"
                  aria-label="Delete document"
                >
                  <span aria-hidden="true">🗑️</span> Delete
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        title="Delete Document"
        message="This will permanently delete the document and all associated shares, comments, and version history. This action cannot be undone."
        confirmLabel="Delete permanently"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Rotate Token Confirmation Modal */}
      <ConfirmModal
        open={showRotateModal}
        title="Rotate Owner Token"
        message="This will generate a new access token and invalidate the current URL. You will be redirected to the new URL. Make sure to save it — there is no recovery mechanism."
        confirmLabel="Rotate Token"
        variant="warning"
        onConfirm={handleRotateToken}
        onCancel={() => setShowRotateModal(false)}
      />
    </>
  )
}
