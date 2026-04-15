'use client'

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
} from 'react'
import { renderMarkdown } from '@/lib/markdown-renderer'
import type { CommentAnchor } from './CodeMirrorEditor'

export interface MarkdownPreviewProps {
  /** The raw markdown content to render */
  content: string
  /** CSS class name for the container */
  className?: string
  /** Comment anchors to highlight */
  comments?: CommentAnchor[]
}

/** Methods exposed via ref */
export interface MarkdownPreviewRef {
  /** Scroll to a specific line number (0-based) */
  scrollToLine: (line: number) => void
}

/**
 * Applies comment highlighting to rendered HTML by wrapping text at specified ranges.
 * This is a best-effort approach that works for simple cases.
 */
function applyCommentHighlights(html: string, content: string, comments: CommentAnchor[]): string {
  if (comments.length === 0) return html

  // For preview highlighting, we use a simplified approach:
  // Add comment indicator markers that will show in the rendered output
  // This doesn't highlight exact text but provides visual feedback

  // Get open comments only for highlighting
  const openComments = comments.filter((c) => c.status === 'open')
  if (openComments.length === 0) return html

  // Split content into lines to find comment positions
  const lines = content.split('\n')

  // Create a set of lines that have comments
  const commentedLines = new Set<number>()
  for (const comment of openComments) {
    for (let line = comment.startLine; line <= comment.endLine; line++) {
      if (line >= 0 && line < lines.length) {
        commentedLines.add(line)
      }
    }
  }

  // If no lines are commented, return original HTML
  if (commentedLines.size === 0) return html

  // Add a visual indicator CSS class to highlight that there are comments
  // This adds a subtle left border indicator to the preview container
  return `<div class="has-comments" data-comment-count="${openComments.length}">${html}</div>`
}

const MarkdownPreview = forwardRef<MarkdownPreviewRef, MarkdownPreviewProps>(
  function MarkdownPreview({ content, className = '', comments = [] }, ref) {
    const [html, setHtml] = useState<string>('')
    const [rendering, setRendering] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Expose scroll method via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToLine: (line: number) => {
          const container = containerRef.current
          if (!container) return

          // Calculate approximate scroll position based on line number
          // This is a best-effort approach since rendered HTML doesn't map 1:1 to source lines
          const lines = content.split('\n')
          const totalLines = lines.length

          if (totalLines === 0) return

          // Calculate percentage through the document
          const percentage = Math.min(1, Math.max(0, line / totalLines))

          // Scroll to that percentage of the container
          const scrollHeight = container.scrollHeight - container.clientHeight
          const targetScroll = scrollHeight * percentage

          container.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
          })
        },
      }),
      [content]
    )

    useEffect(() => {
      // Debounce rendering for performance on large documents
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(async () => {
        setRendering(true)
        try {
          const rendered = await renderMarkdown(content)
          setHtml(rendered)
        } catch {
          setHtml('<p class="text-red-500">Error rendering Markdown</p>')
        } finally {
          setRendering(false)
        }
      }, 150)

      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
        }
      }
    }, [content])

    // Apply comment highlighting to rendered HTML
    const highlightedHtml = useMemo(() => {
      return applyCommentHighlights(html, content, comments)
    }, [html, content, comments])

    // Render Mermaid diagrams after HTML is injected into the DOM
    const renderMermaidDiagrams = useCallback(async () => {
      const container = containerRef.current
      if (!container) return

      // Find code blocks with language-mermaid class (produced by remark for ```mermaid blocks)
      const mermaidCodes = container.querySelectorAll<HTMLElement>('code.language-mermaid')
      if (mermaidCodes.length === 0) return

      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        fontFamily: 'sans-serif',
      })

      for (const codeEl of mermaidCodes) {
        const preEl = codeEl.parentElement
        if (!preEl || preEl.tagName !== 'PRE') continue
        if (preEl.classList.contains('mermaid-rendered')) continue

        const source = codeEl.textContent?.trim()
        if (!source) continue

        try {
          const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`
          const { svg } = await mermaid.render(id, source)
          // Replace the <pre> with a rendered diagram div
          const wrapper = document.createElement('div')
          wrapper.className = 'mermaid-diagram mermaid-rendered'
          wrapper.innerHTML = svg
          preEl.replaceWith(wrapper)
        } catch {
          preEl.classList.add('mermaid-error')
        }
      }
    }, [])

    useEffect(() => {
      renderMermaidDiagrams()
    }, [highlightedHtml, renderMermaidDiagrams])

    return (
      <div className={`relative ${className}`}>
        {rendering && (
          <div className="absolute top-2 right-2 text-xs text-[var(--muted)] flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--primary)] animate-spin" />
            Rendering...
          </div>
        )}
        <div
          ref={containerRef}
          className="markdown-preview p-6 h-full overflow-auto"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          role="document"
          aria-label="Rendered markdown preview"
        />
      </div>
    )
  }
)

export default MarkdownPreview
