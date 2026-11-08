import type { Metadata } from "next";
import Link from "next/link";
import { Plane } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Ledgerly: airline complaints, tracked to a resolution", template: "%s | Ledgerly" },
  description: "Complain directly to your airline, follow it to a resolution, and escalate to a lawyer or the regulator if it is not resolved.",
  openGraph: { title: "Ledgerly", description: "Airline complaints, tracked to a resolution.", type: "website", siteName: "Ledgerly" },
  title: "Ledgerly – airline complaints",
  description: "Complain directly to your airline and track the outcome.",
};
// Runs before first paint: saved choice wins, otherwise follow the device setting. Prevents a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"], ["refunds", "Refunds"], ["cookies", "Cookies"]];

// Runs before first paint: saved choice wins, otherwise follow the device setting. Prevents a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"], ["refunds", "Refunds"], ["cookies", "Cookies"], ["airline-terms", "Airline terms"], ["lawyer-terms", "Lawyer terms"]];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-sky-700 focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
        <header className="sticky top-0 z-40 bg-slate-900 text-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm" aria-label="Main">
            <Link href="/" className="mr-auto flex items-center gap-2 text-lg font-bold"><Plane className="h-5 w-5 text-sky-400" />Ledgerly</Link>
            <div className="hidden items-center gap-5 md:flex"><Link href="/submit" className="hover:text-sky-300">Submit a complaint</Link><Link href="/track" className="hover:text-sky-300">Track a complaint</Link><Link href="/apply-lawyer" className="hover:text-sky-300">For lawyers</Link><Link href="/login" className="rounded-lg border border-white/30 px-3 py-1.5 hover:bg-white/10">Staff login</Link></div>
            <ThemeToggle /><MobileNav />
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
        <footer className="border-t bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
            <div><p className="flex items-center gap-2 font-bold"><Plane className="h-4 w-4 text-sky-600" />Ledgerly</p><p className="mt-2 text-muted">Airline complaints, tracked from submission to resolution.</p></div>
            <div><p className="font-semibold">Product</p><ul className="mt-2 space-y-1 text-muted"><li><Link href="/submit" className="hover:underline">Submit a complaint</Link></li><li><Link href="/track" className="hover:underline">Track a complaint</Link></li><li><Link href="/signup" className="hover:underline">For airlines</Link></li><li><Link href="/apply-lawyer" className="hover:underline">For lawyers</Link></li></ul></div>
            <div><p className="font-semibold">Legal</p><ul className="mt-2 grid grid-cols-2 gap-1 text-muted">{LEGAL.map(([s, t]) => <li key={s}><Link href={`/legal/${s}`} className="hover:underline">{t}</Link></li>)}</ul></div>
          </div>
          <p className="border-t px-4 py-4 text-center text-xs text-muted">Ledgerly is an independent platform. It is not part of, endorsed by, or affiliated with the Nigerian Civil Aviation Authority or any airline, and it does not give legal advice.</p>
        </footer>
      <body className="min-h-full flex flex-col">
        <header className="bg-slate-900 text-white"><nav className="mx-auto flex max-w-5xl flex-wrap gap-5 p-4 text-sm"><Link href="/" className="mr-auto text-lg font-bold">✈ Ledgerly</Link><Link href="/submit">Submit a complaint</Link><Link href="/track">Track a complaint</Link><Link href="/apply-lawyer">For lawyers</Link><Link href="/login">Staff login</Link><ThemeToggle /></nav></header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">{children}</main>
        <footer className="mx-auto w-full max-w-5xl p-4 text-xs text-muted">{LEGAL.map(([s, t]) => <Link key={s} href={`/legal/${s}`} className="mr-4 underline">{t}</Link>)}</footer>
      </body>
    </html>
  );
}
