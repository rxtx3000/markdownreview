'use client'

import { useState, useCallback, useEffect } from 'react'
import Toast, { ToastType } from '@/components/ui/Toast'

interface Share {
  id: string
  reviewerName: string
  permissions: 'view_only' | 'suggest_changes'
  isActive: boolean
  isExpired: boolean
  expiresAt: string | null
  createdAt: string
  reviewerUrl?: string
}

interface ShareManagementPanelProps {
  docId: string
  token: string
  isOpen: boolean
  documentStatus: 'draft' | 'in_review' | 'finalized'
  onClose: () => void
  onStatusChange?: (status: 'draft' | 'in_review' | 'finalized') => Promise<void>
}

export default function ShareManagementPanel({
  docId,
  token,
  isOpen,
  documentStatus,
  onClose,
  onStatusChange,
}: ShareManagementPanelProps) {
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [newReviewerName, setNewReviewerName] = useState('')
  const [newPermissions, setNewPermissions] = useState<'view_only' | 'suggest_changes'>(
    'suggest_changes'
  )
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null)

  const loadShares = useCallback(async () => {
    try {
      setLoading(true)
      const url = new URL(`/api/documents/${docId}/shares`, window.location.origin)
      url.searchParams.set('auth', token)
      const response = await fetch(url.toString())
      const data = await response.json()
      if (response.ok) {
        setShares(data.shares)
      } else {
        setToast({ message: data.error?.message || 'Failed to load shares', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to load shares', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [docId, token])

  // Load shares when panel opens
  useEffect(() => {
    if (isOpen) {
      loadShares()
    }
  }, [isOpen, loadShares])

  const handleCreateShare = useCallback(async () => {
    if (!newReviewerName.trim()) {
      setToast({ message: 'Please enter a reviewer name', type: 'error' })
      return
    }

    try {
      setCreating(true)
      const url = new URL(`/api/documents/${docId}/shares`, window.location.origin)
      url.searchParams.set('auth', token)

      const body: Record<string, unknown> = {
        reviewer_name: newReviewerName.trim(),
        permissions: newPermissions,
      }
      if (newExpiresAt) {
        body.expires_at = new Date(newExpiresAt).toISOString()
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (response.ok) {
        setNewShareUrl(data.reviewerUrl)
        setShares((prev) => [{ ...data, isExpired: false }, ...prev])
        setNewReviewerName('')
        setNewExpiresAt('')
        setToast({ message: 'Reviewer link created!', type: 'success' })
      } else {
        setToast({ message: data.error?.message || 'Failed to create share', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to create share', type: 'error' })
    } finally {
      setCreating(false)
    }
  }, [docId, token, newReviewerName, newPermissions, newExpiresAt])

  const handleRevokeShare = useCallback(
    async (shareId: string) => {
      try {
        const url = new URL(`/api/documents/${docId}/shares/${shareId}`, window.location.origin)
        url.searchParams.set('auth', token)

        const response = await fetch(url.toString(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        })

        const data = await response.json()
        if (response.ok) {
          setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, isActive: false } : s)))
          setToast({ message: 'Share link revoked', type: 'success' })
        } else {
          setToast({ message: data.error?.message || 'Failed to revoke share', type: 'error' })
        }
      } catch {
        setToast({ message: 'Failed to revoke share', type: 'error' })
      }
    },
    [docId, token]
  )

  const handleCopyUrl = useCallback(async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setToast({ message: 'Failed to copy URL', type: 'error' })
    }
  }, [])

  const getShareStatus = (share: Share): { label: string; className: string } => {
    if (!share.isActive) {
      return { label: 'Revoked', className: 'text-[var(--danger)] bg-[var(--danger-light)]' }
    }
    if (share.isExpired) {
      return { label: 'Expired', className: 'text-[var(--warning)] bg-[var(--warning-light)]' }
    }
    return { label: 'Active', className: 'text-[var(--success)] bg-[var(--success-light)]' }
  }

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
        aria-labelledby="share-panel-title"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 id="share-panel-title" className="text-lg font-semibold">
            Share Management
          </h2>
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

        {/* Draft Status Warning */}
        {documentStatus === 'draft' && (
          <div className="px-4 py-3 bg-[var(--warning-light)] border-b border-[var(--warning)]">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--warning)]">
                  Document is in Draft mode
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Reviewers cannot access Draft documents. Change status to &quot;In Review&quot;
                  for share links to work.
                </p>
                {onStatusChange && (
                  <button
                    onClick={async () => {
                      try {
                        await onStatusChange('in_review')
                        setToast({ message: 'Status changed to In Review', type: 'success' })
                      } catch {
                        setToast({ message: 'Failed to change status', type: 'error' })
                      }
                    }}
                    className="mt-2 px-3 py-1.5 text-xs font-medium bg-[var(--warning)] text-white rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    Change to In Review
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Add Reviewer Form */}
          <div className="bg-[var(--background)] rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--foreground)]" id="add-reviewer-heading">
              Add Reviewer
            </h3>

            <div>
              <label htmlFor="reviewer-name" className="block text-xs text-[var(--muted)] mb-1">
                Reviewer Name
              </label>
              <input
                id="reviewer-name"
                type="text"
                value={newReviewerName}
                onChange={(e) => setNewReviewerName(e.target.value)}
                placeholder="e.g., Alice"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                aria-required="true"
              />
            </div>

            <div>
              <label
                htmlFor="reviewer-permissions"
                className="block text-xs text-[var(--muted)] mb-1"
              >
                Permissions
              </label>
              <select
                id="reviewer-permissions"
                value={newPermissions}
                onChange={(e) =>
                  setNewPermissions(e.target.value as 'view_only' | 'suggest_changes')
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 bg-white"
              >
                <option value="suggest_changes">Can suggest changes</option>
                <option value="view_only">View only (can comment)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="reviewer-expiration"
                className="block text-xs text-[var(--muted)] mb-1"
              >
                Expiration Date (optional)
              </label>
              <input
                id="reviewer-expiration"
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:border-[var(--border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>

            <button
              onClick={handleCreateShare}
              disabled={creating || !newReviewerName.trim()}
              className="w-full px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : '+ Add Reviewer'}
            </button>
          </div>

          {/* New Share URL Display */}
          {newShareUrl && (
            <div className="bg-[var(--success-light)] border border-[var(--success)] rounded-lg p-4">
              <p className="text-sm font-medium text-[var(--success)] mb-2">
                Reviewer link generated!
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={newShareUrl}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-white font-mono truncate"
                />
                <button
                  onClick={() => {
                    handleCopyUrl(newShareUrl, 'new-share')
                    setNewShareUrl(null)
                  }}
                  className="px-3 py-2 text-sm font-medium bg-[var(--success)] text-white rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap"
                >
                  {copiedId === 'new-share' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Shares List */}
          <div>
            <h3
              className="text-sm font-medium text-[var(--foreground)] mb-3"
              id="existing-shares-heading"
            >
              Existing Shares ({shares.length})
            </h3>

            {loading ? (
              <div className="flex justify-center py-8" role="status" aria-label="Loading shares">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                No reviewer links created yet.
              </p>
            ) : (
              <ul className="space-y-3" role="list" aria-labelledby="existing-shares-heading">
                {shares.map((share) => {
                  const status = getShareStatus(share)
                  return (
                    <li
                      key={share.id}
                      className="rounded-lg border border-[var(--border)] p-3 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {share.reviewerName}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted)] space-y-0.5">
                            <p>
                              {share.permissions === 'suggest_changes'
                                ? 'Can suggest changes'
                                : 'View only'}
                            </p>
                            {share.expiresAt && (
                              <p>Expires: {new Date(share.expiresAt).toLocaleDateString()}</p>
                            )}
                            <p>Created: {new Date(share.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {share.isActive && !share.isExpired && (
                          <button
                            onClick={() => handleRevokeShare(share.id)}
                            className="shrink-0 px-2 py-1 text-xs font-medium text-[var(--danger)] border border-[var(--danger)] rounded hover:bg-[var(--danger-light)] transition-colors"
                            aria-label={`Revoke share link for ${share.reviewerName}`}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
