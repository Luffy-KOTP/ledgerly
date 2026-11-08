'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startTrack, verifyTrack } from '@/app/actions/guest'
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', btn = 'rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
export default function TrackForm() {
  const router = useRouter(), [busy, run] = useTransition()
  const [ref, setRef] = useState(''), [id, setId] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('')
  const send = () => run(async () => { setErr(''); const r = await startTrack(ref); if (!r.ok) return setErr(r.error); setId(r.id) })
  const verify = () => run(async () => { setErr(''); const r = await verifyTrack(id, ref, code); if (!r.ok) return setErr(r.error); router.refresh() })
  return (
    <div className="max-w-md space-y-3 rounded-xl border bg-card p-5">
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {!id ? (<><label className="block text-xs text-muted">Reference number</label><input className={inp} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="LDG-2026-01001" /><button className={btn} disabled={busy} onClick={send}>Send code</button></>)
        : (<><p className="text-sm">If that reference exists, a 6-digit code has been sent to the email on file.</p><input className={inp} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" /><div className="flex gap-2"><button className={btn} disabled={busy} onClick={verify}>View status</button><button className="rounded-lg border px-3 text-sm" onClick={() => setId('')}>Back</button></div></>)}
    </div>
  )
}
