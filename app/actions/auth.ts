'use server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recordConsent } from '@/lib/consent'
import { signUpError } from '@/lib/auth-errors'
import { slugify } from '@/lib/triage'

export type FormState = { error?: string; message?: string } | undefined
const HOME: Record<string, string> = { admin: '/admin', airline_staff: '/company', lawyer: '/lawyer' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const val = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const sb = await supabaseServer()
  const { data, error } = await sb.auth.signInWithPassword({ email: val(fd, 'email').toLowerCase(), password: String(fd.get('password') ?? '') })
  if (error || !data.user) return { error: 'Incorrect email or password.' } // same message for every failure
  const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  if (!p) { await sb.auth.signOut(); return { error: 'This account has no workspace yet. Contact support.' } }
  redirect(HOME[p.role] ?? '/')
}

export async function signOut() { await (await supabaseServer()).auth.signOut(); redirect('/login') }

/** Airline self-registration. The role is set here on the server, never taken from the browser. New airlines start as pending_approval. */
export async function signUpAirline(_: FormState, fd: FormData): Promise<FormState> {
  const airline = val(fd, 'airline'), name = val(fd, 'name'), email = val(fd, 'email').toLowerCase(), password = String(fd.get('password') ?? '')
  if (airline.length < 2 || name.length < 2) return { error: 'Enter the airline name and your name.' }
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: 'Use at least 10 characters with a letter and a number.' }
  if (fd.get('consent') !== 'on') return { error: 'Please accept the Airline Terms and Privacy Policy.' }
  const { data, error } = await (await supabaseServer()).auth.signUp({ email, password, options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`, data: { full_name: name } } })
  if (error) return { error: signUpError(error) }
  if (error) return { error: 'Could not create the account. Try a different email or password.' }
  const done = { message: 'Check your email to confirm your address. An admin will verify your airline before it appears to customers.' }
  const user = data.user
  if (!user || user.identities?.length === 0) return done // existing email: same reply, so emails cannot be probed
  const db = supabaseAdmin()
  let slug = slugify(airline) || 'airline'
  const { data: taken } = await db.from('airlines').select('slug').like('slug', `${slug}%`)
  if (taken?.some((t) => t.slug === slug)) slug = `${slug}-${taken.length + 1}`
  const { data: a, error: e1 } = await db.from('airlines').insert({ name: airline, slug }).select('id').single()
  if (e1 || !a) return { error: 'Could not register the airline. Please try again.' }
  const { error: e2 } = await db.from('profiles').insert({ id: user.id, role: 'airline_staff', full_name: name, airline_id: a.id })
  if (e2) { await db.from('airlines').delete().eq('id', a.id); return { error: 'Could not finish registration. Please try again.' } }
  await recordConsent(email, ['airline-terms', 'privacy'], (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim())
  return done
}
