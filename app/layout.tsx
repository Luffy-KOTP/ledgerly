import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ledgerly – airline complaints",
  description: "Complain directly to your airline and track the outcome.",
};
// Runs before first paint: saved choice wins, otherwise follow the device setting. Prevents a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
const LEGAL = [["terms", "Terms"], ["privacy", "Privacy"], ["refunds", "Refunds"], ["cookies", "Cookies"]];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body className="min-h-full flex flex-col">
        <header className="bg-slate-900 text-white"><nav className="mx-auto flex max-w-5xl flex-wrap gap-5 p-4 text-sm"><Link href="/" className="mr-auto text-lg font-bold">✈ Ledgerly</Link><Link href="/submit">Submit a complaint</Link><Link href="/track">Track a complaint</Link><Link href="/apply-lawyer">For lawyers</Link><Link href="/login">Staff login</Link><ThemeToggle /></nav></header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">{children}</main>
        <footer className="mx-auto w-full max-w-5xl p-4 text-xs text-muted">{LEGAL.map(([s, t]) => <Link key={s} href={`/legal/${s}`} className="mr-4 underline">{t}</Link>)}</footer>
      </body>
    </html>
  );
}
