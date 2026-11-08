'use client'
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-8 text-center"><h1 className="text-xl font-bold">Something went wrong</h1><p className="text-sm text-muted">We hit an unexpected problem. Please try again. If it keeps happening, come back in a few minutes.</p><button onClick={reset} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>
}
