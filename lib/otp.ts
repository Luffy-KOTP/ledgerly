import 'server-only'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from './supabase/admin'
import { sendMail } from './mail'
const hash = (id: string, code: string) => createHmac('sha256', process.env.OTP_SECRET!).update(`${id}:${code}`).digest('hex')

/** Creates a 6-digit code (stored only as an HMAC), emails it if sendTo is given. Max 3 codes per subject per 10 minutes. */
export async function issueOtp(purpose: string, subject: string, sendTo?: string): Promise<{ id: string; sent: boolean } | { error: string }> {
  const db = supabaseAdmin()
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count } = await db.from('otp_challenges').select('id', { count: 'exact', head: true }).eq('subject', subject).gt('created_at', since)
  if ((count ?? 0) >= 3) return { error: 'Too many codes requested. Please wait a few minutes.' }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0'), id = randomUUID()
  await db.from('otp_challenges').insert({ id, purpose, subject, code_hash: hash(id, code), expires_at: new Date(Date.now() + 5 * 60_000).toISOString() })
  const sent = sendTo ? await sendMail(sendTo, 'Your Ledgerly code', `Your Ledgerly verification code is ${code}. It expires in 5 minutes. If you did not request it, ignore this email.`) : true
  return { id, sent }
}

/** True only for a correct, unexpired, unused code with fewer than 5 attempts. Consumes the code. */
export async function checkOtp(id: string, purpose: string, subject: string, code: string) {
  const db = supabaseAdmin()
  const { data: r } = await db.from('otp_challenges').select('*').eq('id', id).maybeSingle()
  if (!r || r.purpose !== purpose || r.subject !== subject || r.consumed_at || new Date(r.expires_at) < new Date() || r.attempts >= 5) return false
  await db.from('otp_challenges').update({ attempts: r.attempts + 1 }).eq('id', id)
  const a = Buffer.from(hash(id, code.trim())), b = Buffer.from(r.code_hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  await db.from('otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', id)
  return true
}
