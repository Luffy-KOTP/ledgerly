import { createClient } from '@supabase/supabase-js'
import { requireSupabaseEnv } from '@/lib/supabase/env'

/** Active airlines, read fresh on every request so a newly approved airline shows up immediately.
 *  A failed query throws (it is never hidden as an empty list). */
export async function getAirlines() {
  const { url, key } = requireSupabaseEnv()
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } })
    .from('airline_directory').select('id,name,slug,industry,avg_rating,review_count').order('name')
  if (error) { console.error('[airline_directory]', error.message); throw new Error(error.message) }
  return data ?? []
}
