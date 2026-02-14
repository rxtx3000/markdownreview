'use client'

import {
  useState,
  useCallback,
  lazy,
  Suspense,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import MarkdownPreview, { MarkdownPreviewRef } from './MarkdownPreview'
import type { SelectionInfo, CommentAnchor, CodeMirrorEditorRef } from './CodeMirrorEditor'

// Lazy load CodeMirror for performance
const CodeMirrorEditor = lazy(() => import('./CodeMirrorEditor'))

export type ViewMode = 'split' | 'editor' | 'preview'

export interface EditorLayoutProps {
  /** Current document content */
  content: string
  /** Called when content changes */
  onContentChange?: (content: string) => void
  /** Called when selection changes in the editor */
  onSelectionChange?: (selection: SelectionInfo) => void
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Whether to wrap edits in CriticMarkup (reviewer mode) */
  reviewerMode?: boolean
  /** Comment anchors to highlight */
  comments?: CommentAnchor[]
}

/** Methods exposed via ref */
export interface EditorLayoutRef {
  /** Scroll to a specific anchor position */
  scrollToAnchor: (anchor: { startLine: number; startChar: number }) => void
}

function EditorSkeleton() {
  return (
    <div className="flex items-center justify-center h-full bg-[var(--surface)] rounded-lg border border-[var(--border)]">
      <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading editor...</span>
      </div>
    </div>
  )
}

const EditorLayout = forwardRef<EditorLayoutRef, EditorLayoutProps>(function EditorLayout(
  {
    content,
    onContentChange,
    onSelectionChange,
    readOnly = false,
    reviewerMode = false,
    comments = [],
  },
  ref
) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [localContent, setLocalContent] = useState(content)
  const editorRef = useRef<CodeMirrorEditorRef>(null)
  const previewRef = useRef<MarkdownPreviewRef>(null)

  // Expose scroll method via ref
  useImperativeHandle(
    ref,
    () => ({
      scrollToAnchor: (anchor: { startLine: number; startChar: number }) => {
        // Scroll in both editor and preview if visible
        if (viewMode === 'editor' || viewMode === 'split') {
          editorRef.current?.scrollToAnchor(anchor)
        }
        if (viewMode === 'preview' || viewMode === 'split') {
          previewRef.current?.scrollToLine(anchor.startLine)
        }
      },
    }),
    [viewMode]
  )

  const handleChange = useCallback(
    (newContent: string) => {
      setLocalContent(newContent)
      onContentChange?.(newContent)
    },
    [onContentChange]
  )

  const viewModes: { value: ViewMode; label: string; icon: string }[] = [
    { value: 'editor', label: 'Editor', icon: '✏️' },
    { value: 'split', label: 'Split', icon: '⬛' },
    { value: 'preview', label: 'Preview', icon: '👁️' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-1" role="group" aria-label="View mode">
          {viewModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setViewMode(mode.value)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${
                  viewMode === mode.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }
              `}
              aria-label={`${mode.label} view`}
              aria-pressed={viewMode === mode.value}
            >
              <span className="mr-1.5" aria-hidden="true">
                {mode.icon}
              </span>
              {mode.label}
            </button>
          ))}
        </div>

        {readOnly && (
          <span
            className="text-xs text-[var(--muted)] bg-[var(--surface-hover)] px-2 py-1 rounded"
            role="status"
          >
            <span aria-hidden="true">🔒</span> Read-only
          </span>
        )}
        {reviewerMode && !readOnly && (
          <span
            className="text-xs text-[var(--primary)] bg-[var(--primary-light)] px-2 py-1 rounded font-medium"
            role="status"
          >
            <span aria-hidden="true">✍️</span> Review mode — changes are tracked
          </span>
        )}
      </div>

      {/* Editor/Preview Panes */}
      <div className="flex-1 min-h-0 flex">
        {/* Editor Pane */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div
            className={`${viewMode === 'split' ? 'w-1/2 border-r border-[var(--border)]' : 'w-full'} h-full`}
          >
            <Suspense fallback={<EditorSkeleton />}>
              <CodeMirrorEditor
                ref={editorRef}
                initialContent={localContent}
                onChange={handleChange}
                onSelectionChange={onSelectionChange}
                readOnly={readOnly}
                reviewerMode={reviewerMode}
                comments={comments}
                className="h-full rounded-none border-0"
              />
            </Suspense>
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full bg-[var(--surface)] overflow-hidden`}
          >
            <MarkdownPreview
              ref={previewRef}
              content={localContent}
              comments={comments}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  )
})

export default EditorLayout
