'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Toast, { ToastType } from './Toast'

interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  /** Show a toast notification */
  showToast: (message: string, type: ToastType, duration?: number) => void
  /** Shorthand for success toast */
  success: (message: string, duration?: number) => void
  /** Shorthand for error toast */
  error: (message: string, duration?: number) => void
  /** Shorthand for info toast */
  info: (message: string, duration?: number) => void
  /** Shorthand for warning toast */
  warning: (message: string, duration?: number) => void
  /** Dismiss all toasts */
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
  /** Maximum number of toasts to show at once */
  maxToasts?: number
}

/**
 * Toast Provider Component
 *
 * Provides global toast notification functionality to the entire app.
 * Wrap your app with this provider to use the useToast hook.
 */
export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback(
    (message: string, type: ToastType, duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      const newToast: ToastItem = { id, message, type, duration }

      setToasts((prev) => {
        // Limit the number of toasts
        const updated = [...prev, newToast]
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts)
        }
        return updated
      })
    },
    [maxToasts]
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  )

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, dismissAll }}>
      {children}

      {/* Toast Container */}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto"
            style={{
              transform: `translateY(${-index * 4}px)`,
              zIndex: 100 - index,
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Hook to access toast notifications
 *
 * @example
 * const { success, error } = useToast()
 * success('Document saved!')
 * error('Failed to save document')
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
