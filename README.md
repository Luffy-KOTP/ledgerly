# Ledgerly (Next.js 16 + Supabase + Paystack)

Complaints platform for airlines: guest complaint submission with one-time codes, tracking, airline workspace, lawyer escalation.
This project uses Next.js 16 with Cache Components. Read `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/` before changing routing or caching code.

## Run it
1. `npm install`
2. Create a Supabase project, open the SQL editor and run `001_schema.sql` then `002_realtime.sql`, then `003_grants.sql` from `supabase/migrations/`.
3. Copy `.env.example` to `.env.local` and fill it in (`OTP_SECRET`: `openssl rand -hex 32`). Without `SMTP_*` settings, one-time codes and emails print in the terminal during development.
3. Copy `.env.example` to `.env.local` and fill it in (`OTP_SECRET`: `openssl rand -hex 32`). Without `RESEND_API_KEY`, one-time codes print in the terminal during development.
4. In Supabase, add an airline row (`airlines`, status `active`) so the directory is not empty.
5. `npm run dev`, then open http://localhost:3000

## What is implemented
- Lawyer features: `/apply-lawyer`, `/lawyer` workspace, escalation and Paystack checkout on `/track`, webhook `/api/paystack/webhook`, refund cron `/api/cron/refund-expired`
- Admin: `/admin` (airline and lawyer approval, credentials viewer, price bands, incident queue, ledger)
- Customer status emails, draft-reply and summary buttons, security headers
- `/login`, `/signup` (airline), `/company` workspace: live critical alerts (Supabase Realtime), acknowledge, filters, status, message to customer, WhatsApp link, private attachments, complaint link
- `/` airline directory (cached), `/submit` (details, code, complaint, attachments, consent), `/track` (reference + code), `/legal/[slug]` legal pages from `content/legal/*.md`
- `proxy.ts` role guard for `/admin`, `/company`, `/lawyer` (Row Level Security is the real protection)
- `supabase/migrations/001_schema.sql`: all tables, security rules, views, scheduled-job functions

## Still to build
admin MFA, CAPTCHA, signed uploads for files over 4MB, SMS and WhatsApp, media watch, a real AI model. See `docs/PRODUCTION.md`.

**Production steps: see `docs/PRODUCTION.md`.**

## Before launch
Have the legal pages in `content/legal/` written and reviewed by a Nigerian lawyer, settle the lawyer fee model, and complete the security checklist from the plan.
