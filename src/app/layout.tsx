import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MarkdownReview Hub',
  description: 'A web-based collaboration tool for reviewing and editing Markdown documents',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
