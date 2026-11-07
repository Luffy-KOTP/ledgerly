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

export default async function Legal(props: PageProps<'/legal/[slug]'>) {
  const { slug } = await props.params
  if (!DOCS.includes(slug)) notFound() // whitelist: never read arbitrary paths
  return <article className="prose mx-auto max-w-3xl dark:prose-invert"><ReactMarkdown>{await read(slug)}</ReactMarkdown></article>
}
