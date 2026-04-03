import { useState, useEffect } from 'react'

export interface DocumentVersionInfo {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdBy: string
  createdAt: string
}

interface VersionHistoryPanelProps {
  docId: string
  token: string
  tokenType?: 'auth' | 'invite'
  isOpen: boolean
  onClose: () => void
  onSelectVersion: (versionNumber: number) => void
  currentVersionNumber?: number
}

export default function VersionHistoryPanel({
  docId,
  token,
  tokenType = 'auth',
  isOpen,
  onClose,
  onSelectVersion,
  currentVersionNumber,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadVersions()
    }
  }, [isOpen, docId, token, tokenType])

  const loadVersions = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL(`/api/documents/${docId}/versions`, window.location.origin)
      url.searchParams.set(tokenType, token)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error('Failed to load versions')
      const data = await res.json()
      setVersions(data.versions || [])
    } catch (e: any) {
      setError(e.message || 'Error loading versions')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[var(--surface)] border-l border-[var(--border)] shadow-xl flex flex-col z-40 animate-[slide-in-right_0.2s_ease-out]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🕰️</span> Version History
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--muted)]"
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className="text-sm text-[var(--muted)] text-center">Loading...</p>}
        {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}

        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-[var(--muted)] text-center py-4">No version history yet.</p>
        )}

        {!loading &&
          versions.map((v) => (
            <div
              key={v.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                currentVersionNumber === v.versionNumber
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--muted)]'
              }`}
              onClick={() => onSelectVersion(v.versionNumber)}
              role="button"
              tabIndex={0}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm font-mono">v{v.versionNumber}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(v.createdAt).toLocaleDateString()}{' '}
                  {new Date(v.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                {v.changeSummary || 'Auto-saved version'}
              </p>
              <p className="text-xs text-[var(--muted)]">By: {v.createdBy}</p>
            </div>
          ))}
      </div>
    </div>
  )
}
