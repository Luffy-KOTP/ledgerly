'use server'
import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recordConsent } from '@/lib/consent'
import { signUpError } from '@/lib/auth-errors'
import { closeAndRefund } from '@/lib/legal'
import { resolveAccount, createRecipient, transfer } from '@/lib/paystack'
import { SERVICES, GRADES } from '@/lib/constants'
import type { FormState } from './auth'

const val = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Lawyer application: creates the login, a pending lawyer record and the uploaded credentials. An admin must verify and assign the grade. */
export async function applyLawyer(_: FormState, fd: FormData): Promise<FormState> {
  const name = val(fd, 'name'), email = val(fd, 'email').toLowerCase(), password = String(fd.get('password') ?? ''), yr = Number(val(fd, 'year'))
  const enrol = val(fd, 'enrolment'), branch = val(fd, 'branch'), firm = val(fd, 'firm'), grade = val(fd, 'grade'), bio = val(fd, 'bio').slice(0, 300)
  const areas = fd.getAll('area').map(String), files = (fd.getAll('docs') as File[]).filter((f) => f.size > 0)
  if (name.split(/\s+/).length < 2) return { error: 'Enter your full name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: 'Use at least 10 characters with a letter and a number.' }
  if (!(yr >= 1960 && yr <= new Date().getFullYear())) return { error: 'Enter the year you were called to the bar.' }
  if (enrol.length < 4 || !branch || !firm) return { error: 'Enter your enrolment number, bar branch and firm.' }
  if (!areas.length || !(GRADES as readonly string[]).includes(grade)) return { error: 'Pick your practice areas and the grade you are applying for.' }
  if (!files.length || files.length > 4 || files.some((f) => !MIME.includes(f.type)) || files.reduce((n, f) => n + f.size, 0) > 4 * 1024 * 1024) return { error: 'Attach 1 to 4 credential files (images or PDF), 4MB in total.' }
  if (fd.get('consent') !== 'on') return { error: 'Please accept the Lawyer Terms and Privacy Policy.' }
  const { data, error } = await (await supabaseServer()).auth.signUp({ email, password, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`, data: { full_name: name } } })
  if (error) return { error: signUpError(error) }
  const done = { message: 'Check your email to confirm your address. We will verify your credentials and assign your grade before you appear to customers.' }
  const user = data.user
  if (!user || user.identities?.length === 0) return done
  const db = supabaseAdmin()
  const { data: l, error: e1 } = await db.from('lawyers').insert({ user_id: user.id, full_name: name, firm, call_year: yr, enrolment_no: enrol, bar_branch: branch, practice_areas: areas, requested_grade: grade, bio }).select('id').single()
  if (e1 || !l) return { error: 'Could not save your application. Please try again.' }
  await db.from('profiles').insert({ id: user.id, role: 'lawyer', full_name: name })
  for (const f of files) {
    const path = `${l.id}/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)}`
    if (!(await db.storage.from('lawyer-credentials').upload(path, f, { contentType: f.type })).error) await db.from('lawyer_documents').insert({ lawyer_id: l.id, storage_path: path, file_name: f.name })
  }
  await recordConsent(email, ['lawyer-terms', 'privacy'], (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim())
  return done
}

async function me() {
  const { data: { user } } = await (await supabaseServer()).auth.getUser(); if (!user) return null
  const db = supabaseAdmin(), { data: l } = await db.from('lawyers').select('*').eq('user_id', user.id).maybeSingle()
  return l ? { db, l } : null
}
async function own(caseId: string) {
  const m = await me(); if (!m || m.l.status !== 'approved') return null
  const { data: k } = await m.db.from('legal_cases').select('*').eq('id', caseId).eq('lawyer_id', m.l.id).maybeSingle()
  return k ? { ...m, k } : null
}
type Res = { ok: boolean; error?: string }

export async function saveProfile(i: { bio: string; available: boolean; conflicts: string; bankCode: string; accountNo: string; prices: Record<string, string> }): Promise<Res> {
  const m = await me(); if (!m || m.l.status !== 'approved') return { ok: false, error: 'Your profile is not approved yet.' }
  const hasBank = !!(i.accountNo && i.bankCode)
  if ((i.accountNo || i.bankCode) && (!/^\d{10}$/.test(i.accountNo) || !i.bankCode)) return { ok: false, error: 'Choose a bank and enter a 10-digit account number.' }
  const bankChanged = i.accountNo !== (m.l.payout_account_no ?? '') || i.bankCode !== (m.l.payout_bank_code ?? '')
  if (hasBank && bankChanged) { try { await resolveAccount(i.accountNo, i.bankCode) } catch { return { ok: false, error: 'We could not verify that bank account.' } } }
  const rows = SERVICES.flatMap((s) => { const v = Math.round(Number(i.prices[s] || 0) * 100); return v > 0 ? [{ lawyer_id: m.l.id, service: s, price_kobo: v }] : [] })
  if (i.available && (!hasBank || !rows.length)) return { ok: false, error: 'Add payout details and at least one price before accepting requests.' }
  const unused = SERVICES.filter((s) => !rows.some((r) => r.service === s))
  if (unused.length) await m.db.from('lawyer_prices').delete().eq('lawyer_id', m.l.id).in('service', unused)
  if (rows.length) { const { error } = await m.db.from('lawyer_prices').upsert(rows); if (error) return { ok: false, error: /band/i.test(error.message) ? 'A price is outside your grade band.' : 'Could not save prices.' } }
  await m.db.from('lawyers').update({ bio: i.bio.slice(0, 300), available: i.available, conflicts: i.conflicts.split(',').map((x) => x.trim()).filter(Boolean), payout_bank_code: i.bankCode || null, payout_account_no: i.accountNo || null, ...(bankChanged ? { paystack_recipient_code: null } : {}) }).eq('id', m.l.id)
  return { ok: true }
}

export async function acceptCase(id: string): Promise<Res> {
  const x = await own(id); if (!x) return { ok: false }
  const { data } = await x.db.from('legal_cases').update({ status: 'active', accepted_at: new Date().toISOString() }).eq('id', id).eq('status', 'awaiting_lawyer').select('id').maybeSingle()
  if (data) await x.db.from('case_messages').insert({ case_id: id, sender: 'system', body: 'Your lawyer has accepted the case.' })
  return { ok: !!data }
}
export async function declineCase(id: string): Promise<Res> { const x = await own(id); return { ok: !!x && (await closeAndRefund(id, 'declined')) } }
export async function lawyerMessage(id: string, body: string): Promise<Res> {
  const x = await own(id), t = body.trim(); if (!x || !t || t.length > 2000 || x.k.status !== 'active') return { ok: false }
  await x.db.from('case_messages').insert({ case_id: id, sender: 'lawyer', body: t }); return { ok: true }
}

/** Completing a case pays the lawyer their fee (the platform fee stays with the platform). One payout per case, enforced by the database. */
export async function completeCase(id: string): Promise<Res> {
  const x = await own(id); if (!x || x.k.status !== 'active') return { ok: false }
  const l = x.l; if (!l.payout_account_no || !l.payout_bank_code) return { ok: false, error: 'Add payout details first.' }
  const { error: pe } = await x.db.from('payouts').insert({ case_id: id, lawyer_id: l.id, amount_kobo: x.k.price_kobo, status: 'pending' })
  if (pe) return { ok: false, error: 'A payout for this case already exists.' }
  const { data: done } = await x.db.from('legal_cases').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id).eq('status', 'active').select('id').maybeSingle()
  if (!done) { await x.db.from('payouts').delete().eq('case_id', id); return { ok: false } }
  await x.db.from('case_messages').insert({ case_id: id, sender: 'system', body: 'The lawyer marked this case complete.' })
  try {
    const acct = await resolveAccount(l.payout_account_no, l.payout_bank_code)
    let rc: string | null = l.paystack_recipient_code
    if (!rc) { rc = (await createRecipient(acct.account_name, l.payout_account_no, l.payout_bank_code)).recipient_code; await x.db.from('lawyers').update({ paystack_recipient_code: rc }).eq('id', l.id) }
    const t = await transfer(x.k.price_kobo, rc, `payout-${id}`, `Ledgerly ${x.k.ref}`)
    await x.db.from('payouts').update({ paystack_transfer_code: t.transfer_code, status: 'processing' }).eq('case_id', id)
    return { ok: true }
  } catch (e) {
    console.error('[payout failed]', id, e)
    await x.db.from('payouts').update({ status: 'failed' }).eq('case_id', id)
    await x.db.from('audit_log').insert({ action: 'payout_failed', entity: 'legal_case', entity_id: id, meta: { error: String(e) } })
    return { ok: true, error: 'Case completed, but the payout needs a retry by the admin.' }
  }
}
