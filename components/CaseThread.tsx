'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { customerMessage, decideResolution, requestIntervention } from '@/app/actions/guest'
import { NCAA_URL, RESOLUTION_WINDOW_DAYS } from '@/lib/constants'

type Msg = { id: string; sender: string; body: string; created_at: string }
type Res = { id: string; kind: string; details: string; status: string; customer_comment: string | null }
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', btn = 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50', btn2 = 'rounded-lg border px-3 py-1.5 text-sm'
const who: Record<string, string> = { customer: 'You', airline: 'Airline', ledgerly: 'Ledgerly' }

export default function CaseThread({ messages, resolutions, finished, closed, overdue, canAsk, requestedAt, referral }: { messages: Msg[]; resolutions: Res[]; finished: boolean; closed: boolean; overdue: boolean; canAsk: boolean; requestedAt: string | null; referral: { at: string; ref: string | null } | null }) {
  const router = useRouter(), [busy, run] = useTransition()
  const [text, setText] = useState(''), [comment, setComment] = useState<Record<string, string>>({}), [err, setErr] = useState('')
  useEffect(() => { if (finished) return; const t = setInterval(() => router.refresh(), 10000); return () => clearInterval(t) }, [finished, router])
  const go = (p: Promise<{ ok: boolean; error?: string }>, after?: () => void) => run(async () => { setErr(''); const r = await p; if (!r.ok) return setErr(r.error ?? 'Something went wrong.'); after?.(); router.refresh() })
  const open = resolutions.filter((r) => r.status === 'proposed')

  return (
    <div className="space-y-4">
      {open.map((r) => (
        <div key={r.id} className="space-y-2 rounded-xl border-2 border-sky-600 bg-card p-5">
          <h2 className="font-bold">The airline proposed a resolution: {r.kind}</h2><p className="whitespace-pre-wrap text-sm">{r.details}</p>
          <p className="text-xs text-muted">Accepting marks your complaint as resolved. If you reject it, your complaint stays open and you can ask Ledgerly to step in.</p>
          <textarea className={inp} rows={2} placeholder="Optional comment" value={comment[r.id] ?? ''} onChange={(e) => setComment({ ...comment, [r.id]: e.target.value })} />
          <div className="flex gap-2"><button className={btn} disabled={busy} onClick={() => go(decideResolution(r.id, true, comment[r.id] ?? ''))}>Accept</button><button className={btn2} disabled={busy} onClick={() => go(decideResolution(r.id, false, comment[r.id] ?? ''))}>Reject</button></div>
        </div>))}

      <div className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-bold">Conversation</h2>
        <div className="max-h-96 space-y-2 overflow-y-auto text-sm">{messages.map((m) => <div key={m.id} className={m.sender === 'customer' ? 'text-right' : ''}><span className="text-xs text-muted">{who[m.sender]} · <time suppressHydrationWarning>{new Date(m.created_at).toLocaleString('en-GB')}</time></span><p className={`mt-0.5 inline-block max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left ${m.sender === 'customer' ? 'bg-sky-600/15' : m.sender === 'ledgerly' ? 'bg-amber-500/15' : 'bg-hover'}`}>{m.body}</p></div>)}{messages.length === 0 && <p className="text-muted">No messages yet. The airline&apos;s replies will appear here, and we will email you.</p>}</div>
        {!closed && <div className="flex gap-2"><textarea className={inp} rows={2} maxLength={4000} placeholder="Write a message to the airline" value={text} onChange={(e) => setText(e.target.value)} /><button className={btn} disabled={busy || !text.trim()} onClick={() => go(customerMessage(text), () => setText(''))}>Send</button></div>}
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}</div>

      {resolutions.some((r) => r.status !== 'proposed') && <div className="space-y-1 rounded-xl border bg-card p-5 text-sm"><h2 className="font-bold">Earlier proposals</h2>{resolutions.filter((r) => r.status !== 'proposed').map((r) => <p key={r.id}><b>{r.kind}</b> · {r.status}</p>)}</div>}

      {!finished && (
        <div className="space-y-3 rounded-xl border bg-card p-5 text-sm"><h2 className="font-bold">If this is not resolved</h2>
          {overdue && <p className="rounded-lg border border-amber-500 p-3">The airline is past the {RESOLUTION_WINDOW_DAYS}-day window for resolving complaints.</p>}
          <p><b>1. Ask Ledgerly to step in.</b> {requestedAt ? <>You asked on <time suppressHydrationWarning>{new Date(requestedAt).toLocaleDateString('en-GB')}</time>. Our team will review the complaint and contact the airline.</> : canAsk ? 'The airline is past its deadline or you rejected its offer, so you can ask us to contact the airline.' : 'Available once the airline is past its deadline, or you have rejected its offer.'}</p>
          {canAsk && !requestedAt && <button className={btn} disabled={busy} onClick={() => go(requestIntervention())}>Ask Ledgerly to intervene</button>}
          <p><b>2. Refer it to the regulator.</b> Under Part 19 of the Nigeria Civil Aviation Regulations, a passenger can complain to the NCAA&apos;s Consumer Protection Directorate when an airline has not resolved a complaint. Download your complaint packet and include it with your complaint. Ledgerly is an independent platform and is not part of the NCAA.</p>
          {referral && <p className="rounded-lg border border-sky-600 p-3">Ledgerly referred this complaint to the NCAA on <time suppressHydrationWarning>{new Date(referral.at).toLocaleDateString('en-GB')}</time>{referral.ref ? ` (reference ${referral.ref})` : ''}.</p>}
          <div className="flex flex-wrap gap-2"><Link className={btn2} href="/track/packet" target="_blank">Download complaint packet</Link><a className={btn2} href={NCAA_URL} target="_blank" rel="noopener noreferrer">NCAA website</a></div>
        </div>)}
    </div>
  )
}
