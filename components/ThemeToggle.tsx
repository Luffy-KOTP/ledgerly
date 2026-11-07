'use client'
// Icons switch with CSS (dark: variant), so there is no state to hydrate and no flash of the wrong icon.
export default function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark')
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
  }
  return (
    <button type="button" onClick={toggle} aria-label="Toggle light and dark mode" title="Toggle light / dark" className="rounded-lg border border-white/30 px-2 py-1 text-sm leading-none">
      <span className="dark:hidden" aria-hidden>🌙</span><span className="hidden dark:inline" aria-hidden>☀️</span>
    </button>
  )
}
