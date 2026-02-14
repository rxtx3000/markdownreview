'use client'

import { useEffect, useRef, useCallback } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

const variantStyles = {
  danger: {
    button: 'bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white',
    icon: '⚠️',
  },
  warning: {
    button: 'bg-[var(--warning)] hover:bg-amber-600 text-white',
    icon: '⚡',
  },
  default: {
    button: 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white',
    icon: 'ℹ️',
  },
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const styles = variantStyles[variant]

  // Handle keyboard navigation within modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
      // Trap focus within modal
      if (e.key === 'Tab') {
        const focusableElements =
          dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (!focusableElements || focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    },
    [onCancel]
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
      // Focus the cancel button for safety (not the destructive action)
      setTimeout(() => cancelRef.current?.focus(), 50)
      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown)
    } else {
      dialog.close()
      document.removeEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl bg-[var(--surface)] p-0 shadow-2xl backdrop:bg-black/50 animate-fade-in"
      onClose={onCancel}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl" aria-hidden="true">
            {styles.icon}
          </span>
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <p id="modal-description" className="mt-1 text-sm text-[var(--text-secondary)]">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
