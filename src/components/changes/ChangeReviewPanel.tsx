'use client'

import { useState, useCallback, useEffect } from 'react'
import Toast, { ToastType } from '@/components/ui/Toast'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface ChangePosition {
  startOffset: number
  endOffset: number
  startLine: number
  endLine: number
}

interface Change {
  id: string
  type: 'addition' | 'deletion' | 'substitution'
  original: string | null
  replacement: string | null
  position: ChangePosition
}

interface ChangeReviewPanelProps {
  docId: string
  token: string
  isOpen: boolean
  onClose: () => void
  onChangesProcessed?: () => void
}

export default function ChangeReviewPanel({
  docId,
  token,
  isOpen,
  onClose,
  onChangesProcessed,
}: ChangeReviewPanelProps) {
  const [changes, setChanges] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [showBulkAcceptModal, setShowBulkAcceptModal] = useState(false)
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false)

  const loadChanges = useCallback(async () => {
    try {
      setLoading(true)
      const url = new URL(`/api/documents/${docId}/changes`, window.location.origin)
      url.searchParams.set('auth', token)
      const response = await fetch(url.toString())
      const data = await response.json()
      if (response.ok) {
        setChanges(data.changes)
      } else {
        setToast({ message: data.error?.message || 'Failed to load changes', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to load changes', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [docId, token])

  // Load changes when panel opens
  useEffect(() => {
    if (isOpen) {
      loadChanges()
    }
  }, [isOpen, loadChanges])

  const handleAcceptChange = useCallback(
    async (changeId: string) => {
      try {
        setProcessing(true)
        const url = new URL(`/api/documents/${docId}/changes/accept`, window.location.origin)
        url.searchParams.set('auth', token)

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change_ids: [changeId] }),
        })

        const data = await response.json()
        if (response.ok) {
          setToast({ message: 'Change accepted', type: 'success' })
          await loadChanges()
          onChangesProcessed?.()
        } else {
          setToast({ message: data.error?.message || 'Failed to accept change', type: 'error' })
        }
      } catch {
        setToast({ message: 'Failed to accept change', type: 'error' })
      } finally {
        setProcessing(false)
      }
    },
    [docId, token, loadChanges, onChangesProcessed]
  )

  const handleRejectChange = useCallback(
    async (changeId: string) => {
      try {
        setProcessing(true)
        const url = new URL(`/api/documents/${docId}/changes/reject`, window.location.origin)
        url.searchParams.set('auth', token)

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change_ids: [changeId] }),
        })

        const data = await response.json()
        if (response.ok) {
          setToast({ message: 'Change rejected', type: 'success' })
          await loadChanges()
          onChangesProcessed?.()
        } else {
          setToast({ message: data.error?.message || 'Failed to reject change', type: 'error' })
        }
      } catch {
        setToast({ message: 'Failed to reject change', type: 'error' })
      } finally {
        setProcessing(false)
      }
    },
    [docId, token, loadChanges, onChangesProcessed]
  )

  const handleBulkAccept = useCallback(async () => {
    setShowBulkAcceptModal(false)
    try {
      setProcessing(true)
      const url = new URL(`/api/documents/${docId}/changes/accept`, window.location.origin)
      url.searchParams.set('auth', token)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })

      const data = await response.json()
      if (response.ok) {
        setToast({
          message: `Accepted ${data.changesProcessed} change(s)`,
          type: 'success',
        })
        await loadChanges()
        onChangesProcessed?.()
      } else {
        setToast({ message: data.error?.message || 'Failed to accept changes', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to accept changes', type: 'error' })
    } finally {
      setProcessing(false)
    }
  }, [docId, token, loadChanges, onChangesProcessed])

  const handleBulkReject = useCallback(async () => {
    setShowBulkRejectModal(false)
    try {
      setProcessing(true)
      const url = new URL(`/api/documents/${docId}/changes/reject`, window.location.origin)
      url.searchParams.set('auth', token)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })

      const data = await response.json()
      if (response.ok) {
        setToast({
          message: `Rejected ${data.changesProcessed} change(s)`,
          type: 'success',
        })
        await loadChanges()
        onChangesProcessed?.()
      } else {
        setToast({ message: data.error?.message || 'Failed to reject changes', type: 'error' })
      }
    } catch {
      setToast({ message: 'Failed to reject changes', type: 'error' })
    } finally {
      setProcessing(false)
    }
  }, [docId, token, loadChanges, onChangesProcessed])

  const getChangeIcon = (type: Change['type']) => {
    switch (type) {
      case 'addition':
        return {
          icon: '+',
          className: 'bg-[var(--critic-addition-bg)] text-[var(--critic-addition-text)]',
        }
      case 'deletion':
        return {
          icon: '−',
          className: 'bg-[var(--critic-deletion-bg)] text-[var(--critic-deletion-text)]',
        }
      case 'substitution':
        return { icon: '↔', className: 'bg-[var(--warning-light)] text-[var(--warning)]' }
    }
  }

  const getChangeLabel = (type: Change['type']) => {
    switch (type) {
      case 'addition':
        return 'Addition'
      case 'deletion':
        return 'Deletion'
      case 'substitution':
        return 'Substitution'
    }
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
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--surface)] border-l border-[var(--border)] shadow-xl z-50 flex flex-col animate-slide-in-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changes-panel-title"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <h2 id="changes-panel-title" className="text-lg font-semibold">
              Pending Changes
            </h2>
            {changes.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--warning)] text-white"
                aria-label={`${changes.length} pending changes`}
              >
                {changes.length}
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

        {/* Bulk Actions */}
        {changes.length > 0 && (
          <div
            className="px-4 py-2 border-b border-[var(--border)] flex gap-2"
            role="group"
            aria-label="Bulk actions"
          >
            <button
              onClick={() => setShowBulkAcceptModal(true)}
              disabled={processing}
              className="flex-1 px-3 py-2 text-sm font-medium bg-[var(--success)] text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              aria-label={`Accept all ${changes.length} changes`}
            >
              ✓ Accept All
            </button>
            <button
              onClick={() => setShowBulkRejectModal(true)}
              disabled={processing}
              className="flex-1 px-3 py-2 text-sm font-medium bg-[var(--danger)] text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              aria-label={`Reject all ${changes.length} changes`}
            >
              ✗ Reject All
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8" role="status" aria-label="Loading changes">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-12" role="status">
              <span className="text-4xl mb-3 block" aria-hidden="true">
                ✓
              </span>
              <p className="text-sm text-[var(--muted)]">No pending changes</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                All reviewer suggestions have been processed.
              </p>
            </div>
          ) : (
            <ul className="space-y-4" role="list" aria-label="Pending changes">
              {changes.map((change, index) => {
                const changeStyle = getChangeIcon(change.type)
                return (
                  <li
                    key={change.id}
                    className="rounded-lg border border-[var(--border)] bg-white overflow-hidden"
                  >
                    {/* Change header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[var(--background)]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${changeStyle.className}`}
                        >
                          {changeStyle.icon}
                        </span>
                        <span className="text-sm font-medium">{getChangeLabel(change.type)}</span>
                        <span className="text-xs text-[var(--muted)]">
                          Line {change.position.startLine}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--muted)]">#{index + 1}</span>
                    </div>

                    {/* Change diff */}
                    <div className="p-3 space-y-2">
                      {change.type === 'deletion' && change.original && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-xs text-[var(--danger)] font-medium w-16">
                            Remove:
                          </span>
                          <span className="text-sm font-mono bg-[var(--critic-deletion-bg)] text-[var(--critic-deletion-text)] px-2 py-1 rounded line-through">
                            {change.original}
                          </span>
                        </div>
                      )}

                      {change.type === 'addition' && change.replacement && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-xs text-[var(--success)] font-medium w-16">
                            Add:
                          </span>
                          <span className="text-sm font-mono bg-[var(--critic-addition-bg)] text-[var(--critic-addition-text)] px-2 py-1 rounded">
                            {change.replacement}
                          </span>
                        </div>
                      )}

                      {change.type === 'substitution' && (
                        <>
                          {change.original && (
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-xs text-[var(--danger)] font-medium w-16">
                                From:
                              </span>
                              <span className="text-sm font-mono bg-[var(--critic-deletion-bg)] text-[var(--critic-deletion-text)] px-2 py-1 rounded line-through">
                                {change.original}
                              </span>
                            </div>
                          )}
                          {change.replacement && (
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-xs text-[var(--success)] font-medium w-16">
                                To:
                              </span>
                              <span className="text-sm font-mono bg-[var(--critic-addition-bg)] text-[var(--critic-addition-text)] px-2 py-1 rounded">
                                {change.replacement}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      className="flex border-t border-[var(--border)]"
                      role="group"
                      aria-label={`Actions for ${getChangeLabel(change.type)} change`}
                    >
                      <button
                        onClick={() => handleAcceptChange(change.id)}
                        disabled={processing}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[var(--success)] hover:bg-[var(--success-light)] disabled:opacity-50 transition-colors border-r border-[var(--border)]"
                        aria-label={`Accept ${getChangeLabel(change.type).toLowerCase()} change at line ${change.position.startLine}`}
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => handleRejectChange(change.id)}
                        disabled={processing}
                        className="flex-1 px-3 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:opacity-50 transition-colors"
                        aria-label={`Reject ${getChangeLabel(change.type).toLowerCase()} change at line ${change.position.startLine}`}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Bulk Accept Confirmation Modal */}
      <ConfirmModal
        open={showBulkAcceptModal}
        title="Accept All Changes"
        message={`This will accept all ${changes.length} pending change(s) and apply them to the document. This action cannot be undone.`}
        confirmLabel="Accept All"
        variant="default"
        onConfirm={handleBulkAccept}
        onCancel={() => setShowBulkAcceptModal(false)}
      />

      {/* Bulk Reject Confirmation Modal */}
      <ConfirmModal
        open={showBulkRejectModal}
        title="Reject All Changes"
        message={`This will reject all ${changes.length} pending change(s) and revert them in the document. This action cannot be undone.`}
        confirmLabel="Reject All"
        variant="danger"
        onConfirm={handleBulkReject}
        onCancel={() => setShowBulkRejectModal(false)}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
