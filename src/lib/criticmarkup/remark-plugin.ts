/**
 * Remark CriticMarkup Plugin
 *
 * A remark plugin that transforms CriticMarkup syntax into HTML elements
 * for rendering in the preview pane.
 *
 * Transforms:
 * - {++ text ++} → <ins class="critic-addition">text</ins>
 * - {-- text --} → <del class="critic-deletion">text</del>
 * - {~~ old ~> new ~~} → <del class="critic-substitution-del">old</del><ins class="critic-substitution-ins">new</ins>
 *
 * NOTE: This plugin works as a string preprocessor that runs BEFORE remark parsing.
 * This is necessary because remark-parse interprets the `{` and special characters
 * in CriticMarkup syntax in unexpected ways.
 */

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

/** Matches additions: {++ text ++} */
const ADDITION_REGEX = /\{\+\+([^]*?)\+\+\}/g

/** Matches deletions: {-- text --} */
const DELETION_REGEX = /\{--([^]*?)--\}/g

/** Matches substitutions: {~~ original ~> replacement ~~} */
const SUBSTITUTION_REGEX = /\{~~([^]*?)~>([^]*?)~~\}/g

/** Matches fenced code blocks - used to protect them from transformation */
const FENCED_CODE_BLOCK_REGEX = /^```[^\n]*\n[^]*?^```$/gm

/** Matches inline code - used to protect it from transformation */
const INLINE_CODE_REGEX = /`[^`\n]+`/g

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface ProtectedRegion {
  start: number
  end: number
  content: string
}

/**
 * Find all protected regions (code blocks and inline code) that should not be transformed
 */
function findProtectedRegions(text: string): ProtectedRegion[] {
  const regions: ProtectedRegion[] = []

  // Find fenced code blocks
  let match: RegExpExecArray | null
  const fencedRegex = new RegExp(FENCED_CODE_BLOCK_REGEX.source, 'gm')
  while ((match = fencedRegex.exec(text)) !== null) {
    regions.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
    })
  }

  // Find inline code
  const inlineRegex = new RegExp(INLINE_CODE_REGEX.source, 'g')
  while ((match = inlineRegex.exec(text)) !== null) {
    // Check if this inline code is inside a fenced code block
    const isInsideFenced = regions.some((r) => match!.index >= r.start && match!.index < r.end)
    if (!isInsideFenced) {
      regions.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
      })
    }
  }

  return regions.sort((a, b) => a.start - b.start)
}

/**
 * Transform CriticMarkup in a string, protecting code regions
 */
function transformCriticMarkupInText(text: string): string {
  const protectedRegions = findProtectedRegions(text)

  if (protectedRegions.length === 0) {
    return transformCriticMarkupSegment(text)
  }

  // Build result by processing segments between protected regions
  let result = ''
  let lastEnd = 0

  for (const region of protectedRegions) {
    // Transform the segment before this protected region
    if (region.start > lastEnd) {
      const segment = text.slice(lastEnd, region.start)
      result += transformCriticMarkupSegment(segment)
    }
    // Add the protected region unchanged
    result += region.content
    lastEnd = region.end
  }

  // Transform any remaining segment after the last protected region
  if (lastEnd < text.length) {
    result += transformCriticMarkupSegment(text.slice(lastEnd))
  }

  return result
}

/**
 * Transform CriticMarkup syntax in a text segment to HTML
 */
function transformCriticMarkupSegment(text: string): string {
  let result = text

  // Transform substitutions first (they contain both ~~ and ~>)
  result = result.replace(SUBSTITUTION_REGEX, (_match, original, replacement) => {
    const escapedOriginal = escapeHtml(original)
    const escapedReplacement = escapeHtml(replacement)
    return `<del class="critic-substitution-del">${escapedOriginal}</del><ins class="critic-substitution-ins">${escapedReplacement}</ins>`
  })

  // Transform additions
  result = result.replace(ADDITION_REGEX, (_match, content) => {
    const escapedContent = escapeHtml(content)
    return `<ins class="critic-addition">${escapedContent}</ins>`
  })

  // Transform deletions
  result = result.replace(DELETION_REGEX, (_match, content) => {
    const escapedContent = escapeHtml(content)
    return `<del class="critic-deletion">${escapedContent}</del>`
  })

  return result
}

/**
 * Preprocess markdown source to transform CriticMarkup before parsing.
 * This should be called on the raw markdown string before passing to unified/remark.
 *
 * @param markdown - The raw markdown source
 * @returns Markdown with CriticMarkup transformed to HTML
 */
export function preprocessCriticMarkup(markdown: string): string {
  return transformCriticMarkupInText(markdown)
}

/**
 * The remark-critic-markup plugin
 *
 * This is a no-op plugin because the actual transformation happens in the
 * preprocessCriticMarkup function which should be called before remark parsing.
 *
 * The reason for this design is that remark-parse interprets the CriticMarkup
 * syntax characters (`{`, `+`, `-`, `~`, `>`) in ways that break the markup
 * before our plugin can process it.
 *
 * Usage:
 * ```typescript
 * import { preprocessCriticMarkup, remarkCriticMarkup } from './remark-plugin'
 *
 * const html = await unified()
 *   .use(remarkParse)
 *   .use(remarkCriticMarkup)
 *   .use(remarkHtml, { allowDangerousHtml: true })
 *   .process(preprocessCriticMarkup(markdown))
 * ```
 */
export const remarkCriticMarkup: Plugin<[], Root> = function () {
  // This is intentionally a no-op - the real work is done in preprocessCriticMarkup
  return function (tree: Root) {
    return tree
  }
}

export default remarkCriticMarkup
