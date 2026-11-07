import { Suspense } from 'react'
import TrackForm from '@/components/TrackForm'
import LegalPanel from '@/components/LegalPanel'
import { getGuest } from '@/lib/guest'
import { supabaseAdmin } from '@/lib/supabase/admin'
const fmt = (t: string) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
async function TrackBody() {
  const g = await getGuest('track')
  const { data: c } = g?.ref ? await supabaseAdmin().from('complaints').select('id,ref,subject,status,is_critical,airline_response,created_at,resolved_at,flight_number,customer_email,airlines(name)').eq('ref', g.ref).maybeSingle() : { data: null }
  if (!g || !c || c.customer_email !== g.email) return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Track a complaint</h1><p className="text-sm text-muted">We send a one-time code to the email on file. The reference alone never reveals a complaint.</p></div><TrackForm /></div>
  const db = supabaseAdmin()
  const { data: ks } = await db.from('legal_cases').select('id,ref,status,service,grade,total_kobo,fee_kobo,accept_by,lawyers(full_name,firm)').eq('complaint_id', c.id).order('created_at', { ascending: false }).limit(1)
  const k = ks?.[0] as unknown as (Record<string, unknown> & { id: string; lawyers: { full_name: string; firm: string | null } | null }) | undefined
  const { data: msgs } = k ? await db.from('case_messages').select('sender,body,created_at').eq('case_id', k.id).order('created_at') : { data: [] }
  const kase = k ? ({ ...k, lawyer: k.lawyers ? { name: k.lawyers.full_name, firm: k.lawyers.firm } : null } as unknown as Parameters<typeof LegalPanel>[0]['kase']) : null
  const airline = (c.airlines as unknown as { name: string } | null)?.name ?? 'the airline', st = c.status
  const steps: [string, string, boolean][] = [
    ['Complaint submitted', fmt(c.created_at), true],
    [c.is_critical ? 'Safety incident flagged: airline alerted instantly' : `Received by ${airline}`, fmt(c.created_at), true],
    ['Under review', st === 'pending' ? `Waiting for ${airline} to pick this up` : `In progress with ${airline}`, st !== 'pending'],
    ['Resolution', st === 'resolved' && c.resolved_at ? `Resolved ${fmt(c.resolved_at)}` : 'Awaiting outcome', st === 'resolved'],
  ]
  return (
    <div className="space-y-4"><div className="space-y-4 rounded-xl border bg-card p-5">
      <p className="text-xs text-muted">{c.ref} · {airline} · flight {c.flight_number}</p>
      <h1 className="text-xl font-bold">{c.subject} <span className="ml-2 rounded-full bg-hover px-2 py-0.5 text-xs">{st.replace('_', ' ')}</span></h1>
      <ol className="ml-2 space-y-4 border-l-2 pl-4 text-sm">{steps.map(([t, d, ok]) => <li key={t} className={ok ? '' : 'opacity-60'}><b>{ok ? '● ' : '○ '}{t}</b><br /><span className="text-muted">{d}</span></li>)}</ol>
      <div className="rounded-lg border p-3 text-sm"><b>Latest update</b><p className="mt-1">{c.airline_response || (st === 'resolved' ? 'Your complaint has been resolved.' : `Your complaint is with ${airline}. This page updates as they respond.`)}</p></div>
    </div>
    <LegalPanel kase={kase} messages={(msgs ?? []) as Parameters<typeof LegalPanel>[0]['messages']} />
    </div>
  )
}

export default function Track() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><TrackBody /></Suspense>
}
