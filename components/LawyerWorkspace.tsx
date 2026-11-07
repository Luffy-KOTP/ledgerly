'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { signOut } from '@/app/actions/auth'
import { saveProfile, acceptCase, declineCase, lawyerMessage, completeCase } from '@/app/actions/lawyer'
import { SERVICES, GRADE_LABEL, naira } from '@/lib/constants'

type K = { id: string; ref: string; status: string; service: string; price_kobo: number; accept_by: string }
type D = { ref: string; airline: string; flight: string; category: string; subject: string; description: string; customer: { name: string; email: string; phone: string } | null }
type M = { case_id: string; sender: string; body: string; created_at: string }
type P = { status: string; amount_kobo: number }
const inp = 'rounded-lg border bg-card p-2 text-sm w-full', btn = 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50', btn2 = 'rounded-lg border px-3 py-1.5 text-sm'

export default function LawyerWorkspace({ lawyer, prices, band, banks }: { lawyer: { id: string; full_name: string; status: string; grade: string | null; available: boolean; bio: string | null; conflicts: string[]; payout_bank_code: string | null; payout_account_no: string | null }; prices: { service: string; price_kobo: number }[]; band: { min_price_kobo: number; max_price_kobo: number; platform_fee_pct: number } | null; banks: { name: string; code: string }[] }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [f, setF] = useState({ bio: lawyer.bio ?? '', available: lawyer.available, conflicts: (lawyer.conflicts ?? []).join(', '), bankCode: lawyer.payout_bank_code ?? '', accountNo: lawyer.payout_account_no ?? '', prices: Object.fromEntries(SERVICES.map((s) => [s, String((prices.find((p) => p.service === s)?.price_kobo ?? 0) / 100 || '')])) as Record<string, string> })
  const [cases, setCases] = useState<K[]>([]), [det, setDet] = useState<Record<string, D>>({}), [msgs, setMsgs] = useState<M[]>([]), [pay, setPay] = useState<P[]>([]), [say, setSay] = useState<Record<string, string>>({}), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const ok = lawyer.status === 'approved'

  useEffect(() => {
    if (!ok) return
    const load = async () => {
      const { data: ks } = await sb.from('legal_cases').select('id,ref,status,service,price_kobo,accept_by').order('created_at', { ascending: false })
      const list = (ks ?? []) as K[]; setCases(list)
      const live = list.filter((k) => ['awaiting_lawyer', 'active', 'completed'].includes(k.status))
      const d = await Promise.all(live.map(async (k) => [k.id, (await sb.rpc('lawyer_case_detail', { p_case: k.id })).data as D] as const))
      setDet(Object.fromEntries(d))
      if (list.length) setMsgs(((await sb.from('case_messages').select('case_id,sender,body,created_at').in('case_id', list.map((k) => k.id)).order('created_at')).data ?? []) as M[])
      setPay(((await sb.from('payouts').select('status,amount_kobo')).data ?? []) as P[])
    }
    load(); const t = setInterval(load, 15000); return () => clearInterval(t)
  }, [sb, ok])

  const act = async (p: Promise<{ ok: boolean; error?: string }>, success: string) => { setBusy(true); const r = await p; setNote(r.error ?? (r.ok ? success : 'Could not do that.')); setBusy(false) }
  const sum = (l: { price_kobo: number }[]) => l.reduce((s, k) => s + k.price_kobo, 0)
  const M = [['Paid out', naira(pay.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_kobo, 0))], ['In progress or escrow', naira(sum(cases.filter((k) => ['awaiting_lawyer', 'active'].includes(k.status))))], ['Active cases', cases.filter((k) => k.status === 'active').length]]
  const banner = { pending: 'Your application is under review. We verify your credentials and assign your grade before you go live.', rejected: 'Your application was not approved. Contact the platform admin.', suspended: 'Your profile is suspended. Contact the platform admin.' }[lawyer.status]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{lawyer.full_name}</h1><form action={signOut}><button className={btn2}>Log out</button></form></div>
      {banner && <p className="rounded-lg border bg-card p-4 text-sm">{banner}</p>}
      {ok && <>
        <div className="grid grid-cols-3 gap-3">{M.map(([k, v]) => <div key={k as string} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</div>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Your services and payout · <span className="rounded-full bg-sky-600/20 px-2 py-0.5 text-xs">{GRADE_LABEL[lawyer.grade ?? ''] ?? ''}</span></h2>
          {band && <p className="text-xs text-muted">Price between {naira(band.min_price_kobo)} and {naira(band.max_price_kobo)}. Leave a service blank if you do not offer it. Customers pay a {band.platform_fee_pct}% platform service fee on top of your price.</p>}
          <div className="grid gap-3 sm:grid-cols-2">{SERVICES.map((s) => <div key={s}><label className="mb-1 block text-xs text-muted">{s} (₦)</label><input className={inp} type="number" min={0} value={f.prices[s]} onChange={(e) => setF({ ...f, prices: { ...f.prices, [s]: e.target.value } })} /></div>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs text-muted">Payout bank</label><select className={inp} value={f.bankCode} onChange={(e) => setF({ ...f, bankCode: e.target.value })}><option value="">Choose a bank</option>{banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-muted">Account number (10 digits)</label><input className={inp} inputMode="numeric" value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value })} /></div>
          </div>
          <div><label className="mb-1 block text-xs text-muted">Airlines you act for (conflicts), comma separated</label><input className={inp} value={f.conflicts} onChange={(e) => setF({ ...f, conflicts: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs text-muted">Short bio</label><textarea className={inp} rows={3} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} /> Accepting new requests</label>
          <button className={btn} disabled={busy} onClick={() => act(saveProfile(f), 'Profile saved.')}>Save profile</button>
        </div>
        {note && <p role="status" className="text-sm text-muted">{note}</p>}
        <section className="space-y-3"><h2 className="text-lg font-bold">New requests</h2>
          {cases.filter((k) => k.status === 'awaiting_lawyer').map((k) => { const d = det[k.id]; return (
            <div key={k.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{k.service}</b><span suppressHydrationWarning className="text-xs text-muted">Respond by {new Date(k.accept_by).toLocaleString()}</span></div>
              {d && <><p className="text-muted">{d.airline} · flight {d.flight} · {d.category}</p><p><b>{d.subject}</b></p><p>{d.description}</p></>}
              <p>Your fee: <b>{naira(k.price_kobo)}</b> (held by the platform until you complete the case)</p><p className="text-xs text-muted">The customer&apos;s contact details unlock after you accept.</p>
              <div className="flex gap-2"><button className={btn} disabled={busy} onClick={() => { if (confirm('Confirm you have no conflict of interest with this airline and hold a current practising certificate.')) act(acceptCase(k.id), 'Case accepted.') }}>Accept</button><button className={btn2} disabled={busy} onClick={() => act(declineCase(k.id), 'Declined. The customer is refunded.')}>Decline</button></div></div>) })}
          {!cases.some((k) => k.status === 'awaiting_lawyer') && <p className="text-sm text-muted">No new requests.</p>}</section>
        <section className="space-y-3"><h2 className="text-lg font-bold">Your cases</h2>
          {cases.filter((k) => ['active', 'completed'].includes(k.status)).map((k) => { const d = det[k.id], on = k.status === 'active'; return (
            <div key={k.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{k.ref} · {k.service}</b><span className="text-xs text-muted">{k.status}</span></div>
              {d?.customer && <p className="text-muted">{d.customer.name} · <a className="underline" href={`mailto:${d.customer.email}`}>{d.customer.email}</a> · {d.customer.phone}</p>}
              {d && <p><b>{d.subject}</b>: {d.description}</p>}
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-3">{msgs.filter((m) => m.case_id === k.id).map((m, i) => <p key={i}><span className="text-xs text-muted">{m.sender}: </span>{m.body}</p>)}</div>
              {on && <><div className="flex gap-2"><input className={inp} placeholder="Message the customer" value={say[k.id] ?? ''} onChange={(e) => setSay({ ...say, [k.id]: e.target.value })} /><button className={btn} disabled={busy} onClick={async () => { await act(lawyerMessage(k.id, say[k.id] ?? ''), 'Sent.'); setSay({ ...say, [k.id]: '' }) }}>Send</button></div>
                <button className={btn2} disabled={busy} onClick={() => { if (confirm('Mark complete? Your fee is paid out to your bank account.')) act(completeCase(k.id), 'Case complete. Payout started.') }}>Mark complete and get paid</button></>}</div>) })}
          {!cases.some((k) => ['active', 'completed'].includes(k.status)) && <p className="text-sm text-muted">No active cases.</p>}</section>
      </>}
    </div>
  )
}
