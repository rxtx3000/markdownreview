/**
 * Markdown Renderer
 *
 * Client-side markdown rendering pipeline using remark and DOMPurify.
 * Supports CriticMarkup syntax via preprocessor.
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { preprocessCriticMarkup, remarkCriticMarkup } from './criticmarkup'

/**
 * Render Markdown to sanitized HTML string.
 * CriticMarkup is transformed to styled HTML elements.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  // Preprocess CriticMarkup before remark parsing
  const preprocessed = preprocessCriticMarkup(markdown)

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCriticMarkup)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(preprocessed)

  const html = String(result)

  // Replace mermaid code blocks with placeholder divs that have class-based markers
  const htmlWithMermaid = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code) => {
      return `<div class="mermaid-diagram"><pre class="mermaid-source"><code>${code}</code></pre></div>`
    }
  )

  // Sanitize on the client side using DOMPurify (imported dynamically)
  if (typeof window !== 'undefined') {
    const DOMPurify = (await import('isomorphic-dompurify')).default
    return DOMPurify.sanitize(htmlWithMermaid, {
      ADD_TAGS: ['ins', 'del'],
      ADD_ATTR: ['class'],
    })
  }

  return htmlWithMermaid
}
