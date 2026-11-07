'use server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { GRADES } from '@/lib/constants'

/** Every admin action re-checks the caller's role on the server and writes an audit entry. */
async function admin() {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(); if (!user) return null
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin' ? { user, db: supabaseAdmin() } : null
}
const audit = (a: NonNullable<Awaited<ReturnType<typeof admin>>>, action: string, entity: string, id: string, meta?: object) => a.db.from('audit_log').insert({ actor: a.user.id, action, entity, entity_id: id, meta })

export async function setAirline(id: string, status: string, verified: boolean) {
  const a = await admin(); if (!a || !['active', 'pending_approval', 'suspended'].includes(status)) return { ok: false }
  const { error } = await a.db.from('airlines').update({ status, verified }).eq('id', id); await audit(a, 'airline_update', 'airline', id, { status, verified }); return { ok: !error }
}
export async function setLawyer(id: string, action: 'approve' | 'reject' | 'suspend', grade?: string) {
  const a = await admin(); if (!a) return { ok: false }
  if (action === 'approve' && !(GRADES as readonly string[]).includes(grade ?? '')) return { ok: false }
  const patch = action === 'approve' ? { status: 'approved', grade } : { status: action === 'reject' ? 'rejected' : 'suspended', available: false }
  const { error } = await a.db.from('lawyers').update(patch).eq('id', id); await audit(a, `lawyer_${action}`, 'lawyer', id, { grade }); return { ok: !error }
}
export async function lawyerDocs(id: string) {
  const a = await admin(); if (!a) return []
  const { data: rows } = await a.db.from('lawyer_documents').select('storage_path,file_name').eq('lawyer_id', id)
  if (!rows?.length) return []
  const { data } = await a.db.storage.from('lawyer-credentials').createSignedUrls(rows.map((r) => r.storage_path), 300)
  return (data ?? []).flatMap((d, i) => d.signedUrl ? [{ name: rows[i].file_name ?? 'file', url: d.signedUrl }] : [])
}
export async function saveBands(rows: { grade: string; min: number; max: number; pct: number }[]) {
  const a = await admin(); if (!a) return { ok: false, error: 'Not allowed.' }
  for (const r of rows) if (!(GRADES as readonly string[]).includes(r.grade) || !(r.min >= 0 && r.max > r.min) || !(r.pct >= 0 && r.pct <= 50)) return { ok: false, error: 'Check the prices (max above min) and fee (0 to 50%).' }
  for (const r of rows) await a.db.from('platform_settings').update({ min_price_kobo: Math.round(r.min * 100), max_price_kobo: Math.round(r.max * 100), platform_fee_pct: r.pct }).eq('grade', r.grade)
  await audit(a, 'bands_update', 'platform_settings', 'all', { rows }); return { ok: true }
}
export async function markRegulator(alertId: string) {
  const a = await admin(); if (!a) return { ok: false }
  const { error } = await a.db.from('alerts').update({ regulator_notified_at: new Date().toISOString() }).eq('id', alertId); await audit(a, 'regulator_notified', 'alert', alertId); return { ok: !error }
}
