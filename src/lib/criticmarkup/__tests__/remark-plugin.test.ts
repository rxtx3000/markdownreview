/**
 * Unit tests for Remark CriticMarkup Plugin
 *
 * Tests HTML transformation of CriticMarkup syntax.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import { preprocessCriticMarkup, remarkCriticMarkup } from '../remark-plugin'

/**
 * Helper function to process markdown with the CriticMarkup plugin
 * Uses rehype-raw to properly handle the inline HTML we inject
 */
async function processMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkCriticMarkup)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(preprocessCriticMarkup(markdown))

  return String(result)
}

describe('Remark CriticMarkup Plugin', () => {
  describe('additions', () => {
    it('should transform additions to <ins> elements', async () => {
      const markdown = 'Hello {++world++}!'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<ins class="critic-addition">world</ins>')
    })

    it('should handle multiple additions', async () => {
      const markdown = '{++First++} and {++second++}'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<ins class="critic-addition">First</ins>')
      expect(html).toContain('<ins class="critic-addition">second</ins>')
    })

    it('should escape HTML in additions', async () => {
      const markdown = 'Add {++<script>alert("xss")</script>++}'
      const html = await processMarkdown(markdown)

      // The < and > should be escaped (either as &lt;/&gt; or &#x3C;/&#x3E;)
      // Most importantly, the raw <script> tag should NOT be present
      expect(html).not.toMatch(/<script[^>]*>/i)
      expect(html).toContain('ins class="critic-addition"')
      // Verify the content is still there but escaped
      expect(html).toMatch(/alert\("xss"\)/)
    })
  })

  describe('deletions', () => {
    it('should transform deletions to <del> elements', async () => {
      const markdown = 'Hello {--world--}!'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<del class="critic-deletion">world</del>')
    })

    it('should handle multiple deletions', async () => {
      const markdown = '{--First--} and {--second--}'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<del class="critic-deletion">First</del>')
      expect(html).toContain('<del class="critic-deletion">second</del>')
    })
  })

  describe('substitutions', () => {
    it('should transform substitutions to <del> + <ins> elements', async () => {
      const markdown = 'Hello {~~world~>universe~~}!'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<del class="critic-substitution-del">world</del>')
      expect(html).toContain('<ins class="critic-substitution-ins">universe</ins>')
    })

    it('should handle multiple substitutions', async () => {
      const markdown = '{~~old~>new~~} and {~~was~>is~~}'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<del class="critic-substitution-del">old</del>')
      expect(html).toContain('<ins class="critic-substitution-ins">new</ins>')
      expect(html).toContain('<del class="critic-substitution-del">was</del>')
      expect(html).toContain('<ins class="critic-substitution-ins">is</ins>')
    })
  })

  describe('mixed changes', () => {
    it('should handle all change types together', async () => {
      const markdown = 'Added {++new++}, deleted {--old--}, replaced {~~was~>is~~}.'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<ins class="critic-addition">new</ins>')
      expect(html).toContain('<del class="critic-deletion">old</del>')
      expect(html).toContain('<del class="critic-substitution-del">was</del>')
      expect(html).toContain('<ins class="critic-substitution-ins">is</ins>')
    })
  })

  describe('code blocks', () => {
    it('should preserve CriticMarkup in fenced code blocks', async () => {
      const markdown = `\`\`\`
{++code++}
\`\`\``
      const html = await processMarkdown(markdown)

      // In code blocks, the markup should be preserved as-is
      expect(html).toContain('{++code++}')
      expect(html).not.toContain('<ins class="critic-addition">')
    })

    it('should preserve CriticMarkup in inline code', async () => {
      const markdown = 'Use `{++code++}` syntax'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<code>{++code++}</code>')
      expect(html).not.toContain('<ins class="critic-addition">')
    })
  })

  describe('no changes', () => {
    it('should pass through normal markdown unchanged', async () => {
      const markdown = '# Hello World\n\nThis is a paragraph.'
      const html = await processMarkdown(markdown)

      expect(html).toContain('<h1>Hello World</h1>')
      expect(html).toContain('<p>This is a paragraph.</p>')
    })
  })

  describe('XSS protection', () => {
    it('should escape special characters in all change types', async () => {
      const markdown = `
{++<img src=x onerror=alert(1)>++}
{--<script>bad()</script>--}
{~~<div onclick="evil()">~><span>safe</span>~~}
`
      const html = await processMarkdown(markdown)

      // Verify dangerous HTML tags are NOT present as raw tags
      expect(html).not.toMatch(/<img[^>]*onerror/i)
      expect(html).not.toMatch(/<script[^>]*>/i)
      expect(html).not.toMatch(/<div[^>]*onclick/i)

      // Verify the CriticMarkup was transformed
      expect(html).toContain('ins class="critic-addition"')
      expect(html).toContain('del class="critic-deletion"')
      expect(html).toContain('critic-substitution')
    })
  })
})
