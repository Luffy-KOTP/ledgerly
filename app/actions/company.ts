'use server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/mail'
// These run with the signed-in user's session, so Row Level Security still limits every call to their own airline.
const STATUS = ['pending', 'in_progress', 'resolved', 'escalated']
const notify = (to: string, ref: string, text: string) => sendMail(to, `Update on your complaint ${ref}`, `${text}\n\nSee the full status any time: ${process.env.NEXT_PUBLIC_SITE_URL}/track (you will confirm it is you with a one-time code).`)
async function me() { const sb = await supabaseServer(); const { data: { user } } = await sb.auth.getUser(); return { sb, user } }

export async function ackAlert(id: string) {
  const { sb, user } = await me(); if (!user) return { ok: false }
  const { data: a } = await sb.from('alerts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }).eq('id', id).is('acknowledged_at', null).select('complaint_id').maybeSingle()
  if (a?.complaint_id) {
    await sb.from('complaints').update({ status: 'in_progress' }).eq('id', a.complaint_id).eq('status', 'pending')
    await sb.from('complaint_events').insert({ complaint_id: a.complaint_id, kind: 'acknowledged', detail: 'Airline acknowledged the incident', actor: user.id })
  }
  return { ok: !!a }
}
export async function setStatus(id: string, status: string) {
  const { sb, user } = await me(); if (!user || !STATUS.includes(status)) return { ok: false }
  const { data } = await sb.from('complaints').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', id).select('id,ref,customer_email').maybeSingle()
  if (data) { await sb.from('complaint_events').insert({ complaint_id: id, kind: 'status', detail: `Status changed to ${status}`, actor: user.id }); await notify(data.customer_email, data.ref, `The status of your complaint ${data.ref} is now: ${status.replace('_', ' ')}.`) }
  return { ok: !!data }
}
export async function publishUpdate(id: string, text: string) {
  const { sb, user } = await me(); const t = text.trim(); if (!user || t.length < 1 || t.length > 1000) return { ok: false }
  const { data } = await sb.from('complaints').update({ airline_response: t }).eq('id', id).select('id,ref,customer_email').maybeSingle()
  if (data) { await sb.from('complaint_events').insert({ complaint_id: id, kind: 'update', detail: 'Update published to customer', actor: user.id }); await notify(data.customer_email, data.ref, `The airline replied to your complaint ${data.ref}:\n\n${t}`) }
  return { ok: !!data }
}
/** Private files: the user's own session proves they may see the complaint, then a short-lived signed link is created. */
export async function attachmentLinks(id: string) {
  const { sb, user } = await me(); if (!user) return []
  const { data: rows } = await sb.from('attachments').select('storage_path,file_name').eq('complaint_id', id)
  if (!rows?.length) return []
  const { data } = await supabaseAdmin().storage.from('complaint-attachments').createSignedUrls(rows.map((r) => r.storage_path), 300)
  return (data ?? []).flatMap((d, i) => d.signedUrl ? [{ name: rows[i].file_name ?? 'file', url: d.signedUrl }] : [])
}
