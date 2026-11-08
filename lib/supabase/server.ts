import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabaseEnv } from '@/lib/supabase/env'
export async function supabaseServer() {
  const store = await cookies()
  const { url, key } = requireSupabaseEnv()
  return createServerClient(url, key, {
    cookies: { getAll: () => store.getAll(), setAll: (l) => { try { l.forEach(({ name, value, options }) => store.set(name, value, options)) } catch {} } },
  })
}
