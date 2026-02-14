/**
 * Unit tests for CriticMarkup Resolver
 *
 * Tests accepting and rejecting CriticMarkup changes.
 */

import { acceptChanges, rejectChanges } from '../resolver'
import { parseChanges } from '../parser'

describe('CriticMarkup Resolver', () => {
  describe('acceptChanges', () => {
    describe('additions', () => {
      it('should accept a single addition', () => {
        const content = 'Hello {++world++}!'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('Hello world!')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 addition')
      })

      it('should accept multiple additions', () => {
        const content = '{++First++} and {++second++}'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('First and second')
        expect(result.changesProcessed).toBe(2)
        expect(result.summary).toContain('2 additions')
      })
    })

    describe('deletions', () => {
      it('should accept a single deletion (removes the text)', () => {
        const content = 'Hello {--world--}!'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('Hello !')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 deletion')
      })

      it('should accept multiple deletions', () => {
        const content = '{--Remove--} this {--text--}'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe(' this ')
        expect(result.changesProcessed).toBe(2)
      })
    })

    describe('substitutions', () => {
      it('should accept a single substitution (keeps replacement)', () => {
        const content = 'Hello {~~world~>universe~~}!'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('Hello universe!')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 substitution')
      })

      it('should accept multiple substitutions', () => {
        const content = '{~~old~>new~~} and {~~was~>is~~}'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('new and is')
        expect(result.changesProcessed).toBe(2)
      })
    })

    describe('mixed changes', () => {
      it('should accept all types of changes together', () => {
        const content = 'Added {++new++}, deleted {--old--}, replaced {~~was~>is~~}.'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('Added new, deleted , replaced is.')
        expect(result.changesProcessed).toBe(3)
        expect(result.summary).toContain('addition')
        expect(result.summary).toContain('deletion')
        expect(result.summary).toContain('substitution')
      })
    })

    describe('selective acceptance', () => {
      it('should accept only specified changes by ID', () => {
        const content = '{++first++} {++second++} {++third++}'
        const { changes } = parseChanges(content)

        // Accept only the middle change
        const result = acceptChanges(content, { changeIds: [changes[1].id] })

        expect(result.content).toBe('{++first++} second {++third++}')
        expect(result.changesProcessed).toBe(1)
      })

      it('should accept multiple specified changes', () => {
        const content = '{++first++} {++second++} {++third++}'
        const { changes } = parseChanges(content)

        const result = acceptChanges(content, {
          changeIds: [changes[0].id, changes[2].id],
        })

        expect(result.content).toBe('first {++second++} third')
        expect(result.changesProcessed).toBe(2)
      })

      it('should handle non-existent change IDs gracefully', () => {
        const content = '{++first++}'
        const result = acceptChanges(content, { changeIds: ['non-existent'] })

        expect(result.content).toBe('{++first++}')
        expect(result.changesProcessed).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('should handle document with no changes', () => {
        const content = 'No changes here'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('No changes here')
        expect(result.changesProcessed).toBe(0)
        expect(result.summary).toBe('No changes to accept.')
      })

      it('should handle empty document', () => {
        const result = acceptChanges('', { all: true })

        expect(result.content).toBe('')
        expect(result.changesProcessed).toBe(0)
      })

      it('should handle multi-line changes', () => {
        const content = 'Start\n{++line one\nline two++}\nEnd'
        const result = acceptChanges(content, { all: true })

        expect(result.content).toBe('Start\nline one\nline two\nEnd')
      })
    })
  })

  describe('rejectChanges', () => {
    describe('additions', () => {
      it('should reject a single addition (removes the added text)', () => {
        const content = 'Hello {++world++}!'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('Hello !')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 addition')
      })

      it('should reject multiple additions', () => {
        const content = '{++First++} and {++second++}'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe(' and ')
        expect(result.changesProcessed).toBe(2)
      })
    })

    describe('deletions', () => {
      it('should reject a single deletion (keeps the original text)', () => {
        const content = 'Hello {--world--}!'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('Hello world!')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 deletion')
      })

      it('should reject multiple deletions', () => {
        const content = '{--Keep--} this {--text--}'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('Keep this text')
        expect(result.changesProcessed).toBe(2)
      })
    })

    describe('substitutions', () => {
      it('should reject a single substitution (keeps original)', () => {
        const content = 'Hello {~~world~>universe~~}!'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('Hello world!')
        expect(result.changesProcessed).toBe(1)
        expect(result.summary).toContain('1 substitution')
      })

      it('should reject multiple substitutions', () => {
        const content = '{~~old~>new~~} and {~~was~>is~~}'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('old and was')
        expect(result.changesProcessed).toBe(2)
      })
    })

    describe('mixed changes', () => {
      it('should reject all types of changes together', () => {
        const content = 'Added {++new++}, deleted {--old--}, replaced {~~was~>is~~}.'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('Added , deleted old, replaced was.')
        expect(result.changesProcessed).toBe(3)
      })
    })

    describe('selective rejection', () => {
      it('should reject only specified changes by ID', () => {
        const content = '{++first++} {++second++} {++third++}'
        const { changes } = parseChanges(content)

        const result = rejectChanges(content, { changeIds: [changes[1].id] })

        expect(result.content).toBe('{++first++}  {++third++}')
        expect(result.changesProcessed).toBe(1)
      })

      it('should handle non-existent change IDs gracefully', () => {
        const content = '{++first++}'
        const result = rejectChanges(content, { changeIds: ['non-existent'] })

        expect(result.content).toBe('{++first++}')
        expect(result.changesProcessed).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('should handle document with no changes', () => {
        const content = 'No changes here'
        const result = rejectChanges(content, { all: true })

        expect(result.content).toBe('No changes here')
        expect(result.changesProcessed).toBe(0)
        expect(result.summary).toBe('No changes to reject.')
      })

      it('should handle empty document', () => {
        const result = rejectChanges('', { all: true })

        expect(result.content).toBe('')
        expect(result.changesProcessed).toBe(0)
      })
    })
  })

  describe('integration scenarios', () => {
    it('should leave document unchanged after accept if no changes', () => {
      const original = 'Clean document with no markup'
      const result = acceptChanges(original, { all: true })

      expect(result.content).toBe(original)
    })

    it('should handle complex document with nested formatting', () => {
      const content = `# Title

This is {++**bold added**++} text.

- List item {--removed--}
- Another {~~old item~>new item~~}
`

      const accepted = acceptChanges(content, { all: true })

      expect(accepted.content).toContain('**bold added**')
      expect(accepted.content).not.toContain('{++')
      expect(accepted.content).not.toContain('removed')
      expect(accepted.content).toContain('new item')
      expect(accepted.content).not.toContain('old item')
    })

    it('should handle adjacent changes correctly', () => {
      const content = '{++A++}{++B++}{++C++}'
      const result = acceptChanges(content, { all: true })

      expect(result.content).toBe('ABC')
    })

    it('should process changes in correct order', () => {
      // This tests that reverse-order processing works correctly
      const content = 'Start {++middle++} end {++last++}'
      const result = acceptChanges(content, { all: true })

      expect(result.content).toBe('Start middle end last')
    })
  })
})
