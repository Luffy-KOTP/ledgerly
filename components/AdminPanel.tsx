'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth'
import { setAirline, setLawyer, lawyerDocs, saveBands, markRegulator } from '@/app/actions/admin'
import { GRADES, GRADE_LABEL, naira } from '@/lib/constants'

type Band = { grade: string; min: number; max: number; pct: number }
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const btn = 'rounded-lg border px-2.5 py-1 text-xs', inp = 'rounded-lg border bg-card p-1.5 text-sm'
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted">{head.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>

export default function AdminPanel({ email }: { email: string }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [air, setAir] = useState<Row[]>([]), [law, setLaw] = useState<Row[]>([]), [alerts, setAlerts] = useState<Row[]>([]), [cases, setCases] = useState<Row[]>([]), [bands, setBands] = useState<Band[]>([]), [docs, setDocs] = useState<Record<string, { name: string; url: string }[]>>({}), [pick, setPick] = useState<Record<string, string>>({}), [note, setNote] = useState('')
  const [tick, setTick] = useState(0), reload = () => setTick((n) => n + 1)
  useEffect(() => {
    let live = true
    ;(async () => {
      const [a, l, al, k, b] = await Promise.all([
        sb.from('airlines').select('*').order('created_at', { ascending: false }), sb.from('lawyers').select('*').order('created_at', { ascending: false }),
        sb.from('alerts').select('*, airlines(name)').order('created_at', { ascending: false }).limit(50),
        sb.from('legal_cases').select('*, lawyers(full_name), payments(status), payouts(status)').order('created_at', { ascending: false }).limit(100),
        sb.from('platform_settings').select('*'),
      ])
      if (!live) return
      setAir(a.data ?? []); setLaw(l.data ?? []); setAlerts(al.data ?? []); setCases(k.data ?? [])
      setBands(GRADES.map((g) => { const r = (b.data ?? []).find((x: Row) => x.grade === g); return { grade: g, min: (r?.min_price_kobo ?? 0) / 100, max: (r?.max_price_kobo ?? 0) / 100, pct: Number(r?.platform_fee_pct ?? 0) } }))
    })()
    return () => { live = false }
  }, [sb, tick])
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  const run = async (p: Promise<{ ok: boolean; error?: string }>, ok: string) => { const r = await p; setNote(r.ok ? ok : r.error ?? 'Could not do that.'); reload() }
  const paid = cases.filter((c) => c.payments?.[0]?.status === 'released' || c.payments?.status === 'released')
  const M = [['Airlines', air.length], ['Pending airlines', air.filter((a) => a.status === 'pending_approval').length], ['Lawyers awaiting review', law.filter((l) => l.status === 'pending').length], ['Open incidents', alerts.filter((a) => !a.acknowledged_at).length], ['Legal cases', cases.length], ['Platform fees earned', naira(paid.reduce((s, c) => s + c.fee_kobo, 0))]]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Platform admin</h1><form action={signOut} className="flex items-center gap-3 text-sm text-muted">{email}<button className={btn}>Log out</button></form></div>
      {note && <p role="status" className="text-sm text-muted">{note}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{M.map(([k, v]) => <div key={k as string} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</div>
      <h2 className="font-semibold">Airlines</h2>
      <Table head={['Airline', 'Status', 'Verified', 'Actions']}>{air.map((a) => <tr key={a.id} className="border-t"><td className="p-3 font-medium">{a.name}<span className="block text-xs text-muted">{a.slug}</span></td><td className="p-3">{a.status.replace('_', ' ')}</td><td className="p-3">{a.verified ? 'Yes' : 'No'}</td><td className="space-x-1 p-3 whitespace-nowrap">
        <button className={btn} onClick={() => run(setAirline(a.id, 'active', a.verified), 'Airline approved.')}>{a.status === 'active' ? 'Active' : 'Approve'}</button>
        <button className={btn} onClick={() => run(setAirline(a.id, a.status, !a.verified), 'Verification changed.')}>{a.verified ? 'Unverify' : 'Verify'}</button>
        <button className={btn} onClick={() => run(setAirline(a.id, a.status === 'suspended' ? 'active' : 'suspended', a.verified), 'Status changed.')}>{a.status === 'suspended' ? 'Reinstate' : 'Suspend'}</button></td></tr>)}</Table>
      <h2 className="font-semibold">Critical incidents</h2>
      <Table head={['Airline', 'Incident', 'Source', 'Level', 'Airline response', 'Regulator']}>{alerts.map((a) => <tr key={a.id} className="border-t"><td className="p-3">{a.airlines?.name}</td><td className="p-3">{a.title}</td><td className="p-3">{a.source.replace('_', ' ')}</td><td className="p-3">{a.level}</td><td className="p-3">{a.acknowledged_at ? 'Acknowledged' : <b className="text-red-600">Unacknowledged</b>}</td><td className="p-3">{a.regulator_notified_at ? 'Notified' : <button className={btn} onClick={() => run(markRegulator(a.id), 'Marked as notified.')}>Mark notified</button>}</td></tr>)}</Table>
      <h2 className="font-semibold">Lawyers</h2>
      <Table head={['Lawyer', 'Called', 'Enrolment', 'Requested', 'Grade', 'Status', 'Actions']}>{law.map((l) => <tr key={l.id} className="border-t align-top"><td className="p-3 font-medium">{l.full_name}<span className="block text-xs text-muted">{l.firm} · {l.bar_branch}</span>{docs[l.id] && <span className="block text-xs">{docs[l.id].length ? docs[l.id].map((d) => <a key={d.url} className="mr-2 underline" href={d.url} target="_blank" rel="noopener noreferrer">{d.name}</a>) : 'No documents'}</span>}</td><td className="p-3">{l.call_year}</td><td className="p-3">{l.enrolment_no}</td><td className="p-3">{GRADE_LABEL[l.requested_grade]}</td><td className="p-3">{GRADE_LABEL[l.grade] ?? '–'}</td><td className="p-3">{l.status}</td><td className="space-x-1 p-3 whitespace-nowrap">
        <button className={btn} onClick={async () => setDocs({ ...docs, [l.id]: await lawyerDocs(l.id) })}>Documents</button>
        {l.status !== 'approved' && <><select className={inp} value={pick[l.id] ?? l.requested_grade} onChange={(e) => setPick({ ...pick, [l.id]: e.target.value })}>{GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}</select><button className={btn} onClick={() => run(setLawyer(l.id, 'approve', pick[l.id] ?? l.requested_grade), 'Lawyer approved.')}>Approve</button></>}
        {l.status === 'pending' && <button className={btn} onClick={() => run(setLawyer(l.id, 'reject'), 'Rejected.')}>Reject</button>}
        {l.status === 'approved' && <button className={btn} onClick={() => run(setLawyer(l.id, 'suspend'), 'Suspended.')}>Suspend</button>}</td></tr>)}</Table>
      <h2 className="font-semibold">Grade price bands and platform fee</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{bands.map((b, i) => <div key={b.grade} className="space-y-2 rounded-xl border bg-card p-3 text-sm"><b>{GRADE_LABEL[b.grade]}</b>
        {([['min', 'Min price (₦)'], ['max', 'Max price (₦)'], ['pct', 'Platform fee (%)']] as const).map(([k, label]) => <div key={k}><label className="block text-xs text-muted">{label}</label><input className={inp + ' w-full'} type="number" value={b[k]} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) } : x)))} /></div>)}</div>)}</div>
      <button className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => run(saveBands(bands), 'Pricing saved. It applies to new cases.')}>Save pricing</button>
      <h2 className="font-semibold">Legal cases and payments</h2>
      <Table head={['Case', 'Lawyer', 'Service', 'Customer paid', 'Platform fee', 'Lawyer fee', 'Case', 'Payment', 'Payout']}>{cases.map((c) => { const p = Array.isArray(c.payments) ? c.payments[0] : c.payments, o = Array.isArray(c.payouts) ? c.payouts[0] : c.payouts; return <tr key={c.id} className="border-t"><td className="p-3">{c.ref}</td><td className="p-3">{c.lawyers?.full_name}</td><td className="p-3">{c.service}</td><td className="p-3">{naira(c.total_kobo)}</td><td className="p-3">{naira(c.fee_kobo)}</td><td className="p-3">{naira(c.price_kobo)}</td><td className="p-3">{c.status.replace('_', ' ')}</td><td className="p-3">{p?.status ?? '–'}</td><td className="p-3">{o?.status ?? '–'}</td></tr> })}{cases.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted">No legal cases yet.</td></tr>}</Table>
    </div>
  )
}
