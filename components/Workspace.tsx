'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { ackAlert } from '@/app/actions/company'
import { signOut } from '@/app/actions/auth'
import ComplaintPanel, { type Complaint } from './ComplaintPanel'
import { CATEGORIES, FINISHED, STATUS_LABEL } from '@/lib/constants'

type A = { id: string; complaint_id: string | null; source: string; title: string; level: number; created_at: string }
const LEVELS: Record<number, string> = { 1: 'Complaints desk notified', 2: 'Escalated to duty / safety manager', 3: 'Escalated to the regulator desk' }
const SEV = ['critical', 'high', 'medium', 'low']
import { ackAlert, setStatus, publishUpdate, attachmentLinks } from '@/app/actions/company'
import { signOut } from '@/app/actions/auth'
import { summarize, draftReply } from '@/lib/ai'

type C = { id: string; ref: string; customer_name: string; customer_email: string; customer_phone: string; flight_number: string; flight_date: string; route: string | null; booking_ref: string | null; category: string; subject: string; description: string; rating: number; is_critical: boolean; severity: string; status: string; airline_response: string | null; created_at: string; resolved_at: string | null }
type A = { id: string; complaint_id: string | null; source: string; title: string; level: number; created_at: string }
const LEVELS: Record<number, string> = { 1: 'Complaints desk notified', 2: 'Escalated to duty / safety manager', 3: 'Escalated to the regulator desk' }
const SEV = ['critical', 'high', 'medium', 'low'], ST = ['pending', 'in_progress', 'resolved', 'escalated']
const CATS = ['Flight Delay / Cancellation', 'Baggage', 'Safety / Medical Incident', 'Refund / Billing', 'Cabin & Crew Service', 'Boarding & Airport']
const inp = 'rounded-lg border bg-card p-2 text-sm', btn = 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50', btn2 = 'rounded-lg border px-3 py-1.5 text-sm'
const age = (t: string, now: number) => { const s = Math.max(0, Math.round((now - new Date(t).getTime()) / 1000)); return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h` }

export default function Workspace({ airline, site, staff }: { airline: { id: string; name: string; slug: string; status: string }; site: string; staff: string }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [cs, setCs] = useState<Complaint[]>([]), [al, setAl] = useState<A[]>([]), [legal, setLegal] = useState<Record<string, string>>({}), [ready, setReady] = useState(false), [tick, setTick] = useState(0)
  const [f, setF] = useState({ q: '', status: '', severity: '', category: '', overdue: false }), [sel, setSel] = useState<string | null>(null), [now, setNow] = useState(0) // the clock is read after loading, never while rendering
  const [cs, setCs] = useState<C[]>([]), [al, setAl] = useState<A[]>([]), [legal, setLegal] = useState<Record<string, string>>({}), [ready, setReady] = useState(false)
  const [f, setF] = useState({ status: '', severity: '', category: '' }), [sel, setSel] = useState<string | null>(null), [now, setNow] = useState(0) // set after the first load: reading the clock during render breaks prerendering
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]), [msg, setMsg] = useState(''), [note, setNote] = useState('')
  const seen = useRef(0)

  useEffect(() => {
    const load = async () => {
      const [c, a, l] = await Promise.all([
        sb.from('complaints').select('*').order('created_at', { ascending: false }).limit(300),
        sb.from('alerts').select('id,complaint_id,source,title,level,created_at').is('acknowledged_at', null).order('created_at', { ascending: false }),
        sb.from('airline_legal_flags').select('complaint_id,service'),
      ])
      setCs((c.data ?? []) as Complaint[]); setAl((a.data ?? []) as A[]); setNow(Date.now()); setReady(true)
      setLegal(Object.fromEntries((l.data ?? []).map((x: { complaint_id: string; service: string }) => [x.complaint_id, x.service])))
    }
    load()
    const reload = () => load()
    const ch = sb.channel(`airline-${airline.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `airline_id=eq.${airline.id}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `airline_id=eq.${airline.id}` }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaint_messages' }, reload) // row security limits this to your own airline's messages
      .subscribe()
    const t = setInterval(load, 30000) // fallback if the realtime connection drops; also advances ages and escalation levels
    return () => { sb.removeChannel(ch); clearInterval(t) }
  }, [sb, airline.id, tick])
        sb.from('airline_legal_flags').select('complaint_id,service,status'),
      ])
      setCs((c.data ?? []) as C[]); setAl((a.data ?? []) as A[]); setNow(Date.now()); setReady(true)
      setLegal(Object.fromEntries((l.data ?? []).map((x: { complaint_id: string; service: string }) => [x.complaint_id, x.service])))
    }
    load()
    const ch = sb.channel(`airline-${airline.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `airline_id=eq.${airline.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `airline_id=eq.${airline.id}` }, load)
      .subscribe()
    const t = setInterval(load, 30000) // fallback if the realtime connection drops; also advances escalation levels and ages
    return () => { sb.removeChannel(ch); clearInterval(t) }
  }, [sb, airline.id])

  useEffect(() => { // sound + tab title for new critical alerts
    if (al.length > seen.current) { try { const x = new AudioContext(), o = x.createOscillator(); o.frequency.value = 880; o.connect(x.destination); o.start(); o.stop(x.currentTime + 0.3) } catch {} }
    seen.current = al.length; document.title = `${al.length ? `🚨 (${al.length}) ` : ''}${airline.name} workspace`
  }, [al, airline.name])

  const isOver = (c: Complaint) => !!c.response_due_at && now > 0 && new Date(c.response_due_at).getTime() < now && !FINISHED.includes(c.status)
  const q = f.q.trim().toLowerCase()
  const shown = cs.filter((c) => (!q || `${c.ref} ${c.subject} ${c.customer_name}`.toLowerCase().includes(q)) && (!f.status || c.status === f.status) && (!f.severity || c.severity === f.severity) && (!f.category || c.category === f.category) && (!f.overdue || isOver(c)))
  const cur = cs.find((c) => c.id === sel) ?? null
  const replied = cs.filter((c) => c.first_response_at), hrs = replied.length ? replied.reduce((s, c) => s + (new Date(c.first_response_at!).getTime() - new Date(c.created_at).getTime()), 0) / replied.length / 36e5 : 0
  const M = [['Total complaints', cs.length], ['New', cs.filter((c) => c.status === 'pending').length], ['Needs a response', cs.filter((c) => !c.first_response_at && !FINISHED.includes(c.status)).length], ['Overdue', cs.filter(isOver).length], ['Resolved', cs.filter((c) => c.status === 'resolved').length], ['Avg first response', replied.length ? `${hrs < 48 ? hrs.toFixed(1) + ' h' : (hrs / 24).toFixed(1) + ' days'}` : '–'], ['Satisfaction', cs.length ? `${(cs.reduce((s, c) => s + c.rating, 0) / cs.length).toFixed(1)} / 5` : '–']]
  const top = Object.entries(cs.reduce<Record<string, number>>((m, c) => ({ ...m, [c.category]: (m[c.category] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]
  const link = `${site}/submit?airline=${airline.slug}`
  const cur = cs.find((c) => c.id === sel) ?? null
  const open = async (c: C) => { setSel(c.id); setMsg(c.airline_response ?? ''); setNote(''); setFiles([]); setFiles(await attachmentLinks(c.id)) }
  const run = async (p: Promise<{ ok: boolean }>, ok: string) => { const r = await p; setNote(r.ok ? ok : 'Could not save. Try again.') }
  const shown = cs.filter((c) => (!f.status || c.status === f.status) && (!f.severity || c.severity === f.severity) && (!f.category || c.category === f.category))
  const done = cs.filter((c) => c.resolved_at), avgDays = done.length ? done.reduce((s, c) => s + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()), 0) / done.length / 864e5 : 0
  const link = `${site}/submit?airline=${airline.slug}`
  const M = [['Total complaints', cs.length], ['Unresolved', cs.filter((c) => c.status !== 'resolved').length], ['Avg resolution', done.length ? `${avgDays.toFixed(1)} days` : '–'], ['Satisfaction', cs.length ? `${(cs.reduce((s, c) => s + c.rating, 0) / cs.length).toFixed(1)} / 5` : '–']]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{airline.name}</h1><form action={signOut} className="flex items-center gap-3 text-sm text-muted">{staff}<button className={btn2}>Log out</button></form></div>
      {airline.status !== 'active' && <p className="rounded-lg border border-amber-500 bg-amber-500/10 p-3 text-sm">Your airline is awaiting admin approval. Your link below goes live once it is approved.</p>}
      {al.map((a) => (
        <div key={a.id} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-600 bg-card p-4">
          <div><p className="font-bold text-red-600">{a.level > 1 ? 'ESCALATED · ' : ''}Critical incident · {a.source.replace('_', ' ')}</p><p className="text-sm">{a.title}</p><p className="text-xs text-muted">{age(a.created_at, now || new Date(a.created_at).getTime())} ago · Level {a.level}: {LEVELS[a.level]}</p></div>
          <div className="flex gap-2">{a.complaint_id && <button className={btn2} onClick={() => setSel(a.complaint_id)}>Open</button>}<button className={btn} onClick={async () => { await ackAlert(a.id); setTick((n) => n + 1) }}>Acknowledge</button></div>
        </div>))}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{M.map(([k, v]) => <div key={k as string} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</div>
      {top && <p className="text-sm text-muted">Most common complaint: <b className="text-foreground">{top[0]}</b> ({top[1]} of {cs.length}).</p>}
      <div className="space-y-2 rounded-xl border bg-card p-4"><h2 className="font-semibold">Your complaint link</h2><p className="text-xs text-muted">Put it on your website and social pages. Customers land on your complaint form.</p>
        <div className="flex gap-2"><input readOnly aria-label="Complaint link" className={inp + ' flex-1'} value={link} /><button className={btn2} onClick={() => navigator.clipboard.writeText(link)}>Copy</button></div></div>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
        <input className={inp + ' min-w-[10rem] flex-1'} placeholder="Search reference, subject or customer" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={inp} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">All severities</option>{SEV.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.overdue} onChange={(e) => setF({ ...f, overdue: e.target.checked })} /> Overdue only</label>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Ref', 'Subject', 'Customer', 'Category', 'Severity', 'Status'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>
        {shown.map((c) => <tr key={c.id} tabIndex={0} onClick={() => setSel(c.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(c.id)} className="cursor-pointer border-t hover:bg-hover"><td className="p-3 whitespace-nowrap">{c.ref}</td><td className="p-3 font-medium">{c.subject}{legal[c.id] && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">⚖ Legal</span>}</td><td className="p-3">{c.customer_name}</td><td className="p-3">{c.category}</td><td className={`p-3 ${c.severity === 'critical' ? 'font-bold text-red-600' : ''}`}>{c.severity}</td><td className="p-3 whitespace-nowrap">{STATUS_LABEL[c.status] ?? c.status}{isOver(c) && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold">Overdue</span>}</td></tr>)}
        {ready && shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No complaints match.</td></tr>}</tbody></table></div>
      {cur && <ComplaintPanel key={cur.id} c={cur} airline={airline.name} legal={legal[cur.id]} now={now} onClose={() => setSel(null)} onChanged={() => setTick((n) => n + 1)} />}
      {airline.status !== 'active' && <p className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 text-sm">Your airline is awaiting admin approval. Your link below goes live once it is approved.</p>}
      {al.map((a) => (
        <div key={a.id} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-600 bg-card p-4">
          <div><p className="font-bold text-red-600">{a.level > 1 ? 'ESCALATED · ' : ''}Critical incident · {a.source.replace('_', ' ')}</p><p className="text-sm">{a.title}</p><p className="text-xs text-muted">{age(a.created_at, now)} ago · Level {a.level}: {LEVELS[a.level]}</p></div>
          <div className="flex gap-2">{a.complaint_id && <button className={btn2} onClick={() => { const c = cs.find((x) => x.id === a.complaint_id); if (c) open(c) }}>Open</button>}<button className={btn} onClick={async () => { await ackAlert(a.id) }}>Acknowledge</button></div>
        </div>))}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{M.map(([k, v]) => <div key={k as string} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}</div>
      <div className="space-y-2 rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">Your complaint link</h2><p className="text-xs text-muted">Put it on your website and social pages. Customers land on your complaint form.</p></div></div>
        <div className="flex gap-2"><input readOnly aria-label="Complaint link" className={inp + ' flex-1'} value={link} /><button className={btn2} onClick={() => navigator.clipboard.writeText(link)}>Copy</button></div></div>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
        <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option>{ST.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        <select className={inp} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">All severities</option>{SEV.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All categories</option>{CATS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{['Ref', 'Subject', 'Customer', 'Category', 'Severity', 'Status'].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>
        {shown.map((c) => <tr key={c.id} tabIndex={0} onClick={() => open(c)} onKeyDown={(e) => e.key === 'Enter' && open(c)} className="cursor-pointer border-t hover:bg-hover"><td className="p-3">{c.ref}</td><td className="p-3 font-medium">{c.subject}{legal[c.id] && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">⚖ Legal</span>}</td><td className="p-3">{c.customer_name}</td><td className="p-3">{c.category}</td><td className={`p-3 ${c.severity === 'critical' ? 'font-bold text-red-600' : ''}`}>{c.severity}</td><td className="p-3">{c.status.replace('_', ' ')}</td></tr>)}
        {ready && shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No complaints match.</td></tr>}</tbody></table></div>
      {cur && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-lg space-y-3 overflow-y-auto border-l bg-card p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">{cur.ref} · {cur.category} · {new Date(cur.created_at).toLocaleDateString()}</p><h2 className="text-xl font-bold">{cur.subject}</h2></div><button className={btn2} onClick={() => setSel(null)}>Close</button></div>
          {legal[cur.id] && <p className="rounded-lg border border-amber-500 p-3 text-sm"><b>⚖ Customer requested legal representation</b> ({legal[cur.id]}). Resolving this promptly may let the customer cancel.</p>}
          <div className="space-y-1 rounded-lg border p-3 text-sm"><p className="font-semibold">{cur.customer_name}</p><p><a className="underline" href={`mailto:${cur.customer_email}`}>{cur.customer_email}</a></p><p>{cur.customer_phone}</p>
            <a className={btn + ' mt-2 inline-block'} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${cur.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${cur.customer_name}, we received your complaint (ID: ${cur.ref}) regarding '${cur.subject}' on Ledgerly. We would like to help resolve this...`)}`}>Chat on WhatsApp</a></div>
          <p className="text-xs text-muted">Flight {cur.flight_number} · {cur.route ?? 'route n/a'} · {cur.flight_date} · Booking {cur.booking_ref ?? 'n/a'}</p>
          <p className="whitespace-pre-wrap text-sm">{cur.description}</p>
          {files.length > 0 && <div className="text-sm"><p className="font-semibold">Attachments</p>{files.map((x) => <a key={x.url} className="mr-3 underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a>)}</div>}
          <div><label className="mb-1 block text-sm font-semibold">Message to customer (shown on their tracking page)</label><textarea className={inp + ' w-full'} rows={3} maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} /><div className="mt-2 flex flex-wrap gap-2"><button className={btn2} onClick={() => setMsg(draftReply(cur, airline.name))}>Draft reply</button><button className={btn2} onClick={() => setNote('Summary:\n' + summarize(cur.description))}>Summarize</button><button className={btn} onClick={() => run(publishUpdate(cur.id, msg), 'Update published. The customer was emailed.')}>Publish update</button></div></div>
          <div><label className="mb-1 block text-sm font-semibold">Status</label><select className={inp} value={cur.status} onChange={(e) => run(setStatus(cur.id, e.target.value), 'Status updated.')}>{ST.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          {note && <p role="status" className="whitespace-pre-line text-sm text-muted">{note}</p>}
        </aside>)}
    </div>
  )
}
