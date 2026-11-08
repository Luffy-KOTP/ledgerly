import { Suspense } from 'react'
import Link from 'next/link'
import Landing from '@/components/Landing'
import { getAirlines } from '@/lib/public-data'

// The airline list is read at request time inside Suspense, so building the site never depends on the database being reachable.
async function AirlineList() {
  let airlines
  try { airlines = await getAirlines() } catch (e) { return <p className="text-sm text-red-600">We couldn&apos;t load the airline list. Please try again shortly.{process.env.NODE_ENV !== 'production' && <><br /><code>{e instanceof Error ? e.message : String(e)}</code></>}</p> }
  if (airlines.length === 0) return <p className="text-sm text-muted">No airlines are listed yet.</p>
  return <>{airlines.map((a) => <Link key={a.id} href={`/submit?airline=${a.slug}`} className="rounded-lg border bg-card p-4 transition hover:-translate-y-1 hover:shadow-lg"><b>{a.name}</b><p className="text-xs text-muted">{a.industry}</p><p className="mt-2 text-sm">★ {a.avg_rating} ({a.review_count})</p></Link>)}</>
}

export default function Home() {
  return <Landing airlines={<Suspense fallback={<p className="text-sm text-muted">Loading airlines…</p>}><AirlineList /></Suspense>} />
}
