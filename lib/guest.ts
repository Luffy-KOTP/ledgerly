import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
// A guest who passed the one-time code gets a signed, httpOnly, 15-minute cookie. No account is created.
const NAME = 'ledgerly_guest'
const sign = (p: string) => createHmac('sha256', process.env.OTP_SECRET!).update(p).digest('base64url')
export type Guest = { purpose: 'submit' | 'track'; email: string; ref?: string; exp: number }
export async function setGuest(g: Omit<Guest, 'exp'>) {
  const p = Buffer.from(JSON.stringify({ ...g, exp: Date.now() + 15 * 60_000 })).toString('base64url')
  ;(await cookies()).set(NAME, `${p}.${sign(p)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 900 })
}
export async function getGuest(purpose: Guest['purpose']): Promise<Guest | null> {
  const v = (await cookies()).get(NAME)?.value
  if (!v) return null
  const [p, s] = v.split('.')
  if (!p || !s) return null
  const a = Buffer.from(sign(p)), b = Buffer.from(s)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const g = JSON.parse(Buffer.from(p, 'base64url').toString()) as Guest
  return g.exp > Date.now() && g.purpose === purpose ? g : null
}
export async function clearGuest() { (await cookies()).delete(NAME) }
