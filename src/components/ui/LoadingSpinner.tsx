'use client'

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg'
  /** Optional message to display below the spinner */
  message?: string
  /** Whether to center the spinner in the container */
  centered?: boolean
  /** Custom class name */
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
}

/**
 * Loading Spinner Component
 *
 * A consistent loading indicator used across the application.
 */
export default function LoadingSpinner({
  size = 'md',
  message,
  centered = false,
  className = '',
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          border-[var(--primary)]
          border-t-transparent
          rounded-full
          animate-spin
        `}
        role="status"
        aria-label="Loading"
      />
      {message && (
        <p className="text-sm text-[var(--muted)]" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )

  if (centered) {
    return <div className="min-h-screen flex items-center justify-center">{spinner}</div>
  }

  return spinner
}

/**
 * Full page loading overlay
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      <div className="bg-[var(--surface)] rounded-xl p-6 shadow-xl border border-[var(--border)]">
        <LoadingSpinner size="lg" message={message} />
      </div>
    </div>
  )
}

/**
 * Inline loading indicator for buttons or small areas
 */
export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex gap-1 ${className}`} role="status" aria-label="Loading">
      <span
        className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </span>
  )
}
