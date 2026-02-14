'use client'

import { ReactNode } from 'react'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { ToastProvider } from '@/components/ui/ToastContext'

interface ProvidersProps {
  children: ReactNode
}

/**
 * App Providers Component
 *
 * Wraps the application with all necessary context providers
 * and error handling components.
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <ToastProvider maxToasts={5}>{children}</ToastProvider>
    </ErrorBoundary>
  )
}
