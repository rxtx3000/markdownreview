'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Global Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the errors, and displays a fallback UI.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console (could be sent to an error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 max-w-lg w-full text-center shadow-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-[var(--text)] mb-2">Something went wrong</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              An unexpected error occurred. We apologize for the inconvenience.
            </p>

            {/* Error details (collapsible in development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-[var(--muted)] hover:text-[var(--text-secondary)] transition-colors">
                  Error details
                </summary>
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg overflow-auto max-h-48">
                  <p className="text-sm font-mono text-red-800 break-words">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="mt-2 text-xs font-mono text-red-600 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-[var(--surface)] text-[var(--text)] text-sm font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
              >
                Reload Page
              </button>
            </div>

            <p className="mt-6 text-xs text-[var(--muted)]">
              If this problem persists, please try refreshing the page or contact support.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
