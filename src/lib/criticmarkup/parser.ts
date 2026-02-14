/**
 * CriticMarkup Parser
 *
 * Parses CriticMarkup syntax from Markdown documents.
 * Supports:
 * - Additions: {++ text ++}
 * - Deletions: {-- text --}
 * - Substitutions: {~~ original ~> replacement ~~}
 *
 * Note: Changes are tracked everywhere in the document, including inside code blocks,
 * to ensure reviewer edits are never lost. The remark plugin handles rendering
 * code blocks as literal text in the preview.
 */

import { ChangeType, CriticMarkupChange, ParseResult, ChangePosition } from './types'

// Regular expressions for CriticMarkup patterns
// Using non-greedy matching to handle nested content properly

/** Matches additions: {++ text ++} */
const ADDITION_REGEX = /\{\+\+([^]*?)\+\+\}/g

/** Matches deletions: {-- text --} */
const DELETION_REGEX = /\{--([^]*?)--\}/g

/** Matches substitutions: {~~ original ~> replacement ~~} */
const SUBSTITUTION_REGEX = /\{~~([^]*?)~>([^]*?)~~\}/g

/**
 * Generates a unique ID for a change based on its position and type
 */
function generateChangeId(type: ChangeType, position: ChangePosition): string {
  return `${type}-${position.startOffset}-${position.endOffset}`
}

/**
 * Calculates line numbers for a given offset in the content
 */
function getLineNumber(content: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++
    }
  }
  return line
}

/**
 * Parses a document and extracts all CriticMarkup changes
 */
export function parseChanges(content: string): ParseResult {
  const changes: CriticMarkupChange[] = []

  // Find additions
  let match: RegExpExecArray | null
  const additionRegex = new RegExp(ADDITION_REGEX.source, 'g')
  while ((match = additionRegex.exec(content)) !== null) {
    const position: ChangePosition = {
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      startLine: getLineNumber(content, match.index),
      endLine: getLineNumber(content, match.index + match[0].length - 1),
    }

    changes.push({
      id: generateChangeId(ChangeType.ADDITION, position),
      type: ChangeType.ADDITION,
      original: null,
      replacement: match[1],
      position,
      rawMarkup: match[0],
    })
  }

  // Find deletions
  const deletionRegex = new RegExp(DELETION_REGEX.source, 'g')
  while ((match = deletionRegex.exec(content)) !== null) {
    const position: ChangePosition = {
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      startLine: getLineNumber(content, match.index),
      endLine: getLineNumber(content, match.index + match[0].length - 1),
    }

    changes.push({
      id: generateChangeId(ChangeType.DELETION, position),
      type: ChangeType.DELETION,
      original: match[1],
      replacement: null,
      position,
      rawMarkup: match[0],
    })
  }

  // Find substitutions
  const substitutionRegex = new RegExp(SUBSTITUTION_REGEX.source, 'g')
  while ((match = substitutionRegex.exec(content)) !== null) {
    const position: ChangePosition = {
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      startLine: getLineNumber(content, match.index),
      endLine: getLineNumber(content, match.index + match[0].length - 1),
    }

    changes.push({
      id: generateChangeId(ChangeType.SUBSTITUTION, position),
      type: ChangeType.SUBSTITUTION,
      original: match[1],
      replacement: match[2],
      position,
      rawMarkup: match[0],
    })
  }

  // Sort changes by position (important for processing)
  changes.sort((a, b) => a.position.startOffset - b.position.startOffset)

  return {
    changes,
    hasUnresolvedChanges: changes.length > 0,
  }
}

/**
 * Checks if a document contains any unresolved CriticMarkup changes
 */
export function hasUnresolvedChanges(content: string): boolean {
  return parseChanges(content).hasUnresolvedChanges
}

/**
 * Gets a specific change by ID from the document
 */
export function getChangeById(content: string, changeId: string): CriticMarkupChange | null {
  const { changes } = parseChanges(content)
  return changes.find((c) => c.id === changeId) || null
}
