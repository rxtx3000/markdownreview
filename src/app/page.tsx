'use client'

import { useState, useRef, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { documentsApi, ApiClientError } from '@/lib/api-client'
import Toast, { ToastType } from '@/components/ui/Toast'

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setCreating(true)
    try {
      const result = await documentsApi.create(title.trim(), content)
      // Navigate to the owner URL
      const url = new URL(result.ownerUrl)
      router.push(`${url.pathname}${url.search}`)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to create document'
      setToast({ message, type: 'error' })
      setCreating(false)
    }
  }

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.md')) {
      setToast({ message: 'Please select a .md file', type: 'error' })
      return
    }

    setUploading(true)
    try {
      const result = await documentsApi.upload(file)
      const url = new URL(result.ownerUrl)
      router.push(`${url.pathname}${url.search}`)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to upload file'
      setToast({ message, type: 'error' })
      setUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (uploading) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl animate-fade-in">
        {/* Logo / Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] text-white text-2xl mb-2 shadow-lg">
            📝
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            MarkdownReview Hub
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Create, share, and review Markdown documents with tracked changes and comments.
          </p>
        </div>

        {/* Create Document Card */}
        <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-[var(--border)] p-5">
          <h2 className="text-lg font-semibold mb-4" id="create-document-heading">
            Create a New Document
          </h2>

          <form
            onSubmit={handleCreate}
            className="space-y-3"
            aria-labelledby="create-document-heading"
          >
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Document Title{' '}
                <span className="text-[var(--danger)]" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">(required)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Project Proposal v2"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all bg-[var(--surface)]"
                required
                disabled={creating}
                aria-required="true"
                aria-describedby="title-hint"
              />
              <span id="title-hint" className="sr-only">
                Enter a descriptive title for your document
              </span>
            </div>

            {/* Content (optional) */}
            <div>
              <label
                htmlFor="content"
                className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
              >
                Initial Content <span className="text-[var(--muted)]">(optional)</span>
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# My Document&#10;&#10;Start writing Markdown here..."
                rows={4}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all bg-[var(--surface)] resize-y"
                disabled={creating}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="w-full py-2.5 px-4 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-busy={creating}
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Creating...
                </span>
              ) : (
                <>
                  <span aria-hidden="true">✨</span> Create Document
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--surface)] px-3 text-[var(--muted)] font-medium">
                or upload a file
              </span>
            </div>
          </div>

          {/* Upload */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              onChange={handleUpload}
              className="hidden"
              id="file-upload"
              disabled={uploading}
              aria-describedby="file-upload-description"
            />
            <label
              htmlFor="file-upload"
              className={`
                flex items-center justify-center gap-2 w-full py-2.5 px-4
                border-2 border-dashed rounded-lg
                text-sm font-medium
                transition-all cursor-pointer
                ${
                  isDragging
                    ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-light)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)]'
                }
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              role="button"
              aria-busy={uploading}
            >
              {uploading ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Uploading...
                </>
              ) : isDragging ? (
                <>
                  <span aria-hidden="true">📥</span> Drop your .md file here
                </>
              ) : (
                <>
                  <span aria-hidden="true">📄</span> Upload or drop a{' '}
                  <code className="text-xs bg-[var(--surface-hover)] px-1.5 py-0.5 rounded">
                    .md
                  </code>{' '}
                  file
                </>
              )}
            </label>
            <p
              id="file-upload-description"
              className="mt-1.5 text-xs text-[var(--muted)] text-center"
            >
              Max file size: {process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB || '5'} MB
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="text-xl mb-1">🔗</div>
            <h3 className="font-medium text-xs">Token-Based Access</h3>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">
              No accounts needed
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="text-xl mb-1">📊</div>
            <h3 className="font-medium text-xs">Track Changes</h3>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">
              CriticMarkup syntax
            </p>
          </div>
          <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
            <div className="text-xl mb-1">💬</div>
            <h3 className="font-medium text-xs">Comments</h3>
            <p className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">Anchored to text</p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  )
}
