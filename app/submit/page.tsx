import { Suspense } from 'react'
import SubmitFlow from '@/components/SubmitFlow'
import { getAirlines } from '@/lib/public-data'

// searchParams is runtime data, so it is read inside a Suspense boundary (Cache Components).
async function Flow({ searchParams }: { searchParams: PageProps<'/submit'>['searchParams'] }) {
  const sp = await searchParams
  let airlines: { slug: string; name: string }[]
  try { airlines = await getAirlines() } catch (e) { return <p role="alert" className="rounded-xl border bg-card p-6 text-sm text-red-600">We couldn&apos;t load the airline list. Please try again shortly.{process.env.NODE_ENV !== 'production' && <><br /><code>{e instanceof Error ? e.message : String(e)}</code></>}</p> }
  if (airlines.length === 0) return <p className="rounded-xl border bg-card p-6 text-sm">No airline is accepting complaints yet. Airlines register at /signup and must be approved before they appear here.</p>
  return <SubmitFlow airlines={airlines} initial={typeof sp.airline === 'string' ? sp.airline : undefined} />
}
export default function SubmitPage(props: PageProps<'/submit'>) {
  return <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><Flow searchParams={props.searchParams} /></Suspense>
}
