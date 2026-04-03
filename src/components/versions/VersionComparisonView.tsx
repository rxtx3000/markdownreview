import { useMemo } from 'react'
import * as diff from 'diff'
import { acceptChanges } from '@/lib/criticmarkup'

interface VersionComparisonViewProps {
  originalContent: string
  newContent: string
  originalTitle: string
  newTitle: string
  onClose: () => void
}

export default function VersionComparisonView({
  originalContent,
  newContent,
  originalTitle,
  newTitle,
  onClose,
}: VersionComparisonViewProps) {
  // Compute line diff
  const changes = useMemo(() => {
    const cleanOriginal = originalContent
      ? acceptChanges(originalContent, { all: true }).content
      : ''
    const cleanNew = newContent ? acceptChanges(newContent, { all: true }).content : ''
    return diff.diffLines(cleanOriginal, cleanNew)
  }, [originalContent, newContent])

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--surface)]">
      <div className="p-3 border-b border-[var(--border)] bg-[var(--surface)] flex justify-between items-center z-10 shrink-0">
        <h2 className="text-lg font-semibold px-2 flex items-center gap-3">
          <span>Comparing Versions</span>
        </h2>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-medium border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] mr-2"
        >
          Close Comparison
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Pane: Original */}
        <div className="w-1/2 flex flex-col border-r border-[var(--border)] h-full overflow-hidden">
          <div className="p-2 border-b border-[var(--border)] bg-[var(--surface-hover)] font-medium text-center text-sm text-[var(--muted)]">
            {originalTitle}
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
            {changes.map((part, index) => {
              // Hide additions in the original (left pane)
              if (part.added) return null
              const isRemoved = part.removed
              return (
                <span
                  key={index}
                  className={
                    isRemoved
                      ? 'bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 line-through'
                      : ''
                  }
                >
                  {part.value}
                </span>
              )
            })}
          </div>
        </div>

        {/* Right Pane: New */}
        <div className="w-1/2 flex flex-col h-full overflow-hidden">
          <div className="p-2 border-b border-[var(--border)] bg-[var(--surface-hover)] font-medium text-center text-sm text-[var(--muted)]">
            {newTitle}
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
            {changes.map((part, index) => {
              // Hide deletions in the new (right pane)
              if (part.removed) return null
              const isAdded = part.added
              return (
                <span
                  key={index}
                  className={
                    isAdded
                      ? 'bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100'
                      : ''
                  }
                >
                  {part.value}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
