'use server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/mail'
import { AIRLINE_STATUSES, RESOLUTION_KINDS } from '@/lib/constants'
// These run with the signed-in user's session, so Row Level Security still limits every call to their own airline.
type Res = { ok: boolean; error?: string }
const notify = (to: string, ref: string, text: string) => sendMail(to, `Update on your complaint ${ref}`, `${text}\n\nSee the full conversation any time: ${process.env.NEXT_PUBLIC_SITE_URL}/track (you will confirm it is you with a one-time code).`)
async function me() { const sb = await supabaseServer(); const { data: { user } } = await sb.auth.getUser(); return { sb, user } }
async function complaintOf(sb: Awaited<ReturnType<typeof supabaseServer>>, id: string) { return (await sb.from('complaints').select('id,ref,status,customer_email').eq('id', id).maybeSingle()).data }

export async function ackAlert(id: string): Promise<Res> {
  const { sb, user } = await me(); if (!user) return { ok: false }
  const { data: a } = await sb.from('alerts').update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }).eq('id', id).is('acknowledged_at', null).select('complaint_id').maybeSingle()
  if (a?.complaint_id) {
    await sb.from('complaints').update({ status: 'in_progress' }).eq('id', a.complaint_id).in('status', ['pending', 'received', 'under_review'])
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
/** Airlines move a complaint through the working stages. "Resolved" is reserved for the customer accepting a resolution; "closed" only follows resolved. */
export async function setStatus(id: string, status: string): Promise<Res> {
  const { sb, user } = await me(); if (!user) return { ok: false }
  const c = await complaintOf(sb, id); if (!c) return { ok: false }
  const allowed = (AIRLINE_STATUSES as readonly string[]).includes(status) || (status === 'closed' && c.status === 'resolved')
  if (!allowed) return { ok: false, error: status === 'resolved' ? 'A complaint becomes resolved when the customer accepts a resolution.' : 'That status change is not allowed.' }
  const { data } = await sb.from('complaints').update({ status }).eq('id', id).select('id').maybeSingle()
  if (data) { await sb.from('complaint_events').insert({ complaint_id: id, kind: 'status', detail: `Status changed to ${status}`, actor: user.id }); await notify(c.customer_email, c.ref, `The status of your complaint ${c.ref} is now: ${status.replace(/_/g, ' ')}.`) }
  return { ok: !!data }
}
/** A reply the customer can see. The database records when the airline first responded. */
export async function sendMessage(id: string, text: string): Promise<Res> {
  const { sb, user } = await me(); const t = text.trim(); if (!user || !t || t.length > 4000) return { ok: false }
  const c = await complaintOf(sb, id); if (!c || c.status === 'closed') return { ok: false }
  const { error } = await sb.from('complaint_messages').insert({ complaint_id: id, sender: 'airline', sender_user: user.id, body: t })
  if (error) return { ok: false }
  await sb.from('complaints').update({ status: 'responded' }).eq('id', id).in('status', ['pending', 'received', 'under_review', 'in_progress'])
  await notify(c.customer_email, c.ref, `The airline replied to your complaint ${c.ref}:\n\n${t}`)
  return { ok: true }
}
/** Private to the airline: stored in a separate table the customer can never read. */
export async function addNote(id: string, text: string): Promise<Res> {
  const { sb, user } = await me(); const t = text.trim(); if (!user || !t || t.length > 4000) return { ok: false }
  const { error } = await sb.from('complaint_internal_notes').insert({ complaint_id: id, author: user.id, body: t }); return { ok: !error }
}
export async function proposeResolution(id: string, kind: string, details: string): Promise<Res> {
  const { sb, user } = await me(); const d = details.trim()
  if (!user || !(RESOLUTION_KINDS as readonly string[]).includes(kind) || !d || d.length > 2000) return { ok: false }
  const c = await complaintOf(sb, id); if (!c || ['resolved', 'closed'].includes(c.status)) return { ok: false }
  const { error } = await sb.from('complaint_resolutions').insert({ complaint_id: id, proposed_by: user.id, kind, details: d })
  if (error) return { ok: false }
  await sb.from('complaints').update({ status: 'resolution_proposed' }).eq('id', id)
  await sb.from('complaint_events').insert({ complaint_id: id, kind: 'resolution', detail: `Airline proposed: ${kind}`, actor: user.id })
  await notify(c.customer_email, c.ref, `The airline has proposed a resolution to your complaint ${c.ref}: ${kind}.\n\n${d}\n\nYou can accept or reject it on your tracking page.`)
  return { ok: true }
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
