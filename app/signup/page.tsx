'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { signUpAirline } from '@/app/actions/auth'
const inp = 'w-full rounded-lg border bg-card p-2 text-sm', lb = 'mb-1 block text-xs text-muted'
export default function Signup() {
  const [s, action, pending] = useActionState(signUpAirline, undefined)
  if (s?.message) return <div className="mx-auto max-w-sm rounded-xl border bg-card p-6 text-sm">{s.message} <Link className="underline" href="/login">Back to login</Link></div>
  return (
    <form action={action} className="mx-auto max-w-sm space-y-3 rounded-xl border bg-card p-6">
      <h1 className="text-2xl font-bold">Register your airline</h1>
      <div><label className={lb}>Airline name</label><input name="airline" className={inp} required /></div>
      <div><label className={lb}>Your name</label><input name="name" autoComplete="name" className={inp} required /></div>
      <div><label className={lb}>Work email</label><input name="email" type="email" autoComplete="email" className={inp} required /></div>
      <div><label className={lb}>Password (10+ characters, with a letter and a number)</label><input name="password" type="password" autoComplete="new-password" className={inp} required /></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="consent" /> <span>I accept the <Link className="underline" href="/legal/airline-terms" target="_blank">Airline Terms</Link> and <Link className="underline" href="/legal/privacy" target="_blank">Privacy Policy</Link>.</span></label>
      {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create account</button>
    </form>
  )
}
