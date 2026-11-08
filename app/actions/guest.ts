'use server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { issueOtp, checkOtp } from '@/lib/otp'
import { setGuest, getGuest, clearGuest } from '@/lib/guest'
import { isCritical } from '@/lib/triage'
import { recordConsent } from '@/lib/consent'
import { CATEGORIES, DESIRED, FINISHED } from '@/lib/constants'

export type Details = { name: string; email: string; phone: string; airline: string; flight: string; date: string; route: string; booking: string }
type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, PHONE = /^\+[1-9]\d{7,14}$/, FLIGHT = /^[A-Z0-9]{2}\d{1,4}$/, REF = /^LDG-\d{4}-\d{5}$/
const CATS = ['Flight Delay / Cancellation', 'Baggage', 'Safety / Medical Incident', 'Refund / Billing', 'Cabin & Crew Service', 'Boarding & Airport']
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], MAX_TOTAL = 4 * 1024 * 1024
const fail = (error: string) => ({ ok: false as const, error })

function checkDetails(d: Details): string | null {
  if (d.name.trim().split(/\s+/).length < 2) return 'Enter your full name.'
  if (!EMAIL.test(d.email)) return 'Enter a valid email address.'
  if (!PHONE.test(d.phone)) return 'Enter a valid phone number.'
  if (!FLIGHT.test(d.flight)) return 'Enter a flight number such as SK412.'
  if (!d.date || new Date(d.date) > new Date()) return 'Pick a flight date that is not in the future.'
  if (d.booking && !/^[A-Z0-9]{5,10}$/i.test(d.booking)) return 'Booking reference should be 5–10 letters or numbers.'
  return null
}
const activeAirline = async (slug: string) => (await supabaseAdmin().from('airlines').select('id,name').eq('slug', slug).eq('status', 'active').maybeSingle()).data

export async function startSubmit(d: Details): Promise<Res<{ id: string }>> {
  d = { ...d, flight: d.flight.toUpperCase().replace(/\s/g, ''), email: d.email.trim().toLowerCase() }
  const e = checkDetails(d); if (e) return fail(e)
  if (!(await activeAirline(d.airline))) return fail('That airline is not accepting complaints yet.')
  const r = await issueOtp('submit', `submit:${d.email}`, d.email)
  if ('error' in r) return fail(r.error)
  if (!r.sent) return fail('We could not send the email. Check the address and try again shortly.')
  return { ok: true, id: r.id }
}

export async function verifySubmit(id: string, email: string, code: string): Promise<Res> {
  email = email.trim().toLowerCase()
  if (!(await checkOtp(id, 'submit', `submit:${email}`, code))) return fail('That code is wrong or has expired.')
  await setGuest({ purpose: 'submit', email })
  return { ok: true }
}

export async function submitComplaint(fd: FormData): Promise<Res<{ ref: string; critical: boolean }>> {
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const d: Details = { name: s('name'), email: s('email').toLowerCase(), phone: s('phone'), airline: s('airline'), flight: s('flight').toUpperCase().replace(/\s/g, ''), date: s('date'), route: s('route'), booking: s('booking').toUpperCase() }
  const g = await getGuest('submit')
  if (!g || g.email !== d.email) return fail('Your verification expired. Please start again.')
  const e = checkDetails(d); if (e) return fail(e)
  const category = s('category'), subject = s('subject'), description = s('description'), rating = Number(s('rating'))
  const desired = s('desired'), desiredNote = s('desiredNote').slice(0, 1000)
  if (!(CATEGORIES as readonly string[]).includes(category)) return fail('Choose a category.')
  if (!(DESIRED as readonly string[]).includes(desired)) return fail('Tell us what you would like the airline to do.')
  if (!CATS.includes(category)) return fail('Choose a category.')
  if (subject.length < 3 || subject.length > 120) return fail('Add a short subject.')
  if (description.length < 30 || description.length > 4000) return fail('Describe the issue in 30 to 4000 characters.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('Pick a star rating.')
  if (s('consent') !== 'on') return fail('Please accept the Terms and Privacy Policy.')
  const files = (fd.getAll('files') as File[]).filter((f) => f.size > 0)
  if (files.length > 5 || files.some((f) => !MIME.includes(f.type)) || files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return fail('Attach up to 5 images or PDFs, 4MB in total.')
  const airline = await activeAirline(d.airline); if (!airline) return fail('That airline is not accepting complaints yet.')

  const db = supabaseAdmin(), critical = isCritical(category, subject, description)
  const { data: c, error } = await db.from('complaints').insert({
    airline_id: airline.id, customer_name: d.name, customer_email: d.email, customer_phone: d.phone, flight_number: d.flight, flight_date: d.date,
    route: d.route || null, booking_ref: d.booking || null, category, subject, description, rating, desired_resolution: desiredNote ? `${desired}: ${desiredNote}` : desired, is_critical: critical, severity: critical ? 'critical' : rating <= 2 ? 'medium' : 'low',
    route: d.route || null, booking_ref: d.booking || null, category, subject, description, rating, is_critical: critical, severity: critical ? 'critical' : rating <= 2 ? 'medium' : 'low',
  }).select('id, ref').single()
  if (error || !c) return fail('Something went wrong. Please try again.')
  await db.from('complaint_events').insert([{ complaint_id: c.id, kind: 'submitted', detail: 'Complaint submitted' }, { complaint_id: c.id, kind: 'verified', detail: 'Identity verified by one-time code' }])
  if (critical) {
    await db.from('alerts').insert({ airline_id: airline.id, complaint_id: c.id, source: 'customer_report', title: subject })
    await db.from('complaint_events').insert({ complaint_id: c.id, kind: 'critical', detail: 'Critical incident: airline alerted instantly' })
  }
  for (const f of files) { // TODO in production: malware-scan files and check their real type, not just the declared one
    const path = `${c.id}/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)}`
    const up = await db.storage.from('complaint-attachments').upload(path, f, { contentType: f.type })
    if (!up.error) await db.from('attachments').insert({ complaint_id: c.id, storage_path: path, file_name: f.name, mime: f.type, size_bytes: f.size })
  }
  await recordConsent(d.email, ['terms', 'privacy'], (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim())
  await clearGuest()
  return { ok: true, ref: c.ref, critical }
}

// ---- tracking: reference + one-time code sent to the email on file. Same response whether or not the reference exists. ----
export async function startTrack(refIn: string): Promise<Res<{ id: string }>> {
  const ref = refIn.trim().toUpperCase()
  if (!REF.test(ref)) return fail('Enter a reference like LDG-2026-01001.')
  const { data: c } = await supabaseAdmin().from('complaints').select('customer_email').eq('ref', ref).maybeSingle()
  const r = await issueOtp('track', `track:${ref}`, c?.customer_email) // a send failure is not reported, so the reply never reveals whether the reference exists
  return 'error' in r ? fail(r.error) : { ok: true, id: r.id }
}

export async function verifyTrack(id: string, refIn: string, code: string): Promise<Res> {
  const ref = refIn.trim().toUpperCase()
  const ok = await checkOtp(id, 'track', `track:${ref}`, code)
  const { data: c } = await supabaseAdmin().from('complaints').select('customer_email').eq('ref', ref).maybeSingle()
  if (!ok || !c) return fail('That code is wrong or has expired.')
  await setGuest({ purpose: 'track', email: c.customer_email, ref })
  return { ok: true }
}

// ---- conversation, resolutions and escalation (all require the verified /track session) ----
async function mine() {
  const g = await getGuest('track'); if (!g?.ref) return null
  const db = supabaseAdmin()
  const { data: c } = await db.from('complaints').select('id,customer_email,status,response_due_at').eq('ref', g.ref).maybeSingle()
  return c && c.customer_email === g.email ? { db, c } : null
}
export async function customerMessage(body: string): Promise<Res> {
  const m = await mine(), t = body.trim()
  if (!m || !t || t.length > 4000) return fail('Write a message first.')
  if (m.c.status === 'closed') return fail('This complaint is closed.')
  await m.db.from('complaint_messages').insert({ complaint_id: m.c.id, sender: 'customer', body: t })
  if (['awaiting_customer', 'responded'].includes(m.c.status)) await m.db.from('complaints').update({ status: 'in_progress' }).eq('id', m.c.id)
  return { ok: true }
}
/** The customer, not the airline, decides whether a proposed resolution settles the complaint. */
export async function decideResolution(id: string, accept: boolean, comment: string): Promise<Res> {
  const m = await mine(); if (!m) return fail('Please verify again.')
  const { data: r } = await m.db.from('complaint_resolutions').update({ status: accept ? 'accepted' : 'rejected', customer_comment: comment.trim().slice(0, 1000) || null, decided_at: new Date().toISOString() }).eq('id', id).eq('complaint_id', m.c.id).eq('status', 'proposed').select('id').maybeSingle()
  if (!r) return fail('That proposal is no longer open.')
  await m.db.from('complaints').update(accept ? { status: 'resolved', resolved_at: new Date().toISOString() } : { status: 'in_progress', resolved_at: null }).eq('id', m.c.id)
  await m.db.from('complaint_events').insert({ complaint_id: m.c.id, kind: 'resolution', detail: accept ? 'Customer accepted the proposed resolution' : 'Customer rejected the proposed resolution' })
  return { ok: true }
}
/** Allowed when the airline is past its resolution deadline, or the customer has rejected an offer. */
export async function requestIntervention(): Promise<Res> {
  const m = await mine(); if (!m) return fail('Please verify again.')
  if (FINISHED.includes(m.c.status)) return fail('This complaint is already finished.')
  const { data: rej } = await m.db.from('complaint_resolutions').select('id').eq('complaint_id', m.c.id).eq('status', 'rejected').limit(1)
  const overdue = !!m.c.response_due_at && new Date(m.c.response_due_at) < new Date()
  if (!overdue && !rej?.length) return fail('You can ask Ledgerly to step in once the airline is past its deadline or you have rejected its offer.')
  const { data: u } = await m.db.from('complaints').update({ escalation_level: 2, ledgerly_requested_at: new Date().toISOString(), status: 'escalated' }).eq('id', m.c.id).is('ledgerly_requested_at', null).select('id').maybeSingle()
  if (!u) return fail('Ledgerly has already been asked to step in.')
  await m.db.from('complaint_events').insert({ complaint_id: m.c.id, kind: 'escalation', detail: 'Customer requested Ledgerly intervention' })
  await m.db.from('complaint_messages').insert({ complaint_id: m.c.id, sender: 'ledgerly', body: 'The customer has asked Ledgerly to step in. Our team will review this complaint and contact the airline.' })
  return { ok: true }
}
