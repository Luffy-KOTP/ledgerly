'use server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { GRADES } from '@/lib/constants'
import { sendMail } from '@/lib/mail'

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

// ---- Level 2 (Ledgerly intervention) and regulator referral ----
async function airlineEmails(db: ReturnType<typeof supabaseAdmin>, airlineId: string) {
  const { data: ps } = await db.from('profiles').select('id').eq('airline_id', airlineId)
  const out: string[] = []
  for (const p of ps ?? []) { const { data } = await db.auth.admin.getUserById(p.id); if (data.user?.email) out.push(data.user.email) }
  return out
}
/** A message from Ledgerly, visible to the customer and the airline, emailed to the airline's staff. */
export async function ledgerlyMessage(complaintId: string, text: string) {
  const a = await admin(), t = text.trim(); if (!a || !t || t.length > 4000) return { ok: false }
  const { data: c } = await a.db.from('complaints').select('id,ref,airline_id').eq('id', complaintId).maybeSingle(); if (!c) return { ok: false }
  await a.db.from('complaint_messages').insert({ complaint_id: c.id, sender: 'ledgerly', sender_user: a.user.id, body: t })
  for (const to of await airlineEmails(a.db, c.airline_id)) await sendMail(to, `Ledgerly message about complaint ${c.ref}`, `${t}\n\nReply to the customer from your workspace: ${process.env.NEXT_PUBLIC_SITE_URL}/company`)
  await audit(a, 'ledgerly_message', 'complaint', c.id); return { ok: true }
}
/** Records that an admin referred the complaint to the NCAA Consumer Protection Directorate (done by a person, outside this app). The airline is told. */
export async function referToRegulator(complaintId: string, reference: string) {
  const a = await admin(); if (!a) return { ok: false }
  const { data: c } = await a.db.from('complaints').select('id,ref,airline_id').eq('id', complaintId).maybeSingle(); if (!c) return { ok: false }
  const ref = reference.trim().slice(0, 100) || null
  await a.db.from('complaints').update({ regulator_referred_at: new Date().toISOString(), regulator_reference: ref, escalation_level: 3, status: 'escalated' }).eq('id', c.id)
  const body = `Ledgerly has referred this complaint to the Nigerian Civil Aviation Authority's Consumer Protection Directorate${ref ? ` (reference ${ref})` : ''}, because it was not resolved by the airline.`
  await a.db.from('complaint_messages').insert({ complaint_id: c.id, sender: 'ledgerly', sender_user: a.user.id, body })
  for (const to of await airlineEmails(a.db, c.airline_id)) await sendMail(to, `Complaint ${c.ref} referred to the NCAA`, `${body}\n\nPlease respond to the customer in your workspace: ${process.env.NEXT_PUBLIC_SITE_URL}/company`)
  await audit(a, 'regulator_referral', 'complaint', c.id, { reference: ref }); return { ok: true }
}
