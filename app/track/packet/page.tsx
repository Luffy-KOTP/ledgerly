import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import PrintButton from '@/components/PrintButton'
import { getGuest } from '@/lib/guest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NCAA_URL, STATUS_LABEL } from '@/lib/constants'

const dt = (t: string) => new Date(t).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const who: Record<string, string> = { customer: 'Passenger', airline: 'Airline', ledgerly: 'Ledgerly' }

/** A printable record of the whole complaint, for the passenger to attach when complaining to the regulator. Needs the verified /track session. */
async function Packet() {
  await connection()
  const g = await getGuest('track'); if (!g?.ref) redirect('/track')
  const db = supabaseAdmin()
  const { data: c } = await db.from('complaints').select('*, airlines(name)').eq('ref', g.ref).maybeSingle()
  if (!c || c.customer_email !== g.email) redirect('/track')
  const [{ data: msgs }, { data: res }, { data: ev }, { data: files }] = await Promise.all([
    db.from('complaint_messages').select('sender,body,created_at').eq('complaint_id', c.id).order('created_at'),
    db.from('complaint_resolutions').select('kind,details,status,customer_comment,created_at').eq('complaint_id', c.id).order('created_at'),
    db.from('complaint_events').select('detail,created_at').eq('complaint_id', c.id).order('created_at'),
    db.from('attachments').select('file_name').eq('complaint_id', c.id),
  ])
  const airline = (c.airlines as { name: string } | null)?.name ?? ''
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-xl border bg-card p-6 text-sm print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted">Complaint packet</p><h1 className="text-2xl font-bold">{c.ref}</h1></div><PrintButton /></div>
      <p className="text-xs text-muted">Prepared by Ledgerly from the complaint record. Ledgerly is an independent platform and is not part of the Nigerian Civil Aviation Authority. Under Part 19 of the Nigeria Civil Aviation Regulations a passenger may complain to the NCAA&apos;s Consumer Protection Directorate ({NCAA_URL}) when an airline has not resolved a complaint. Check the NCAA&apos;s current instructions for how to submit it.</p>
      <section><h2 className="font-bold">Passenger and flight</h2><p>{c.customer_name} · {c.customer_email} · {c.customer_phone}</p><p>{airline} · flight {c.flight_number} · {c.flight_date}{c.route ? ` · ${c.route}` : ''}{c.booking_ref ? ` · booking ${c.booking_ref}` : ''}</p></section>
      <section><h2 className="font-bold">Complaint</h2><p>Submitted {dt(c.created_at)} · {c.category} · status: {STATUS_LABEL[c.status] ?? c.status}</p><p className="mt-1 font-semibold">{c.subject}</p><p className="whitespace-pre-wrap">{c.description}</p>{c.desired_resolution && <p className="mt-1"><b>Passenger asked for:</b> {c.desired_resolution}</p>}{(files?.length ?? 0) > 0 && <p className="mt-1"><b>Evidence uploaded:</b> {files!.map((f) => f.file_name).join(', ')}</p>}</section>
      <section><h2 className="font-bold">Deadline</h2><p>The airline&apos;s resolution deadline was {c.response_due_at ? dt(c.response_due_at) : 'n/a'}. First airline response: {c.first_response_at ? dt(c.first_response_at) : 'none recorded'}.</p></section>
      <section><h2 className="font-bold">Conversation with the airline</h2>{(msgs ?? []).length === 0 && <p>No messages.</p>}{(msgs ?? []).map((m, i) => <p key={i} className="mt-2"><b>{who[m.sender]}</b> · {dt(m.created_at)}<br />{m.body}</p>)}</section>
      {(res ?? []).length > 0 && <section><h2 className="font-bold">Proposed resolutions</h2>{res!.map((r, i) => <p key={i} className="mt-2"><b>{r.kind}</b> ({r.status}) · {dt(r.created_at)}<br />{r.details}{r.customer_comment ? <><br />Passenger comment: {r.customer_comment}</> : null}</p>)}</section>}
      <section><h2 className="font-bold">Timeline</h2><ul className="list-disc pl-5">{(ev ?? []).map((e, i) => <li key={i}>{dt(e.created_at)}: {e.detail}</li>)}</ul></section>
    </article>
  )
}
export default function PacketPage() { return <Suspense fallback={<p className="text-sm text-muted">Preparing your packet…</p>}><Packet /></Suspense> }
