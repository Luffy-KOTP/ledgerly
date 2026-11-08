'use server'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getGuest } from '@/lib/guest'
import { initTransaction } from '@/lib/paystack'
import { feeOf, closeAndRefund } from '@/lib/legal'
import { recordConsent } from '@/lib/consent'
import { SERVICES, GRADES } from '@/lib/constants'

type LawyerCard = { id: string; name: string; firm: string | null; callYear: number; bio: string | null; rating: number; priceKobo: number }
const fail = (error: string) => ({ ok: false as const, error })
async function mine() {
  const g = await getGuest('track'); if (!g?.ref) return null
  const db = supabaseAdmin()
  const { data: c } = await db.from('complaints').select('id,ref,customer_email,airlines(name)').eq('ref', g.ref).maybeSingle()
  return c && c.customer_email === g.email ? { db, c, airline: ((c.airlines as unknown as { name: string } | null)?.name ?? '').toLowerCase() } : null
}
const conflicts = (list: string[] | null, airline: string) => (list ?? []).some((x) => x.trim() && airline.includes(x.trim().toLowerCase()))

export async function listLawyers(service: string, grade: string): Promise<{ ok: true; pct: number; lawyers: LawyerCard[] } | { ok: false; error: string }> {
  const m = await mine(); if (!m) return fail('Please verify again.')
  if (!(SERVICES as readonly string[]).includes(service) || !(GRADES as readonly string[]).includes(grade)) return fail('Choose a service and a grade.')
  const { data: st } = await m.db.from('platform_settings').select('platform_fee_pct').eq('grade', grade).single()
  const { data } = await m.db.from('lawyers').select('id,full_name,firm,call_year,bio,rating,conflicts,lawyer_prices(service,price_kobo)').eq('status', 'approved').eq('available', true).eq('grade', grade)
  const lawyers = ((data ?? []) as unknown as { id: string; full_name: string; firm: string | null; call_year: number; bio: string | null; rating: number; conflicts: string[]; lawyer_prices: { service: string; price_kobo: number }[] }[])
    .flatMap((l) => { const p = l.lawyer_prices.find((x) => x.service === service)?.price_kobo ?? 0; return p > 0 && !conflicts(l.conflicts, m.airline) ? [{ id: l.id, name: l.full_name, firm: l.firm, callYear: l.call_year, bio: l.bio, rating: Number(l.rating), priceKobo: p }] : [] })
  return { ok: true, pct: Number(st?.platform_fee_pct ?? 0), lawyers }
}

/** Amounts are re-read from the database here. Nothing the browser sends decides the price. */
export async function startCheckout(lawyerId: string, service: string, consent: boolean): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!consent) return fail('Please tick the consent box.')
  const m = await mine(); if (!m) return fail('Please verify again.')
  const { data: open } = await m.db.from('legal_cases').select('status').eq('complaint_id', m.c.id)
  if (open?.some((k) => !['declined', 'expired', 'cancelled'].includes(k.status))) return fail('You already have a legal case for this complaint.')
  const { data } = await m.db.from('lawyers').select('id,grade,status,available,conflicts,lawyer_prices(service,price_kobo)').eq('id', lawyerId).maybeSingle()
  const l = data as unknown as { id: string; grade: string; status: string; available: boolean; conflicts: string[]; lawyer_prices: { service: string; price_kobo: number }[] } | null
  const price = l?.lawyer_prices.find((x) => x.service === service)?.price_kobo ?? 0
  if (!l || l.status !== 'approved' || !l.available || price <= 0 || conflicts(l.conflicts, m.airline)) return fail('That lawyer is no longer available.')
  const { data: st } = await m.db.from('platform_settings').select('platform_fee_pct').eq('grade', l.grade).single()
  const fee = feeOf(price, Number(st?.platform_fee_pct ?? 0)), total = price + fee, reference = `LGL-${randomUUID()}`
  const { data: k, error } = await m.db.from('legal_cases').insert({ complaint_id: m.c.id, lawyer_id: l.id, service, grade: l.grade, price_kobo: price, fee_kobo: fee, total_kobo: total, status: 'pending_payment', consent_at: new Date().toISOString() }).select('id').single()
  if (error || !k) return fail('Could not start the case. Please try again.')
  await m.db.from('payments').insert({ case_id: k.id, paystack_reference: reference, amount_kobo: total, status: 'initiated' })
  try {
    const init = await initTransaction(m.c.customer_email, total, reference, `${process.env.NEXT_PUBLIC_SITE_URL}/track`)
    await recordConsent(m.c.customer_email, ['terms', 'refunds'])
    return { ok: true, url: init.authorization_url }
  } catch (e) { console.error('[paystack init]', e); await closeAndRefund(k.id, 'cancelled'); return fail('The payment page could not be opened. Please try again.') }
}

async function myCase(caseId: string) { const m = await mine(); if (!m) return null; const { data: k } = await m.db.from('legal_cases').select('id,status,complaint_id').eq('id', caseId).maybeSingle(); return k && k.complaint_id === m.c.id ? { m, k } : null }
export async function sendCustomerMessage(caseId: string, body: string) {
  const x = await myCase(caseId), t = body.trim(); if (!x || !t || t.length > 2000 || !['awaiting_lawyer', 'active'].includes(x.k.status)) return { ok: false }
  await x.m.db.from('case_messages').insert({ case_id: caseId, sender: 'customer', body: t }); return { ok: true }
}
export async function cancelCase(caseId: string) {
  const x = await myCase(caseId); if (!x || !['pending_payment', 'awaiting_lawyer'].includes(x.k.status)) return { ok: false }
  return { ok: await closeAndRefund(caseId, 'cancelled') }
}
