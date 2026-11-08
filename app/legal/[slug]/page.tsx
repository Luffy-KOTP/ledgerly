import { Suspense } from 'react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

const DOCS = ['terms', 'privacy', 'refunds', 'cookies', 'lawyer-terms', 'airline-terms']
export function generateStaticParams() { return DOCS.map((slug) => ({ slug })) }

async function read(slug: string) {
  'use cache'
  return fs.readFile(path.join(process.cwd(), 'content/legal', `${slug}.md`), 'utf8')
}

// params is read inside Suspense so the page shell can be shown instantly (required by Cache Components).
async function Doc({ params }: { params: PageProps<'/legal/[slug]'>['params'] }) {
  const { slug } = await params
  if (!DOCS.includes(slug)) notFound() // whitelist: never read arbitrary paths
  return <article className="prose mx-auto max-w-3xl dark:prose-invert"><ReactMarkdown>{await read(slug)}</ReactMarkdown></article>
}
export default function Legal(props: PageProps<'/legal/[slug]'>) {
  return <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><Doc params={props.params} /></Suspense>
}
