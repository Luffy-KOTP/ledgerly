// The one place that reads the Supabase settings. The key can be named ANON (older projects) or PUBLISHABLE (newer dashboard).
export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local (then restart npm run dev)')
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from .env.local (then restart npm run dev)')
  return { url, key }
}
