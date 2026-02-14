/**
 * CriticMarkup Resolver
 *
 * Handles accepting and rejecting CriticMarkup changes in documents.
 */

import { parseChanges } from './parser'
import { ChangeType, ApplyChangesResult, ChangeResolutionOptions } from './types'

/**
 * Accepts specified changes - removes markup and keeps the new/replacement text
 *
 * @param content - The document content
 * @param options - Options specifying which changes to accept
 * @returns Result with new content and summary
 */
export function acceptChanges(
  content: string,
  options: ChangeResolutionOptions
): ApplyChangesResult {
  const { changes } = parseChanges(content)

  // Determine which changes to process
  let changesToProcess = changes
  if (!options.all && options.changeIds && options.changeIds.length > 0) {
    const idSet = new Set(options.changeIds)
    changesToProcess = changes.filter((c) => idSet.has(c.id))
  }

  if (changesToProcess.length === 0) {
    return {
      content,
      changesProcessed: 0,
      summary: 'No changes to accept.',
    }
  }

  // Sort in reverse order to process from end to beginning
  // This way offsets don't shift as we make replacements
  const sortedChanges = [...changesToProcess].sort(
    (a, b) => b.position.startOffset - a.position.startOffset
  )

  let newContent = content
  const typeCounts = { addition: 0, deletion: 0, substitution: 0 }

  for (const change of sortedChanges) {
    const before = newContent.slice(0, change.position.startOffset)
    const after = newContent.slice(change.position.endOffset)

    switch (change.type) {
      case ChangeType.ADDITION:
        // Accept addition: keep the added text
        newContent = before + (change.replacement || '') + after
        typeCounts.addition++
        break
      case ChangeType.DELETION:
        // Accept deletion: remove the deleted text (keep nothing)
        newContent = before + after
        typeCounts.deletion++
        break
      case ChangeType.SUBSTITUTION:
        // Accept substitution: keep the replacement text
        newContent = before + (change.replacement || '') + after
        typeCounts.substitution++
        break
    }
  }

  // Build summary
  const summaryParts: string[] = []
  if (typeCounts.addition > 0) {
    summaryParts.push(`${typeCounts.addition} addition${typeCounts.addition !== 1 ? 's' : ''}`)
  }
  if (typeCounts.deletion > 0) {
    summaryParts.push(`${typeCounts.deletion} deletion${typeCounts.deletion !== 1 ? 's' : ''}`)
  }
  if (typeCounts.substitution > 0) {
    summaryParts.push(
      `${typeCounts.substitution} substitution${typeCounts.substitution !== 1 ? 's' : ''}`
    )
  }

  return {
    content: newContent,
    changesProcessed: changesToProcess.length,
    summary: `Accepted ${summaryParts.join(', ')}.`,
  }
}

/**
 * Rejects specified changes - removes markup and keeps the original text
 *
 * @param content - The document content
 * @param options - Options specifying which changes to reject
 * @returns Result with new content and summary
 */
export function rejectChanges(
  content: string,
  options: ChangeResolutionOptions
): ApplyChangesResult {
  const { changes } = parseChanges(content)

  // Determine which changes to process
  let changesToProcess = changes
  if (!options.all && options.changeIds && options.changeIds.length > 0) {
    const idSet = new Set(options.changeIds)
    changesToProcess = changes.filter((c) => idSet.has(c.id))
  }

  if (changesToProcess.length === 0) {
    return {
      content,
      changesProcessed: 0,
      summary: 'No changes to reject.',
    }
  }

  // Sort in reverse order to process from end to beginning
  const sortedChanges = [...changesToProcess].sort(
    (a, b) => b.position.startOffset - a.position.startOffset
  )

  let newContent = content
  const typeCounts = { addition: 0, deletion: 0, substitution: 0 }

  for (const change of sortedChanges) {
    const before = newContent.slice(0, change.position.startOffset)
    const after = newContent.slice(change.position.endOffset)

    switch (change.type) {
      case ChangeType.ADDITION:
        // Reject addition: remove the added text (keep nothing)
        newContent = before + after
        typeCounts.addition++
        break
      case ChangeType.DELETION:
        // Reject deletion: keep the original deleted text
        newContent = before + (change.original || '') + after
        typeCounts.deletion++
        break
      case ChangeType.SUBSTITUTION:
        // Reject substitution: keep the original text
        newContent = before + (change.original || '') + after
        typeCounts.substitution++
        break
    }
  }

  // Build summary
  const summaryParts: string[] = []
  if (typeCounts.addition > 0) {
    summaryParts.push(`${typeCounts.addition} addition${typeCounts.addition !== 1 ? 's' : ''}`)
  }
  if (typeCounts.deletion > 0) {
    summaryParts.push(`${typeCounts.deletion} deletion${typeCounts.deletion !== 1 ? 's' : ''}`)
  }
  if (typeCounts.substitution > 0) {
    summaryParts.push(
      `${typeCounts.substitution} substitution${typeCounts.substitution !== 1 ? 's' : ''}`
    )
  }

  return {
    content: newContent,
    changesProcessed: changesToProcess.length,
    summary: `Rejected ${summaryParts.join(', ')}.`,
  }
}
