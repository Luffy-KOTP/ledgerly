import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseEnv } from '@/lib/supabase/env'
// Service role bypasses RLS. Use ONLY in server actions / route handlers, after you have checked the caller.
export const supabaseAdmin = () => {
  const { url } = requireSupabaseEnv(), key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local (then restart npm run dev)')
  return createClient(url, key, { auth: { persistSession: false } })
}
