'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { applyLawyer } from '@/app/actions/lawyer'
import { GRADES, GRADE_LABEL } from '@/lib/constants'
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', lb = 'mb-1 block text-xs text-muted'
export default function ApplyLawyer() {
  const [s, action, pending] = useActionState(applyLawyer, undefined)
  if (s?.message) return <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-sm">{s.message} <Link className="underline" href="/login">Back to login</Link></div>
  return (
    <form action={action} className="mx-auto grid max-w-2xl gap-3 rounded-xl border bg-card p-6 sm:grid-cols-2">
      <div className="sm:col-span-2"><h1 className="text-2xl font-bold">Apply to join as a lawyer</h1><p className="text-sm text-muted">We verify your credentials and assign your grade before you appear to customers.</p></div>
      <div><label className={lb}>Full name</label><input name="name" className={inp} autoComplete="name" required /></div>
      <div><label className={lb}>Email</label><input name="email" type="email" className={inp} autoComplete="email" required /></div>
      <div className="sm:col-span-2"><label className={lb}>Password (10+ characters, with a letter and a number)</label><input name="password" type="password" className={inp} autoComplete="new-password" required /></div>
      <div><label className={lb}>Year called to the bar</label><input name="year" type="number" className={inp} required /></div>
      <div><label className={lb}>Enrolment number</label><input name="enrolment" className={inp} required /></div>
      <div><label className={lb}>Bar branch</label><input name="branch" className={inp} required /></div>
      <div><label className={lb}>Firm or chambers</label><input name="firm" className={inp} required /></div>
      <div className="sm:col-span-2"><label className={lb}>Practice areas</label><div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{['Aviation', 'Consumer protection', 'Contract', 'Litigation', 'Regulatory'].map((a) => <label key={a} className="flex gap-1.5"><input type="checkbox" name="area" value={a} /> {a}</label>)}</div></div>
      <div className="sm:col-span-2"><label className={lb}>Grade you are applying for (the admin confirms it)</label><select name="grade" className={inp}>{GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}</select></div>
      <div className="sm:col-span-2"><label className={lb}>Short bio</label><textarea name="bio" rows={3} maxLength={300} className={inp} /></div>
      <div className="sm:col-span-2"><label className={lb}>Call-to-bar and current practising certificates (images or PDF, up to 4MB in total)</label><input name="docs" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" required /></div>
      <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" name="consent" /> <span>I accept the <Link className="underline" href="/legal/lawyer-terms" target="_blank">Lawyer Terms</Link> and <Link className="underline" href="/legal/privacy" target="_blank">Privacy Policy</Link>, and confirm these details are accurate.</span></label>
      {s?.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{s.error}</p>}
      <button disabled={pending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">Submit application</button>
    </form>
  )
}
