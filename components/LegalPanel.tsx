'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listLawyers, startCheckout, sendCustomerMessage, cancelCase } from '@/app/actions/legal'
import { SERVICES, GRADES, GRADE_LABEL, GRADE_INFO, naira } from '@/lib/constants'

type K = { id: string; ref: string; status: string; service: string; grade: string; total_kobo: number; fee_kobo: number; accept_by: string; lawyer: { name: string; firm: string | null } | null }
type Msg = { sender: string; body: string; created_at: string }
type L = { id: string; name: string; firm: string | null; callYear: number; bio: string | null; rating: number; priceKobo: number }
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', btn = 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50', btn2 = 'rounded-lg border px-3 py-1.5 text-sm'
const CLOSED = ['declined', 'expired', 'cancelled']

export default function LegalPanel({ kase, messages }: { kase: K | null; messages: Msg[] }) {
  const router = useRouter(), [busy, run] = useTransition()
  const [service, setService] = useState<string>(SERVICES[0]), [grade, setGrade] = useState<string>('junior'), [list, setList] = useState<L[] | null>(null), [pct, setPct] = useState(0), [sel, setSel] = useState(''), [consent, setConsent] = useState(false), [err, setErr] = useState(''), [say, setSay] = useState('')
  const live = kase && !CLOSED.includes(kase.status)
  useEffect(() => { if (!live || kase.status === 'completed') return; const t = setInterval(() => router.refresh(), 10000); return () => clearInterval(t) }, [live, kase, router])

  if (live) return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">⚖ Legal case {kase.ref}</h2><span className="rounded-full bg-hover px-2 py-0.5 text-xs">{kase.status.replace('_', ' ')}</span></div>
      <p className="text-sm">{kase.service}{kase.lawyer && <> with <b>{kase.lawyer.name}</b> ({GRADE_LABEL[kase.grade]}{kase.lawyer.firm ? `, ${kase.lawyer.firm}` : ''})</>}. Total {naira(kase.total_kobo)}, including a {naira(kase.fee_kobo)} platform fee. Your payment is held until the work is complete.</p>
      {kase.status === 'pending_payment' && <p className="text-sm text-muted">We are waiting for the payment to be confirmed. If you closed the payment page, cancel and start again.</p>}
      {kase.status === 'awaiting_lawyer' && <p className="text-xs text-muted">The lawyer must accept by <time suppressHydrationWarning>{new Date(kase.accept_by).toLocaleString()}</time> or you are refunded automatically.</p>}
      {['pending_payment', 'awaiting_lawyer'].includes(kase.status) && <button className={btn2} disabled={busy} onClick={() => run(async () => { await cancelCase(kase.id); router.refresh() })}>Cancel{kase.status === 'awaiting_lawyer' ? ' and get a full refund' : ''}</button>}
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3 text-sm">{messages.map((m, i) => <p key={i}><span className="text-xs text-muted">{m.sender === 'lawyer' ? kase.lawyer?.name ?? 'Lawyer' : m.sender === 'customer' ? 'You' : 'Ledgerly'}: </span>{m.body}</p>)}{messages.length === 0 && <p className="text-xs text-muted">No messages yet.</p>}</div>
      {['awaiting_lawyer', 'active'].includes(kase.status) && <div className="flex gap-2"><input className={inp} placeholder="Message your lawyer" value={say} onChange={(e) => setSay(e.target.value)} /><button className={btn} disabled={busy} onClick={() => run(async () => { await sendCustomerMessage(kase.id, say); setSay(''); router.refresh() })}>Send</button></div>}
    </div>
  )

  const find = () => run(async () => { setErr(''); setSel(''); const r = await listLawyers(service, grade); if (!r.ok) return setErr(r.error); setList(r.lawyers); setPct(r.pct) })
  const chosen = list?.find((l) => l.id === sel), fee = chosen ? Math.round((chosen.priceKobo * pct) / 100) : 0
  const pay = () => run(async () => { setErr(''); const r = await startCheckout(sel, service, consent); if (!r.ok) return setErr(r.error); window.location.href = r.url })
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-bold">Need legal help?</h2>
      {kase && <p className="text-sm text-muted">Your last request ({kase.ref}) was {kase.status} and any payment was refunded.</p>}
      <p className="text-sm text-muted">If the airline has not put things right, hire a verified lawyer to take your complaint further.</p>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs text-muted">What do you need?</label><select className={inp} value={service} onChange={(e) => { setService(e.target.value); setList(null) }}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="mb-1 block text-xs text-muted">Lawyer grade</label><select className={inp} value={grade} onChange={(e) => { setGrade(e.target.value); setList(null) }}>{GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}</select></div></div>
      <p className="text-xs text-muted">{GRADE_INFO[grade]}</p>
      <button className={btn} disabled={busy} onClick={find}>Find lawyers</button>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {list && list.length === 0 && <p className="text-sm text-muted">No lawyers of this grade offer that service right now. Try another grade.</p>}
      {list?.map((l) => <label key={l.id} className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"><input type="radio" name="lw" checked={sel === l.id} onChange={() => setSel(l.id)} /><span className="flex-1"><b>{l.name}</b>{l.firm && <> · {l.firm}</>}<br /><span className="text-muted">Called {l.callYear} · ★ {l.rating || 'new'} · {l.bio}</span></span><b>{naira(l.priceKobo)}</b></label>)}
      {chosen && <>
        <div className="space-y-1 rounded-lg border p-3 text-sm"><div className="flex justify-between"><span>Lawyer&apos;s fee</span><b>{naira(chosen.priceKobo)}</b></div><div className="flex justify-between"><span>Platform service fee ({pct}%)</span><b>{naira(fee)}</b></div><div className="flex justify-between border-t pt-1"><span>Total</span><b>{naira(chosen.priceKobo + fee)}</b></div></div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I agree to share my complaint and contact details with this lawyer, and accept the <Link className="underline" href="/legal/terms" target="_blank">Terms</Link> and <Link className="underline" href="/legal/refunds" target="_blank">Refund Policy</Link>. My payment is held until the work is complete.</span></label>
        <button className={btn} disabled={busy || !consent} onClick={pay}>Pay {naira(chosen.priceKobo + fee)} securely with Paystack</button></>}
    </div>
  )
}
