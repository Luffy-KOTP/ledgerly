import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import Workspace from '@/components/Workspace'
import { supabaseServer } from '@/lib/supabase/server'

async function Gate() {
  await connection() // wait for a real request: the login check reads the clock, which Next.js 16 forbids during prerendering
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('role, full_name, airlines(id,name,slug,status)').eq('id', user.id).single()
  const a = p?.airlines as unknown as { id: string; name: string; slug: string; status: string } | null
  if (p?.role !== 'airline_staff' || !a) redirect('/')
  if (a.status === 'suspended') return <p className="rounded-xl border bg-card p-6 text-sm">This airline account is suspended. Contact the platform admin.</p>
  return <Workspace airline={a} site={process.env.NEXT_PUBLIC_SITE_URL ?? ''} staff={p?.full_name ?? user.email ?? ''} />
}
export default function Company() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading workspace…</p>}><Gate /></Suspense>
}
