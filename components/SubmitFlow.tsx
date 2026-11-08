'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CATEGORIES, DESIRED } from '@/lib/constants'
import { startSubmit, verifySubmit, submitComplaint, type Details } from '@/app/actions/guest'
const CATS = CATEGORIES
import { startSubmit, verifySubmit, submitComplaint, type Details } from '@/app/actions/guest'
const CATS = ['Flight Delay / Cancellation', 'Baggage', 'Safety / Medical Incident', 'Refund / Billing', 'Cabin & Crew Service', 'Boarding & Airport']
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', lb = 'mb-1 block text-xs text-muted', btn = 'rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
const LABELS = ['Your details', 'Verify it’s you', 'Your complaint', 'Done']

export default function SubmitFlow({ airlines, initial }: { airlines: { slug: string; name: string }[]; initial?: string }) {
  const [step, setStep] = useState(1), [err, setErr] = useState(''), [busy, run] = useTransition()
  const [f, setF] = useState({ name: '', email: '', cc: '+234', phone: '', airline: airlines.some((a) => a.slug === initial) ? initial! : airlines[0]?.slug ?? '', flight: '', date: '', route: '', booking: '' })
  const [challenge, setChallenge] = useState(''), [code, setCode] = useState(''), [rating, setRating] = useState(0), [done, setDone] = useState({ ref: '', critical: false })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const details = (): Details => ({ name: f.name, email: f.email.trim().toLowerCase(), phone: f.cc + f.phone.replace(/\D/g, '').replace(/^0+/, ''), airline: f.airline, flight: f.flight, date: f.date, route: f.route, booking: f.booking })

  const send = () => run(async () => { setErr(''); const r = await startSubmit(details()); if (!r.ok) return setErr(r.error); setChallenge(r.id); setStep(2) })
  const verify = () => run(async () => { setErr(''); const r = await verifySubmit(challenge, f.email, code); if (!r.ok) return setErr(r.error); setStep(3) })
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const d = details()
    Object.entries(d).forEach(([k, v]) => fd.set(k, v)); fd.set('rating', String(rating))
    run(async () => { setErr(''); const r = await submitComplaint(fd); if (!r.ok) return setErr(r.error); setDone(r); setStep(4) })
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Submit a complaint</h1><p className="text-sm text-muted">Step {step} of 4 · {LABELS[step - 1]}</p></div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {step === 1 && (
        <div className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
          <div><label className={lb}>Full name</label><input className={inp} value={f.name} onChange={set('name')} autoComplete="name" /></div>
          <div><label className={lb}>Email (we send a code here)</label><input className={inp} type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
          <div><label className={lb}>Phone</label><div className="flex gap-2"><select className={inp + ' !w-28'} value={f.cc} onChange={set('cc')}>{['+234', '+1', '+44', '+233', '+27', '+91'].map((c) => <option key={c}>{c}</option>)}</select><input className={inp} inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="803 123 4567" /></div></div>
          <div><label className={lb}>Airline</label><select className={inp} value={f.airline} onChange={set('airline')}>{airlines.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}</select></div>
          <div><label className={lb}>Flight number</label><input className={inp} value={f.flight} onChange={set('flight')} placeholder="SK412" /></div>
          <div><label className={lb}>Flight date</label><input className={inp} type="date" ref={(el) => { if (el) el.max = new Date().toISOString().slice(0, 10) }} value={f.date} onChange={set('date')} /></div>
          <div><label className={lb}>Route (optional)</label><input className={inp} value={f.route} onChange={set('route')} placeholder="ABV–CBQ" /></div>
          <div><label className={lb}>Booking reference (optional)</label><input className={inp} value={f.booking} onChange={set('booking')} /></div>
          <div className="md:col-span-2"><button className={btn} disabled={busy} onClick={send}>Send verification code</button></div>
        </div>
      )}
      {step === 2 && (
        <div className="max-w-md space-y-3 rounded-xl border bg-card p-5">
          <p className="text-sm">We sent a 6-digit code to <b>{f.email}</b>. It expires in 5 minutes.</p>
          <input className={inp} inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
          <div className="flex gap-2"><button className={btn} disabled={busy} onClick={verify}>Verify</button><button className="rounded-lg border px-3 text-sm" onClick={() => setStep(1)}>Back</button></div>
        </div>
      )}
      {step === 3 && (
        <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-2">
          <div><label className={lb}>Category</label><select name="category" className={inp}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={lb}>Subject</label><input name="subject" className={inp} maxLength={120} /></div>
          <div className="md:col-span-2"><label className={lb}>What happened? (If anyone is in danger right now, alert the cabin crew or emergency services first.)</label><textarea name="description" rows={5} className={inp} maxLength={4000} /></div>
          <div><label className={lb}>What would you like the airline to do?</label><select name="desired" className={inp}>{DESIRED.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className={lb}>Anything to add about what you want (optional)</label><input name="desiredNote" maxLength={1000} className={inp} /></div>
          <div><label className={lb}>Your rating of this flight</label><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-slate-300'}`}>★</button>)}</div></div>
          <div><label className={lb}>Attachments (images or PDF, up to 5 files and 4MB total)</label><input name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" /></div>
          <label className="flex gap-2 text-sm md:col-span-2"><input type="checkbox" name="consent" /> <span>I accept the <Link className="underline" href="/legal/terms" target="_blank">Terms</Link> and <Link className="underline" href="/legal/privacy" target="_blank">Privacy Policy</Link>.</span></label>
          <div className="md:col-span-2"><button className={btn} disabled={busy}>Submit complaint</button></div>
        </form>
      )}
      {step === 4 && (
        <div className="space-y-3 rounded-xl border bg-card p-6 text-center">
          <h2 className="text-xl font-bold">Complaint submitted</h2><p className="text-sm text-muted">Your reference number</p>
          <p className="text-3xl font-bold tracking-wide">{done.ref}</p>
          {done.critical && <p className="text-sm font-semibold text-red-600">Your report was flagged as safety-critical. The airline’s duty team has been alerted immediately.</p>}
          <p className="text-sm text-muted">Keep this number. Use <Link className="underline" href="/track">Track a complaint</Link> to check progress; you’ll confirm it’s you with a code each time.</p>
        </div>
      )}
    </div>
  )
}
