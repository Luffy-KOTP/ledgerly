import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'
import { supabaseServer } from '@/lib/supabase/server'

async function Gate() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'admin') redirect('/')
  return <AdminPanel email={user.email ?? ''} />
}
export default function AdminPage() { return <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}><Gate /></Suspense> }
