import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma/client'
import { authenticate, createErrorResponse, AuthErrors, UserRole } from '@/lib/auth'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { preprocessCriticMarkup, remarkCriticMarkup } from '@/lib/criticmarkup'

const prisma = new PrismaClient()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Render Markdown to HTML string (server-side version).
 */
async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const preprocessed = preprocessCriticMarkup(markdown)

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCriticMarkup)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(preprocessed)

  return String(result)
}

/**
 * Generate a complete HTML document for PDF rendering.
 */
function generateHtmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-top: 0; margin-bottom: 16px; }
    code {
      background-color: #f6f8fa;
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }
    pre {
      background-color: #f6f8fa;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      border-radius: 3px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      margin: 0;
      padding: 0 1em;
      color: #6a737d;
      border-left: 0.25em solid #dfe2e5;
    }
    ul, ol {
      padding-left: 2em;
      margin-top: 0;
      margin-bottom: 16px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    table th, table td {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    img {
      max-width: 100%;
      box-sizing: border-box;
    }
    ins {
      background-color: #acf2bd;
      text-decoration: none;
    }
    del {
      background-color: #fdb8c0;
      text-decoration: line-through;
    }
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${bodyHtml}
</body>
</html>`
}

/**
 * GET /api/documents/:id/download
 * Downloads the document as a .md or .pdf file.
 * Requires Owner or Reviewer token.
 *
 * Query parameters:
 * - format: 'md' (default) or 'pdf'
 *
 * Returns the document content with Content-Disposition header
 * to trigger a file download in the browser.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'md'

    // Validate format parameter
    if (format !== 'md' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'INVALID_FORMAT', message: 'Format must be "md" or "pdf"' },
        { status: 400 }
      )
    }

    // Authenticate user (owner or reviewer)
    const auth = await authenticate(request, id)

    // Fetch document
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        contentRaw: true,
        status: true,
      },
    })

    if (!document) {
      throw AuthErrors.documentNotFound()
    }

    // Check if document is in draft and user is a reviewer (not allowed)
    if (document.status === 'draft' && auth.role === UserRole.REVIEWER) {
      throw AuthErrors.documentNotInReview()
    }

    // Sanitize filename: remove/replace characters that are problematic in filenames
    const sanitizedTitle =
      document.title
        .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid filename chars
        .replace(/\s+/g, '_') // Replace whitespace with underscores
        .substring(0, 200) || // Limit length
      'document'

    if (format === 'pdf') {
      // Generate PDF using Puppeteer
      const puppeteer = await import('puppeteer')
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      try {
        const page = await browser.newPage()

        // Render markdown to HTML
        const bodyHtml = await renderMarkdownToHtml(document.contentRaw)
        const fullHtml = generateHtmlDocument(document.title, bodyHtml)

        // Set the HTML content
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' })

        // Generate PDF
        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm',
          },
          printBackground: true,
        })

        const filename = `${sanitizedTitle}.pdf`

        return new NextResponse(Buffer.from(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      } finally {
        await browser.close()
      }
    }

    // Default: Return the markdown content as a downloadable file
    const filename = `${sanitizedTitle}.md`

    return new NextResponse(document.contentRaw, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}
