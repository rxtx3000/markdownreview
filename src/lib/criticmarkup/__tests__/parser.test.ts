/**
 * Unit tests for CriticMarkup Parser
 *
 * Tests parsing of CriticMarkup syntax including additions, deletions, and substitutions.
 */

import { parseChanges, hasUnresolvedChanges, getChangeById } from '../parser'
import { ChangeType } from '../types'

describe('CriticMarkup Parser', () => {
  describe('parseChanges', () => {
    describe('additions', () => {
      it('should parse a simple addition', () => {
        const content = 'Hello {++world++}!'
        const result = parseChanges(content)

        expect(result.hasUnresolvedChanges).toBe(true)
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].type).toBe(ChangeType.ADDITION)
        expect(result.changes[0].replacement).toBe('world')
        expect(result.changes[0].original).toBeNull()
        expect(result.changes[0].rawMarkup).toBe('{++world++}')
      })

      it('should parse multiple additions', () => {
        const content = '{++First++} and {++second++} additions'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(2)
        expect(result.changes[0].replacement).toBe('First')
        expect(result.changes[1].replacement).toBe('second')
      })

      it('should handle addition with whitespace', () => {
        const content = 'Some {++ added text with spaces ++} here'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].replacement).toBe(' added text with spaces ')
      })

      it('should handle multi-line additions', () => {
        const content = 'Start {++line one\nline two++} end'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].replacement).toBe('line one\nline two')
        expect(result.changes[0].position.startLine).toBe(1)
        expect(result.changes[0].position.endLine).toBe(2)
      })
    })

    describe('deletions', () => {
      it('should parse a simple deletion', () => {
        const content = 'Hello {--world--}!'
        const result = parseChanges(content)

        expect(result.hasUnresolvedChanges).toBe(true)
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].type).toBe(ChangeType.DELETION)
        expect(result.changes[0].original).toBe('world')
        expect(result.changes[0].replacement).toBeNull()
        expect(result.changes[0].rawMarkup).toBe('{--world--}')
      })

      it('should parse multiple deletions', () => {
        const content = '{--First--} and {--second--} deletions'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(2)
        expect(result.changes[0].original).toBe('First')
        expect(result.changes[1].original).toBe('second')
      })

      it('should handle deletion with special characters', () => {
        const content = 'Remove {--this **bold** text--} here'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].original).toBe('this **bold** text')
      })
    })

    describe('substitutions', () => {
      it('should parse a simple substitution', () => {
        const content = 'Hello {~~world~>universe~~}!'
        const result = parseChanges(content)

        expect(result.hasUnresolvedChanges).toBe(true)
        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].type).toBe(ChangeType.SUBSTITUTION)
        expect(result.changes[0].original).toBe('world')
        expect(result.changes[0].replacement).toBe('universe')
        expect(result.changes[0].rawMarkup).toBe('{~~world~>universe~~}')
      })

      it('should handle substitution with whitespace', () => {
        const content = 'Change {~~ old text ~> new text ~~} here'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].original).toBe(' old text ')
        expect(result.changes[0].replacement).toBe(' new text ')
      })

      it('should handle multi-line substitution', () => {
        const content = 'Replace {~~old\ntext~>new\ntext~~} done'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(1)
        expect(result.changes[0].original).toBe('old\ntext')
        expect(result.changes[0].replacement).toBe('new\ntext')
      })
    })

    describe('mixed changes', () => {
      it('should parse document with all change types', () => {
        const content = 'Added {++new++}, deleted {--old--}, replaced {~~was~>is~~}.'
        const result = parseChanges(content)

        expect(result.changes).toHaveLength(3)
        expect(result.changes[0].type).toBe(ChangeType.ADDITION)
        expect(result.changes[1].type).toBe(ChangeType.DELETION)
        expect(result.changes[2].type).toBe(ChangeType.SUBSTITUTION)
      })

      it('should sort changes by position', () => {
        const content = '{--third--} {++first++} {~~second~>replaced~~}'
        const result = parseChanges(content)

        // All three changes should be sorted by their start offset
        expect(result.changes).toHaveLength(3)
        expect(result.changes[0].position.startOffset).toBeLessThan(
          result.changes[1].position.startOffset
        )
        expect(result.changes[1].position.startOffset).toBeLessThan(
          result.changes[2].position.startOffset
        )
      })
    })

    describe('code blocks - changes are tracked everywhere', () => {
      it('should parse CriticMarkup inside fenced code blocks', () => {
        const content = `# Document

\`\`\`javascript
const x = {++value++};
\`\`\`

Real {++addition++} here`

        const result = parseChanges(content)

        // Both changes should be detected - the one inside and outside code block
        expect(result.changes).toHaveLength(2)
        expect(result.changes[0].replacement).toBe('value')
        expect(result.changes[1].replacement).toBe('addition')
      })

      it('should parse CriticMarkup inside inline code', () => {
        const content = 'Use `{++this++}` syntax, not {++that++}'
        const result = parseChanges(content)

        // Both changes should be detected
        expect(result.changes).toHaveLength(2)
        expect(result.changes[0].replacement).toBe('this')
        expect(result.changes[1].replacement).toBe('that')
      })

      it('should parse CriticMarkup in indented code blocks', () => {
        const content = `Normal text

    {++indented code++}

{++real addition++}`

        const result = parseChanges(content)

        // Both changes should be detected
        expect(result.changes).toHaveLength(2)
        expect(result.changes[0].replacement).toBe('indented code')
        expect(result.changes[1].replacement).toBe('real addition')
      })
    })

    describe('empty and edge cases', () => {
      it('should return empty changes for document without CriticMarkup', () => {
        const content = 'Just regular markdown content.'
        const result = parseChanges(content)

        expect(result.hasUnresolvedChanges).toBe(false)
        expect(result.changes).toHaveLength(0)
      })

      it('should handle empty document', () => {
        const result = parseChanges('')

        expect(result.hasUnresolvedChanges).toBe(false)
        expect(result.changes).toHaveLength(0)
      })

      it('should handle malformed markup (incomplete)', () => {
        const content = 'Incomplete {++ addition without closing'
        const result = parseChanges(content)

        // Malformed markup should not be parsed
        expect(result.changes).toHaveLength(0)
      })

      it('should generate unique IDs for each change', () => {
        const content = '{++a++} {++b++} {++c++}'
        const result = parseChanges(content)

        const ids = result.changes.map((c) => c.id)
        const uniqueIds = new Set(ids)

        expect(uniqueIds.size).toBe(3)
      })
    })

    describe('position tracking', () => {
      it('should track correct line numbers', () => {
        const content = `Line 1
Line 2 {++added++}
Line 3`

        const result = parseChanges(content)

        expect(result.changes[0].position.startLine).toBe(2)
        expect(result.changes[0].position.endLine).toBe(2)
      })

      it('should track correct offsets', () => {
        const content = 'Hello {++world++}!'
        const result = parseChanges(content)

        expect(result.changes[0].position.startOffset).toBe(6)
        expect(result.changes[0].position.endOffset).toBe(17)
      })
    })
  })

  describe('hasUnresolvedChanges', () => {
    it('should return true when document has changes', () => {
      expect(hasUnresolvedChanges('Has {++change++}')).toBe(true)
      expect(hasUnresolvedChanges('Has {--deletion--}')).toBe(true)
      expect(hasUnresolvedChanges('Has {~~sub~>stitution~~}')).toBe(true)
    })

    it('should return false when document has no changes', () => {
      expect(hasUnresolvedChanges('No changes here')).toBe(false)
      expect(hasUnresolvedChanges('')).toBe(false)
    })
  })

  describe('getChangeById', () => {
    it('should find a change by its ID', () => {
      const content = '{++first++} {++second++}'
      const result = parseChanges(content)
      const firstId = result.changes[0].id

      const found = getChangeById(content, firstId)

      expect(found).not.toBeNull()
      expect(found?.replacement).toBe('first')
    })

    it('should return null for non-existent ID', () => {
      const content = '{++first++}'
      const found = getChangeById(content, 'non-existent-id')

      expect(found).toBeNull()
    })
  })
})
