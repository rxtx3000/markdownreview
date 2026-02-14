'use client'

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { EditorView, keymap, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view'
import { EditorState, StateField, RangeSetBuilder, StateEffect } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

// ─── Comment Anchor Type ────────────────────────────────────────
export interface CommentAnchor {
  id: string
  startLine: number
  endLine: number
  startChar: number
  endChar: number
  status: 'open' | 'resolved'
}

// ─── CriticMarkup Decoration ────────────────────────────────────

const additionMark = Decoration.mark({ class: 'cm-critic-addition' })
const deletionMark = Decoration.mark({ class: 'cm-critic-deletion' })
const substitutionMark = Decoration.mark({ class: 'cm-critic-substitution' })

const ADDITION_REGEX = /\{\+\+[^]*?\+\+\}/g
const DELETION_REGEX = /\{--[^]*?--\}/g
const SUBSTITUTION_REGEX = /\{~~[^]*?~~\}/g

function buildCriticDecorations(doc: EditorState['doc']): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const text = doc.toString()

  interface Match {
    from: number
    to: number
    decoration: Decoration
  }
  const matches: Match[] = []

  let match: RegExpExecArray | null
  const addRe = new RegExp(ADDITION_REGEX.source, 'g')
  while ((match = addRe.exec(text)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      decoration: additionMark,
    })
  }

  const delRe = new RegExp(DELETION_REGEX.source, 'g')
  while ((match = delRe.exec(text)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      decoration: deletionMark,
    })
  }

  const subRe = new RegExp(SUBSTITUTION_REGEX.source, 'g')
  while ((match = subRe.exec(text)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      decoration: substitutionMark,
    })
  }

  // Sort by position (required for RangeSetBuilder)
  matches.sort((a, b) => a.from - b.from || a.to - b.to)

  for (const m of matches) {
    builder.add(m.from, m.to, m.decoration)
  }

  return builder.finish()
}

const criticMarkupField = StateField.define<DecorationSet>({
  create(state) {
    return buildCriticDecorations(state.doc)
  },
  update(decorations, tr) {
    if (tr.docChanged) {
      return buildCriticDecorations(tr.state.doc)
    }
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f),
})

// ─── Comment Highlighting ───────────────────────────────────────

const commentMark = Decoration.mark({ class: 'cm-comment-highlight' })
const commentMarkResolved = Decoration.mark({ class: 'cm-comment-highlight-resolved' })

// StateEffect for updating comment anchors
const setCommentsEffect = StateEffect.define<CommentAnchor[]>()

function buildCommentDecorations(
  doc: EditorState['doc'],
  comments: CommentAnchor[]
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  interface Range {
    from: number
    to: number
    decoration: Decoration
  }
  const ranges: Range[] = []

  for (const comment of comments) {
    // Convert line/char to absolute positions
    // Lines are 0-based in our anchor, CodeMirror uses 1-based
    const startLineNum = comment.startLine + 1
    const endLineNum = comment.endLine + 1

    // Bounds check
    if (startLineNum < 1 || startLineNum > doc.lines) continue
    if (endLineNum < 1 || endLineNum > doc.lines) continue

    const startLine = doc.line(startLineNum)
    const endLine = doc.line(endLineNum)

    // Calculate absolute positions
    const from = Math.min(startLine.from + comment.startChar, startLine.to)
    const to = Math.min(endLine.from + comment.endChar, endLine.to)

    if (from < to && from >= 0 && to <= doc.length) {
      ranges.push({
        from,
        to,
        decoration: comment.status === 'open' ? commentMark : commentMarkResolved,
      })
    }
  }

  // Sort by position (required for RangeSetBuilder)
  ranges.sort((a, b) => a.from - b.from || a.to - b.to)

  for (const r of ranges) {
    builder.add(r.from, r.to, r.decoration)
  }

  return builder.finish()
}

const commentHighlightField = StateField.define<{
  decorations: DecorationSet
  comments: CommentAnchor[]
}>({
  create() {
    return { decorations: Decoration.none, comments: [] }
  },
  update(value, tr) {
    let comments = value.comments
    // Check for comment updates
    for (const effect of tr.effects) {
      if (effect.is(setCommentsEffect)) {
        comments = effect.value
      }
    }
    // Rebuild decorations if comments changed or document changed
    if (comments !== value.comments || tr.docChanged) {
      return {
        decorations: buildCommentDecorations(tr.state.doc, comments),
        comments,
      }
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
})

// ─── CriticMarkup Auto-Wrap for Reviewers ───────────────────────

/**
 * Checks if position is inside an existing addition marker and returns
 * the position to insert text (before the closing ++}) or null if not inside.
 */
function findInsertionPointInAddition(doc: string, pos: number): number | null {
  // Look backwards for {++ and forwards for ++}
  // We need to find if we're between {++ and ++}
  const before = doc.slice(0, pos)
  const after = doc.slice(pos)

  // Find the last {++ before cursor
  const lastOpenIdx = before.lastIndexOf('{++')
  if (lastOpenIdx === -1) return null

  // Check if there's a ++} between that {++ and cursor position
  const betweenOpenAndCursor = before.slice(lastOpenIdx + 3)
  if (betweenOpenAndCursor.includes('++}')) return null

  // Find the next ++} after cursor
  const nextCloseIdx = after.indexOf('++}')
  if (nextCloseIdx === -1) return null

  // We're inside an addition block!
  // Return the current position - text will be inserted inside the block
  return pos
}

/**
 * Creates a key binding extension that wraps reviewer edits in CriticMarkup.
 * When a reviewer types, deletions are wrapped in {-- --} and insertions in {++ ++}.
 * Consecutive insertions extend the existing {++ ++} block instead of creating new ones.
 */
function createReviewerAutoWrap() {
  return EditorView.inputHandler.of((view, from, to, text) => {
    const doc = view.state.doc.toString()

    if (from !== to && text.length > 0) {
      // Replacement: wrap in substitution
      const original = view.state.doc.sliceString(from, to)
      const replacement = `{~~ ${original} ~> ${text} ~~}`
      view.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from + replacement.length },
      })
      return true
    } else if (text.length > 0 && from === to) {
      // Pure insertion: check if we're already inside an addition block
      const insertPoint = findInsertionPointInAddition(doc, from)

      if (insertPoint !== null) {
        // We're inside an existing addition - just insert the text directly
        // The cursor is already positioned inside the {++ ++} block
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
        return true
      }

      // Not inside an addition - wrap in new addition markers
      const wrapped = `{++ ${text} ++}`
      view.dispatch({
        changes: { from, to, insert: wrapped },
        selection: { anchor: from + 4 + text.length }, // Position cursor after text but before " ++}"
      })
      return true
    }
    return false
  })
}

function createReviewerDeleteHandler() {
  return keymap.of([
    {
      key: 'Backspace',
      run: (view) => {
        const { state } = view
        const { from, to } = state.selection.main

        if (from !== to) {
          // Selection delete → wrap in deletion
          const deleted = state.doc.sliceString(from, to)
          const wrapped = `{-- ${deleted} --}`
          view.dispatch({
            changes: { from, to, insert: wrapped },
            selection: { anchor: from + wrapped.length },
          })
          return true
        } else if (from > 0) {
          // Single char delete
          const char = state.doc.sliceString(from - 1, from)
          const wrapped = `{-- ${char} --}`
          view.dispatch({
            changes: { from: from - 1, to: from, insert: wrapped },
            selection: { anchor: from - 1 + wrapped.length },
          })
          return true
        }
        return false
      },
    },
    {
      key: 'Delete',
      run: (view) => {
        const { state } = view
        const { from, to } = state.selection.main

        if (from !== to) {
          const deleted = state.doc.sliceString(from, to)
          const wrapped = `{-- ${deleted} --}`
          view.dispatch({
            changes: { from, to, insert: wrapped },
            selection: { anchor: from + wrapped.length },
          })
          return true
        } else if (from < state.doc.length) {
          const char = state.doc.sliceString(from, from + 1)
          const wrapped = `{-- ${char} --}`
          view.dispatch({
            changes: { from, to: from + 1, insert: wrapped },
            selection: { anchor: from + wrapped.length },
          })
          return true
        }
        return false
      },
    },
  ])
}

// ─── Selection Info for Comments ────────────────────────────────

export interface SelectionInfo {
  startLine: number
  endLine: number
  startChar: number
  endChar: number
  hasSelection: boolean
  /** Screen coordinates for floating UI */
  coords?: { top: number; left: number }
}

// ─── Editor Component Props ─────────────────────────────────────

export interface CodeMirrorEditorProps {
  /** Initial document content */
  initialContent: string
  /** Called when document content changes */
  onChange?: (content: string) => void
  /** Called when selection changes */
  onSelectionChange?: (selection: SelectionInfo) => void
  /** Whether the editor is read-only */
  readOnly?: boolean
  /** Whether to auto-wrap edits in CriticMarkup (for reviewers) */
  reviewerMode?: boolean
  /** CSS class name for the container */
  className?: string
  /** Comment anchors to highlight in the editor */
  comments?: CommentAnchor[]
}

/** Methods exposed via ref */
export interface CodeMirrorEditorRef {
  /** Scroll to a specific anchor position */
  scrollToAnchor: (anchor: { startLine: number; startChar: number }) => void
}

const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    {
      initialContent,
      onChange,
      onSelectionChange,
      readOnly = false,
      reviewerMode = false,
      className = '',
      comments = [],
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const onSelectionChangeRef = useRef(onSelectionChange)

    // Expose scroll method via ref
    useImperativeHandle(
      ref,
      () => ({
        scrollToAnchor: (anchor: { startLine: number; startChar: number }) => {
          const view = viewRef.current
          if (!view) return

          const doc = view.state.doc
          const lineNum = anchor.startLine + 1 // Convert to 1-based

          if (lineNum < 1 || lineNum > doc.lines) return

          const line = doc.line(lineNum)
          const pos = Math.min(line.from + anchor.startChar, line.to)

          // Scroll to position and optionally set cursor
          view.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: 'center' }),
          })
          view.focus()
        },
      }),
      []
    )

    // Keep onChange ref up-to-date without recreating the editor
    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    // Keep onSelectionChange ref up-to-date without recreating the editor
    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange
    }, [onSelectionChange])

    const handleUpdate = useCallback((update: ViewUpdate) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString())
      }

      // Report selection changes
      if ((update.selectionSet || update.docChanged) && onSelectionChangeRef.current) {
        const { from, to } = update.state.selection.main
        const hasSelection = from !== to

        const fromLine = update.state.doc.lineAt(from)
        const toLine = update.state.doc.lineAt(to)

        let coords: { top: number; left: number } | undefined
        if (hasSelection && update.view) {
          const coordsAtTo = update.view.coordsAtPos(to)
          if (coordsAtTo) {
            coords = { top: coordsAtTo.bottom, left: coordsAtTo.left }
          }
        }

        onSelectionChangeRef.current({
          startLine: fromLine.number - 1, // Convert to 0-based
          endLine: toLine.number - 1,
          startChar: from - fromLine.from,
          endChar: to - toLine.from,
          hasSelection,
          coords,
        })
      }
    }, [])

    useEffect(() => {
      if (!containerRef.current) return

      const extensions: ReturnType<typeof lineNumbers>[] = []

      // Reviewer delete handler MUST be added first (before defaultKeymap)
      // so it intercepts Backspace/Delete before the default handlers
      if (reviewerMode && !readOnly) {
        extensions.push(createReviewerDeleteHandler())
        extensions.push(createReviewerAutoWrap())
      }

      extensions.push(
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        markdown(),
        criticMarkupField,
        commentHighlightField,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.updateListener.of(handleUpdate),
        EditorView.lineWrapping
      )

      if (readOnly) {
        extensions.push(EditorState.readOnly.of(true))
        extensions.push(EditorView.editable.of(false))
      }

      const state = EditorState.create({
        doc: initialContent,
        extensions,
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view

      return () => {
        view.destroy()
        viewRef.current = null
      }
      // Only re-create editor when readOnly or reviewerMode changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly, reviewerMode])

    // Update comment highlights when comments change
    useEffect(() => {
      const view = viewRef.current
      if (view) {
        view.dispatch({
          effects: setCommentsEffect.of(comments),
        })
      }
    }, [comments])

    return (
      <div
        ref={containerRef}
        className={`border border-[var(--border)] rounded-lg overflow-hidden ${className}`}
        role="textbox"
        aria-label="Markdown editor"
        aria-readonly={readOnly}
      />
    )
  }
)

export default CodeMirrorEditor
