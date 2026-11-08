'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
const LINKS = [['/submit', 'Submit a complaint'], ['/track', 'Track a complaint'], ['/apply-lawyer', 'For lawyers'], ['/signup', 'For airlines'], ['/login', 'Staff login']]
/** Phone menu. Keying <details> on the path closes it after every navigation. */
export default function MobileNav() {
  const path = usePathname()
  return (
    <details key={path} className="relative md:hidden">
      <summary aria-label="Open menu" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/30"><Menu className="h-5 w-5" /></summary>
      <nav className="absolute right-0 top-11 z-50 w-56 space-y-1 rounded-xl border bg-card p-2 text-sm text-foreground shadow-xl">{LINKS.map(([h, t]) => <Link key={h} href={h} className="block rounded-lg px-3 py-2 hover:bg-hover">{t}</Link>)}</nav>
    </details>
  )
}
