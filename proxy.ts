import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requireSupabaseEnv } from '@/lib/supabase/env'

const AREA: Record<string, string> = { '/admin': 'admin', '/company': 'airline_staff', '/lawyer': 'lawyer' }

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const { url, key } = requireSupabaseEnv()
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (l) => { l.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); l.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
    },
  })
  const area = Object.keys(AREA).find((p) => req.nextUrl.pathname.startsWith(p))
  if (!area) return res
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== AREA[area]) return NextResponse.redirect(new URL('/', req.url))
  return res // convenience only: Row Level Security is the real protection
}

export const config = { matcher: ['/admin/:path*', '/company/:path*', '/lawyer/:path*'] }
