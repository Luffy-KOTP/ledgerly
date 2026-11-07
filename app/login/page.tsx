'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { signIn } from '@/app/actions/auth'
const inp = 'w-full rounded-lg border bg-card p-2 text-sm'
export default function Login() {
  const [s, action, pending] = useActionState(signIn, undefined)
  return (
    <form action={action} className="mx-auto max-w-sm space-y-3 rounded-xl border bg-card p-6">
      <h1 className="text-2xl font-bold">Staff login</h1><p className="text-sm text-muted">Airline teams, lawyers and admins sign in here. Customers never need an account.</p>
      <div><label className="mb-1 block text-xs text-muted">Email</label><input name="email" type="email" autoComplete="username" className={inp} required /></div>
      <div><label className="mb-1 block text-xs text-muted">Password</label><input name="password" type="password" autoComplete="current-password" className={inp} required /></div>
      {s?.error && <p role="alert" className="text-sm text-red-600">{s.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Log in</button>
      <p className="text-sm text-muted">New airline? <Link className="underline" href="/signup">Register</Link> · Lawyer? <Link className="underline" href="/apply-lawyer">Apply</Link></p>
    </form>
  )
}
