/**
 * CriticMarkup Library
 *
 * This module provides utilities for parsing, rendering, and resolving
 * CriticMarkup syntax in Markdown documents.
 *
 * Supported CriticMarkup constructs:
 * - Additions: {++ text ++}
 * - Deletions: {-- text --}
 * - Substitutions: {~~ original ~> replacement ~~}
 */

// Types
export type {
  ChangeType,
  CriticMarkupChange,
  ChangePosition,
  ParseResult,
  ChangeResolutionOptions,
  ApplyChangesResult,
} from './types'

export { ChangeType as ChangeTypeEnum } from './types'

// Parser functions
export { parseChanges, hasUnresolvedChanges, getChangeById } from './parser'

// Resolver functions
export { acceptChanges, rejectChanges } from './resolver'

// Remark plugin and preprocessor
export { remarkCriticMarkup, preprocessCriticMarkup } from './remark-plugin'
