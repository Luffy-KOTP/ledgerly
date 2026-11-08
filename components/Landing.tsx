import Link from 'next/link'
import { Plane, ShieldAlert, KeyRound, SearchCheck, Scale, EyeOff, Mail, Bell, CheckCircle2, Lock, Gavel, ArrowRight, Building2, Smartphone, FileText, Sun } from 'lucide-react'
import Reveal from './Reveal'

const btn = 'inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800'
const btn2 = 'inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-3 text-sm font-semibold transition hover:bg-hover'
const H2 = ({ k, t, d }: { k: string; t: string; d?: string }) => <div className="mx-auto mb-8 max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">{k}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{t}</h2>{d && <p className="mt-2 text-sm text-muted">{d}</p>}</div>

/** Illustration: sky, sun, drifting clouds, a plane crossing the screen, and a runway. */
function HeroArt() {
  const cloud = (cls: string) => <svg viewBox="0 0 120 50" className={`drift absolute fill-white/90 dark:fill-slate-300/20 ${cls}`} aria-hidden><ellipse cx="40" cy="32" rx="30" ry="14" /><ellipse cx="68" cy="26" rx="26" ry="16" /><ellipse cx="92" cy="34" rx="22" ry="12" /></svg>
  return (
    <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300 via-sky-100 to-white sm:h-72 dark:from-slate-900 dark:via-sky-950 dark:to-slate-800" role="img" aria-label="An airplane flying across the sky">
      <div className="absolute right-10 top-8 h-14 w-14 rounded-full bg-amber-300 shadow-[0_0_60px_20px_rgba(252,211,77,.55)] dark:bg-slate-200 dark:shadow-[0_0_50px_14px_rgba(226,232,240,.25)]" />
      {cloud('left-[8%] top-[18%] w-28')}{cloud('left-[48%] top-[48%] w-36 [animation-delay:-8s]')}{cloud('left-[72%] top-[12%] w-24 [animation-delay:-4s]')}
      <div className="fly w-24 sm:w-32"><Plane className="h-full w-full -rotate-12 fill-white stroke-sky-700 dark:fill-sky-200" strokeWidth={1.2} /></div>
      <div className="absolute inset-x-0 bottom-0 h-8 bg-slate-700 dark:bg-slate-950"><div className="mt-[14px] h-1 w-full bg-[repeating-linear-gradient(90deg,#fde68a_0_36px,transparent_36px_72px)]" /></div>
    </div>
  )
}

function PhoneCode() {
  return (
    <div className="floaty mx-auto w-44 rounded-[2rem] border-4 border-slate-800 bg-card p-3 shadow-xl dark:border-slate-500">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-600" />
      <p className="text-center text-[10px] text-muted">Your Ledgerly code</p>
      <div className="mt-2 flex justify-center gap-1">{['4', '8', '2', '9', '1', '3'].map((d, i) => <span key={i} className="pop rounded bg-hover px-1.5 py-1 text-sm font-bold" style={{ animationDelay: `${i * 120}ms` }}>{d}</span>)}</div>
      <div className="mt-3 rounded-lg bg-sky-700 py-1.5 text-center text-xs font-semibold text-white">Verify</div>
      <p className="mt-2 text-center text-[10px] text-muted">Expires in 5 minutes</p>
    </div>
  )
}

function AlertCard() {
  return (
    <div className="ring rounded-xl border-2 border-red-600 bg-card p-4 text-left">
      <p className="text-sm font-bold text-red-600">Critical incident · customer report</p>
      <p className="mt-1 text-sm">Passenger unwell, no air conditioning on flight</p>
      <p className="mt-1 text-xs text-muted">2 min ago · Level 1: Complaints desk notified</p>
      <div className="mt-3 inline-block rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white">Acknowledge</div>
    </div>
  )
}

function Timeline() {
  const steps = [['Complaint submitted', true], ['Received by the airline', true], ['Under review', true], ['Resolution', false]] as const
  return (
    <ol className="ml-2 space-y-4 border-l-2 pl-5 text-sm">{steps.map(([t, ok], i) => <li key={t} className="relative"><span className={`absolute -left-[1.7rem] top-0.5 h-3 w-3 rounded-full ${ok ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'}`} /><b className={ok ? '' : 'text-muted'}>{t}</b><span className="block text-xs text-muted">{['Today', 'Today', 'The airline is working on it', 'Awaiting outcome'][i]}</span></li>)}</ol>
  )
}

const FEATURES = [
  [KeyRound, 'No account needed', 'Verify with a one-time code sent to your email. No password to remember and no sign-up form.'],
  [SearchCheck, 'A reference number you can track', 'Every complaint gets a reference. Check progress, message the airline, and accept or reject its proposed resolution.'],
  [ShieldAlert, 'Safety reports jump the queue', 'Reports about injuries, smoke or medical emergencies are flagged critical and raise a loud alert for the airline.'],
  [Bell, 'Escalation if nobody responds', 'An unanswered critical alert moves up to the duty manager, then is flagged for regulator notification.'],
  [Mail, 'Updates in your inbox', 'When the airline replies or changes the status, you get an email, so you do not have to keep checking.'],
  [Scale, 'Lawyers when you need them', 'Escalate to a verified lawyer for a demand letter, mediation, a regulator petition or court representation.'],
  [EyeOff, 'Your details stay private', 'The public feed shows only your first name and an excerpt. A lawyer sees your contact details only after accepting your case.'],
  [Sun, 'Light and dark, on any screen', 'Works on phones, tablets and computers, in light or dark mode.'],
] as const

const STEPS = [
  ['1', 'Tell us what happened', 'Pick the airline, add your flight, describe the problem and attach photos or documents.', <FileText key="i" className="h-10 w-10 text-sky-600" />],
  ['2', 'Confirm it is you', 'We email a six-digit code. Enter it and your complaint is submitted. No account.', <PhoneCode key="i" />],
  ['3', 'The airline is alerted', 'The complaint appears in the airline\u2019s workspace. Safety reports raise a critical alert straight away.', <AlertCard key="i" />],
  ['4', 'Follow it to a resolution', 'Track every step with your reference, chat with the airline, accept or reject its offer, and escalate if you need to.', <Timeline key="i" />],
] as const

const GRADES = [['Junior', 'Recently called to the bar, up to 3 years of experience.'], ['Mid-level', '4 to 9 years of practice.'], ['Senior', '10+ years, or head of chambers.'], ['Corporate firm', 'Lawyers at established corporate firms.']]
const FAQ = [
  ['Do I need an account?', 'No. You confirm your email with a one-time code each time. Airlines and lawyers have their own accounts.'],
  ['Who can see my details?', 'The airline you complain to sees your complaint and contact details. The public feed shows only your first name and an excerpt. A lawyer sees your details only after they accept your case.'],
  ['What happens with a safety incident?', 'It is flagged critical and shown as an alert in the airline\u2019s workspace. If nobody acknowledges it, it escalates automatically. If anyone is in danger right now, tell the crew or call emergency services first.'],
  ['How does the lawyer service work?', 'You choose a service and a grade, pick a lawyer and pay through Paystack. The payment is held until the lawyer completes the work. If they decline or do not respond in 48 hours, you are refunded.'],
  ['What if the airline does not respond?', 'Each complaint has a 7-day resolution window. If the airline misses it, or you reject its offer, you can ask Ledgerly to step in, and you can download a full complaint packet to send to the Nigerian Civil Aviation Authority\u2019s Consumer Protection Directorate, which handles passenger complaints under Part 19 of the Nigeria Civil Aviation Regulations. Ledgerly is independent and is not part of the NCAA.'],
  ['Is Ledgerly a law firm?', 'No. Ledgerly connects you with independent lawyers and does not give legal advice.'],
]

export default function Landing({ airlines }: { airlines: React.ReactNode }) {
  return (
    <div className="space-y-20">
      <noscript><style>{'.reveal{opacity:1!important;transform:none!important}'}</style></noscript>

      <section className="space-y-6">
        <HeroArt />
        <Reveal className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Something went wrong on your flight? <span className="text-sky-700 dark:text-sky-400">Tell the airline directly.</span></h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted">Ledgerly sends your complaint straight to the airline&apos;s team, alerts them at once if it is a safety issue, and lets you follow it to a resolution, with a lawyer if you need one.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/submit" className={btn}>Submit a complaint <ArrowRight className="h-4 w-4" /></Link><Link href="/track" className={btn2}>Track a complaint</Link></div>
          <p className="mt-3 text-xs text-muted">No account needed · Takes about two minutes</p>
        </Reveal>
      </section>

      <section>
        <H2 k="How it works" t="From problem to resolution in four steps" />
        <div className="space-y-6">{STEPS.map(([n, t, d, art], i) => (
          <Reveal key={n} delay={80}>
            <div className={`grid items-center gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-2 ${i % 2 ? 'sm:[&>div:first-child]:order-2' : ''}`}>
              <div><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">{n}</span><h3 className="mt-3 text-xl font-bold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>
              <div className="flex justify-center">{art}</div>
            </div>
          </Reveal>))}</div>
      </section>

      <section>
        <H2 k="Features" t="Built to get your complaint noticed" d="Everything you need to be heard, and everything an airline needs to respond properly." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={(i % 4) * 90}><div className="h-full rounded-xl border bg-card p-5 transition hover:-translate-y-1 hover:shadow-lg"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600/15 text-sky-700 dark:text-sky-400"><Icon className="h-5 w-5" /></span><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></Reveal>))}</div>
      </section>

      <section className="rounded-2xl border bg-card p-6 sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <Reveal><p className="text-xs font-semibold uppercase tracking-widest text-red-600">Safety first</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">When it is a safety issue, minutes matter</h2><p className="mt-3 text-sm text-muted">Reports about fainting, bleeding, smoke, missing air conditioning and similar emergencies are flagged critical. The airline&apos;s workspace shows a pulsing alert with a sound, and the clock starts.</p>
            <ul className="mt-4 space-y-2 text-sm">{['The airline must acknowledge the alert', 'If nobody does, it escalates to the duty manager', 'Then it is flagged for regulator notification'].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />{x}</li>)}</ul></Reveal>
          <Reveal delay={150} className="space-y-4"><AlertCard />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">{['Level 1|Complaints desk', 'Level 2|Duty manager', 'Level 3|Regulator desk'].map((x, i) => { const [a, b] = x.split('|'); return <div key={a} className="lit rounded-lg border p-3" style={{ animationDelay: `${i * 3}s` }}><b>{a}</b><br /><span className="text-muted">{b}</span></div> })}</div></Reveal>
        </div>
      </section>

      <section>
        <H2 k="Legal help" t="Take it further with a verified lawyer" d="If the airline has not put things right, hire a lawyer without leaving the site. Our team checks every lawyer's credentials." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{GRADES.map(([g, d], i) => <Reveal key={g} delay={i * 90}><div className="h-full rounded-xl border bg-card p-5"><Gavel className="h-6 w-6 text-sky-600" /><h3 className="mt-3 font-semibold">{g}</h3><p className="mt-1 text-sm text-muted">{d}</p></div></Reveal>)}</div>
        <Reveal className="mx-auto mt-6 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">{[[Lock, 'Payment held until the work is done'], [Scale, 'Demand letters, mediation, petitions, court'], [EyeOff, 'Your details shared only after acceptance']].map(([I, t]) => { const Icon = I as typeof Lock; return <div key={t as string} className="flex gap-2 rounded-lg border bg-card p-3"><Icon className="h-4 w-4 shrink-0 text-sky-600" />{t as string}</div> })}</Reveal>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Reveal><div className="h-full rounded-2xl border bg-card p-6"><Building2 className="h-7 w-7 text-sky-600" /><h3 className="mt-3 text-xl font-bold">For airlines</h3><p className="mt-2 text-sm text-muted">Get a workspace with live alerts, filters, replies to customers and a personal complaint link to put on your website and social pages. Hear about problems first.</p><Link href="/signup" className={btn + ' mt-4'}>Register your airline</Link></div></Reveal>
        <Reveal delay={120}><div className="h-full rounded-2xl border bg-card p-6"><Scale className="h-7 w-7 text-sky-600" /><h3 className="mt-3 text-xl font-bold">For lawyers</h3><p className="mt-2 text-sm text-muted">Apply with your credentials, set your own prices for each service within your grade, and get paid when a case is complete.</p><Link href="/apply-lawyer" className={btn + ' mt-4'}>Apply as a lawyer</Link></div></Reveal>
      </section>

      <section><H2 k="Airlines" t="Airlines on Ledgerly" d="Choose one to file a complaint directly." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{airlines}</div></section>

      <section className="mx-auto max-w-3xl">
        <H2 k="Questions" t="Good to know" />
        <div className="space-y-2">{FAQ.map(([q, a]) => <Reveal key={q}><details className="group rounded-xl border bg-card p-4"><summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="ml-3 text-sky-600 transition group-open:rotate-45">+</span></summary><p className="mt-2 text-sm text-muted">{a}</p></details></Reveal>)}</div>
      </section>

      <Reveal><section className="rounded-2xl bg-gradient-to-r from-sky-700 to-sky-900 p-8 text-center text-white sm:p-12"><Smartphone className="mx-auto h-8 w-8 opacity-80" /><h2 className="mt-3 text-2xl font-bold sm:text-3xl">Ready to be heard?</h2><p className="mx-auto mt-2 max-w-xl text-sm text-sky-100">It takes about two minutes, and you will get a reference number straight away.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/submit" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-sky-900 transition hover:bg-sky-100">Submit a complaint <ArrowRight className="h-4 w-4" /></Link><Link href="/track" className="inline-flex rounded-lg border border-white/50 px-5 py-3 text-sm font-semibold transition hover:bg-white/10">Track a complaint</Link></div></section></Reveal>
    </div>
  )
}
