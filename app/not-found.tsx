import Link from 'next/link'
export default function NotFound() {
  return <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-8 text-center"><p className="text-4xl font-bold text-sky-600">404</p><h1 className="text-xl font-bold">We could not find that page</h1><p className="text-sm text-muted">The link may be wrong or the page may have moved.</p><div className="flex justify-center gap-2"><Link href="/" className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white">Home</Link><Link href="/track" className="rounded-lg border px-4 py-2 text-sm font-semibold">Track a complaint</Link></div></div>
}
