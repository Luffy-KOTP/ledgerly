import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import LawyerWorkspace from '@/components/LawyerWorkspace'
import { supabaseServer } from '@/lib/supabase/server'
import { getBanks } from '@/lib/banks'

async function Gate() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'lawyer') redirect('/')
  const { data: lawyer } = await sb.from('lawyers').select('*').eq('user_id', user.id).single()
  if (!lawyer) redirect('/')
  const [{ data: prices }, { data: band }] = await Promise.all([
    sb.from('lawyer_prices').select('service,price_kobo').eq('lawyer_id', lawyer.id),
    lawyer.grade ? sb.from('platform_settings').select('min_price_kobo,max_price_kobo,platform_fee_pct').eq('grade', lawyer.grade).single() : Promise.resolve({ data: null }),
  ])
  let banks: { name: string; code: string }[] = []
  try { banks = await getBanks() } catch (e) { console.error('[banks]', e) }
  return <LawyerWorkspace lawyer={lawyer} prices={prices ?? []} band={band} banks={banks} />
}
export default function LawyerPage() { return <Suspense fallback={<p className="text-sm text-muted">Loading workspace…</p>}><Gate /></Suspense> }
