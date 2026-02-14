/**
 * CriticMarkup Types
 *
 * This module defines the types used by the CriticMarkup parser and renderer.
 */

/**
 * The type of CriticMarkup change
 */
export enum ChangeType {
  ADDITION = 'addition',
  DELETION = 'deletion',
  SUBSTITUTION = 'substitution',
}

/**
 * Position information for a change in the document
 */
export interface ChangePosition {
  /** Start offset in the original document (0-based) */
  startOffset: number
  /** End offset in the original document (0-based, exclusive) */
  endOffset: number
  /** Line number where the change starts (1-based) */
  startLine: number
  /** Line number where the change ends (1-based) */
  endLine: number
}

/**
 * Represents a single CriticMarkup change extracted from a document
 */
export interface CriticMarkupChange {
  /** Unique identifier for this change (generated) */
  id: string
  /** The type of change */
  type: ChangeType
  /** The original text (for deletions and substitutions) */
  original: string | null
  /** The replacement text (for additions and substitutions) */
  replacement: string | null
  /** Position in the document */
  position: ChangePosition
  /** The full raw markup string (e.g., "{++ text ++}") */
  rawMarkup: string
}

/**
 * Result of parsing a document for CriticMarkup changes
 */
export interface ParseResult {
  /** All changes found in the document */
  changes: CriticMarkupChange[]
  /** Whether the document contains any unresolved CriticMarkup */
  hasUnresolvedChanges: boolean
}

/**
 * Options for accepting/rejecting changes
 */
export interface ChangeResolutionOptions {
  /** Specific change IDs to process */
  changeIds?: string[]
  /** Process all changes */
  all?: boolean
}

/**
 * Result of applying changes to a document
 */
export interface ApplyChangesResult {
  /** The new document content with changes applied */
  content: string
  /** Number of changes processed */
  changesProcessed: number
  /** Summary of changes for version history */
  summary: string
}
