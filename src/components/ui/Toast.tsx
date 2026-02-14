'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type: ToastType
  duration?: number
  onClose: () => void
  /** Whether this toast is rendered within a ToastProvider container */
  isStacked?: boolean
}

const toastStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-green-50 border-green-200 text-green-800', icon: '✅' },
  error: { bg: 'bg-red-50 border-red-200 text-red-800', icon: '❌' },
  info: { bg: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'ℹ️' },
  warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800', icon: '⚠️' },
}

export default function Toast({
  message,
  type,
  duration = 4000,
  onClose,
  isStacked = false,
}: ToastProps) {
  const [visible, setVisible] = useState(true)
  const styles = toastStyles[type]

  useEffect(() => {
    if (duration <= 0) return // Don't auto-dismiss if duration is 0 or negative

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200) // Wait for fade-out animation
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const positionClasses = isStacked ? '' : 'fixed bottom-4 right-4 z-[100]'

  // Use assertive for errors (more urgent), polite for other notifications
  const ariaLive = type === 'error' ? 'assertive' : 'polite'

  return (
    <div
      className={`
        ${positionClasses} flex items-center gap-2 px-4 py-3
        border rounded-lg shadow-lg text-sm font-medium
        transition-all duration-200 min-w-[280px] max-w-[400px]
        ${styles.bg}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <span className="flex-shrink-0" aria-hidden="true">
        {styles.icon}
      </span>
      <span className="flex-1 break-words">{message}</span>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(onClose, 200)
        }}
        className="flex-shrink-0 ml-2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  )
}
