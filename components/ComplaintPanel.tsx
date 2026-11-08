'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { attachmentLinks, sendMessage, addNote, proposeResolution, setStatus } from '@/app/actions/company'
import { draftReply, summarize } from '@/lib/ai'
import { AIRLINE_STATUSES, FINISHED, RESOLUTION_KINDS, STATUS_LABEL, RESOLUTION_WINDOW_DAYS } from '@/lib/constants'

export type Complaint = { id: string; ref: string; customer_name: string; customer_email: string; customer_phone: string; flight_number: string; flight_date: string; route: string | null; booking_ref: string | null; category: string; subject: string; description: string; desired_resolution: string | null; rating: number; is_critical: boolean; severity: string; status: string; created_at: string; resolved_at: string | null; response_due_at: string | null; first_response_at: string | null; escalation_level: number; ledgerly_requested_at: string | null; regulator_referred_at: string | null; regulator_reference: string | null }
type Msg = { id: string; sender: string; body: string; created_at: string }
type Note = { id: string; body: string; created_at: string }
type Res = { id: string; kind: string; details: string; status: string; customer_comment: string | null }
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', btn = 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50', btn2 = 'rounded-lg border px-3 py-1.5 text-sm'
const who: Record<string, string> = { customer: 'Customer', airline: 'Airline', ledgerly: 'Ledgerly' }

export default function ComplaintPanel({ c, airline, legal, now, onClose, onChanged }: { c: Complaint; airline: string; legal?: string; now: number; onClose: () => void; onChanged: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [msgs, setMsgs] = useState<Msg[]>([]), [notes, setNotes] = useState<Note[]>([]), [res, setRes] = useState<Res[]>([]), [files, setFiles] = useState<{ name: string; url: string }[]>([])
  const [text, setText] = useState(''), [noteText, setNoteText] = useState(''), [kind, setKind] = useState<string>(RESOLUTION_KINDS[0]), [details, setDetails] = useState(''), [info, setInfo] = useState(''), [busy, setBusy] = useState(false), [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    const load = async () => {
      const [m, n, r] = await Promise.all([
        sb.from('complaint_messages').select('id,sender,body,created_at').eq('complaint_id', c.id).order('created_at'),
        sb.from('complaint_internal_notes').select('id,body,created_at').eq('complaint_id', c.id).order('created_at'),
        sb.from('complaint_resolutions').select('id,kind,details,status,customer_comment').eq('complaint_id', c.id).order('created_at'),
      ])
      if (live) { setMsgs((m.data ?? []) as Msg[]); setNotes((n.data ?? []) as Note[]); setRes((r.data ?? []) as Res[]) }
    }
    load(); const t = setInterval(load, 8000); attachmentLinks(c.id).then((f) => live && setFiles(f))
    return () => { live = false; clearInterval(t) }
  }, [sb, c.id, tick])
  const run = async (p: Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) => { setBusy(true); const r = await p; setInfo(r.error ?? (r.ok ? ok : 'Could not save. Try again.')); setBusy(false); if (r.ok) { after?.(); setTick((n) => n + 1); onChanged() } }
  const overdue = !!c.response_due_at && now > 0 && new Date(c.response_due_at) < new Date(now) && !FINISHED.includes(c.status)
  const statuses = [...AIRLINE_STATUSES, ...(c.status === 'resolved' ? ['closed'] : [])] as string[]

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl space-y-4 overflow-y-auto border-l bg-card p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">{c.ref} · {c.category} · {new Date(c.created_at).toLocaleDateString('en-GB')}</p><h2 className="text-xl font-bold">{c.subject}</h2></div><button className={btn2} onClick={onClose}>Close</button></div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-hover px-2 py-0.5">{STATUS_LABEL[c.status] ?? c.status}</span>{c.is_critical && <span className="rounded-full bg-red-600/15 px-2 py-0.5 font-semibold text-red-600">Critical</span>}{overdue && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-semibold">Overdue</span>}{c.ledgerly_requested_at && <span className="rounded-full bg-sky-600/15 px-2 py-0.5">Ledgerly asked to step in</span>}</div>
      {overdue && <p className="rounded-lg border border-amber-500 p-3 text-sm">This complaint is past its {RESOLUTION_WINDOW_DAYS}-day resolution window. Under Part 19 of the Nigeria Civil Aviation Regulations, the customer may refer an unresolved complaint to the NCAA&apos;s Consumer Protection Directorate. Responding now keeps it in your hands.</p>}
      {c.regulator_referred_at && <p className="rounded-lg border border-red-600 p-3 text-sm"><b>Referred to the NCAA</b>{c.regulator_reference ? ` (reference ${c.regulator_reference})` : ''}. Please respond to the customer below.</p>}
      {legal && <p className="rounded-lg border border-amber-500 p-3 text-sm"><b>⚖ Customer requested legal representation</b> ({legal}). Resolving this promptly may let the customer cancel.</p>}
      <div className="space-y-1 rounded-lg border p-3 text-sm"><p className="font-semibold">{c.customer_name}</p><p><a className="underline" href={`mailto:${c.customer_email}`}>{c.customer_email}</a> · {c.customer_phone}</p>
        <a className={btn + ' mt-2 inline-block'} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${c.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${c.customer_name}, we received your complaint (ID: ${c.ref}) regarding '${c.subject}' on Ledgerly. We would like to help resolve this...`)}`}>Chat on WhatsApp</a></div>
      <p className="text-xs text-muted">Flight {c.flight_number} · {c.route ?? 'route n/a'} · {c.flight_date} · Booking {c.booking_ref ?? 'n/a'}</p>
      <p className="whitespace-pre-wrap text-sm">{c.description}</p>
      {c.desired_resolution && <p className="rounded-lg bg-hover p-3 text-sm"><b>Customer wants:</b> {c.desired_resolution}</p>}
      {files.length > 0 && <div className="text-sm"><p className="font-semibold">Evidence</p>{files.map((x) => <a key={x.url} className="mr-3 underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a>)}</div>}

      <section className="space-y-2"><h3 className="font-semibold">Conversation (visible to the customer)</h3>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm">{msgs.map((m) => <div key={m.id} className={m.sender === 'airline' ? 'text-right' : ''}><span className="text-xs text-muted">{who[m.sender]} · {new Date(m.created_at).toLocaleString('en-GB')}</span><p className={`mt-0.5 inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-left ${m.sender === 'airline' ? 'bg-sky-600/15' : m.sender === 'ledgerly' ? 'bg-amber-500/15' : 'bg-hover'}`}>{m.body}</p></div>)}{msgs.length === 0 && <p className="text-xs text-muted">No messages yet.</p>}</div>
        <textarea className={inp} rows={3} maxLength={4000} placeholder="Reply to the customer" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2"><button className={btn} disabled={busy || !text.trim()} onClick={() => run(sendMessage(c.id, text), 'Sent. The customer was emailed.', () => setText(''))}>Send</button><button className={btn2} onClick={() => setText(draftReply(c, airline))}>Draft reply</button><button className={btn2} onClick={() => setInfo('Summary:\n' + summarize(c.description))}>Summarize</button></div></section>

      <section className="space-y-2"><h3 className="font-semibold">Resolution</h3>
        {res.map((r) => <div key={r.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-2"><b>{r.kind}</b><span className="text-xs text-muted">{r.status}</span></div><p>{r.details}</p>{r.customer_comment && <p className="mt-1 text-xs text-muted">Customer: {r.customer_comment}</p>}</div>)}
        {!FINISHED.includes(c.status) && <><select className={inp} value={kind} onChange={(e) => setKind(e.target.value)}>{RESOLUTION_KINDS.map((k) => <option key={k}>{k}</option>)}</select><textarea className={inp} rows={2} maxLength={2000} placeholder="What you are offering, and when" value={details} onChange={(e) => setDetails(e.target.value)} /><button className={btn2} disabled={busy || !details.trim()} onClick={() => run(proposeResolution(c.id, kind, details), 'Proposal sent. The customer can accept or reject it.', () => setDetails(''))}>Propose resolution</button></>}</section>

      <div><label className="mb-1 block text-sm font-semibold">Status</label><select className={inp} value={c.status} onChange={(e) => run(setStatus(c.id, e.target.value), 'Status updated.')}>{!statuses.includes(c.status) && <option value={c.status} disabled>{STATUS_LABEL[c.status] ?? c.status}</option>}{statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>

      <section className="space-y-2"><h3 className="font-semibold">Internal notes <span className="text-xs font-normal text-muted">(never shown to the customer)</span></h3>
        {notes.map((n) => <p key={n.id} className="rounded-lg bg-hover p-2 text-sm">{n.body}<span className="block text-xs text-muted">{new Date(n.created_at).toLocaleString('en-GB')}</span></p>)}
        <textarea className={inp} rows={2} maxLength={4000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Contact operations before replying" /><button className={btn2} disabled={busy || !noteText.trim()} onClick={() => run(addNote(c.id, noteText), 'Note saved.', () => setNoteText(''))}>Add note</button></section>
      {info && <p role="status" className="whitespace-pre-line text-sm text-muted">{info}</p>}
    </aside>
  )
}
