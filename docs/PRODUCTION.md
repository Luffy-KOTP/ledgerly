# Making Ledgerly production-ready: step by step

Work through the phases in order. Do not skip phase 0: two of its answers change the code.

## Phase 0. Decisions (before more building)
1. **Lawyer fee model.** Get a written opinion from a Nigerian lawyer on how the platform may earn from legal escalations (fee on top, flat listing fee, subscription). Fee-sharing with non-lawyers is restricted in many places. Build the Paystack flow only after you have the answer.
2. **Holding customer money.** Ask Paystack and your lawyer whether holding a customer's payment for days before paying the lawyer needs any licence or a specific account structure.
3. **Company and accounts.** Register the company, open a business bank account, and decide who owns each service account below (use a shared company email, not a personal one).

## Phase 1. Supabase
1. Create **two projects**: `ledgerly-staging` and `ledgerly-prod`. Pick the closest region you can (check cross-border data-transfer duties under the Nigeria Data Protection Act).
2. In each project's SQL editor run `supabase/migrations/001_schema.sql`, then `002_realtime.sql`, then `003_grants.sql`, then `004_payment_status.sql`. Newer Supabase projects do not expose new tables to the Data API until they are granted, so skipping 003 makes the app fail with "permission denied". After running it, the "API DISABLED" badges on the Policies page should disappear.
3. **Check Row Level Security.** Table Editor should show RLS enabled on every table. Never disable it.
4. **Authentication settings:** turn on "Confirm email"; set Site URL to your domain and add `http://localhost:3000` and your staging URL to Redirect URLs; set the minimum password length to 10 and enable leaked-password protection if available on your plan; limit sign-up and sign-in rates.
5. **Custom SMTP** (Authentication > Emails): use Resend or similar so confirmation emails come from your domain.
6. **Storage:** confirm the private buckets `complaint-attachments` and `lawyer-credentials` exist and are not public.
7. **Scheduled jobs:** enable the `pg_cron` extension, then run:
   ```sql
   select cron.schedule('tick-alerts', '* * * * *', 'select tick_alerts()');
   select cron.schedule('expire-cases', '*/10 * * * *', 'select expire_cases()');
   ```
8. **First admin:** Authentication > Users > add a user, then run
   `insert into profiles (id, role, full_name) values ('<that user id>', 'admin', 'Your name');`
   Turn on multi-factor authentication for this account.
9. **Approve airlines:** until the admin screen exists, approve in SQL: `update airlines set status = 'active', verified = true where slug = '...';`
10. **Backups:** on the production project enable daily backups (point-in-time recovery if your plan allows) and do one restore test into staging.

## Phase 2. Run it locally against staging
1. `npm install`, copy `.env.example` to `.env.local`, fill in the staging Supabase URL, anon key and service-role key. Generate `OTP_SECRET` with `openssl rand -hex 32`.
2. `npm run dev`. Register an airline at `/signup`, confirm the email, approve it in SQL (step 1.9), log in at `/login`.
3. Submit a complaint at `/submit?airline=<slug>`. Use a safety wording (for example "passenger bleeding, no air conditioning") and check the red alert appears at `/company` within seconds, then Acknowledge it.
4. **Test access control as every role** (guest, airline A, airline B). Airline A must never see airline B's complaints. In the SQL editor you can also test with `set role authenticated; select set_config('request.jwt.claims', '{"sub":"<user id>"}', true); select count(*) from complaints;`.

## Phase 3. Email and SMS
1. **Email (Resend):** add your domain, publish the SPF, DKIM and DMARC DNS records, set `RESEND_API_KEY` and `MAIL_FROM`.
2. **SMS:** pick a Nigerian provider (for example Termii), register your sender ID (this can take days), and add a function beside `sendMail` in `lib/otp.ts` so codes can go by SMS too.
3. **Status emails:** when a complaint status or `airline_response` changes, email the customer. Do this with a Supabase database webhook that calls a route handler, so customers do not have to keep checking.
4. **WhatsApp alerts** to airline duty managers need the WhatsApp Business API and pre-approved message templates. Add an on-call contact list per airline so the escalation levels reach real people.

## Phase 4. Paystack (build in test mode first)
1. Create the Paystack business account and submit verification documents (this takes time; start early).
2. Copy the **test** keys into `.env.local` and Vercel's staging environment. Never put the secret key in browser code.
3. Build these server pieces (the database tables `legal_cases`, `payments`, `payouts` already exist):
   - **Start checkout:** a server action that re-reads the lawyer's price and the grade's fee from the database (never trust amounts from the browser), creates the case and a `payments` row, calls Paystack "initialize transaction" with a unique reference, and sends the customer to the returned payment page.
   - **Webhook** at `/api/paystack/webhook`: read the raw body, verify the `x-paystack-signature` header (HMAC-SHA512 of the raw body using your secret key), then **re-verify the transaction with Paystack's API**, and process each reference once.
     ```ts
     import { createHmac, timingSafeEqual } from 'node:crypto'
     export async function POST(req: Request) {
       const raw = await req.text()
       const sig = req.headers.get('x-paystack-signature') ?? ''
       const mac = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(raw).digest('hex')
       if (sig.length !== mac.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) return new Response('bad signature', { status: 401 })
       // parse JSON, ignore events you do not handle, look up payments by reference,
       // call Paystack "verify transaction", compare amount and status, then mark held. Always return 200 quickly.
       return new Response('ok')
     }
     ```
   - **Lawyer accepts / declines / completes:** server actions that change `legal_cases.status` (the database blocks direct edits).
   - **Payout:** on completion, create a transfer recipient from the lawyer's verified bank account and pay out `price_kobo`; store it in `payouts`.
   - **Refund** through Paystack on cancel, decline or the 48-hour expiry.
4. In the Paystack dashboard set the webhook URL to `https://<staging-domain>/api/paystack/webhook`. Use a tunnel (ngrok) to test locally.
5. Test with Paystack's test cards: success, failure, abandoned, a refund, a payout, and the same webhook delivered twice (it must not pay twice).
6. For go-live, swap in the **live** keys on production only, set the live webhook URL, and make one small real payment and refund yourself.

## Phase 5. Security hardening
1. **CAPTCHA** (Cloudflare Turnstile) on the code-request steps of `/submit`, `/track`, `/signup` and `/login`, since every code costs money.
2. **Uploads:** move to signed upload URLs so the browser uploads straight to Storage (files up to 10MB), and add virus scanning and real file-type checks.
3. **Headers:** add a Content-Security-Policy and the other standard security headers in `next.config.ts`.
4. **Secrets:** keep them only in Vercel/Supabase environment settings. Rotate any key that was ever pasted into chat or committed.
5. **Admin protection:** MFA on every admin, and write an audit-log entry (`audit_log`) for approvals, refunds and payouts.
6. Ask someone independent to test the app before launch.

## Phase 6. Legal and compliance
1. Get a Nigerian lawyer to write the six documents in `content/legal/` (Terms, Privacy, Refunds, Cookies, Lawyer Terms, Airline Terms) and replace every `[PLACEHOLDER]`. Update the version date in `lib/consent.ts`.
2. Check whether you must register with the Nigeria Data Protection Commission and appoint a Data Protection Officer; put their contact in the Privacy Policy.
3. Agree with the Nigerian Civil Aviation Authority how safety incidents should be reported to it.
4. Add the takedown and right-of-reply process for the public feed.

## Phase 7. Deploy
1. Push to GitHub. Import into **Vercel**. Set environment variables separately for Preview/Staging and Production.
2. Add your domain and confirm HTTPS. Set `NEXT_PUBLIC_SITE_URL` to it.
3. Add CI that runs `npm run lint`, `npx tsc --noEmit` and `npm run build` on every pull request.
4. Add error monitoring (Sentry), an uptime check on `/`, and an alert if the cron job `tick_alerts` stops running.

## Phase 8. Pilot, then launch
1. Launch with **one real airline** and a handful of lawyers. Watch alerts, response times and payouts daily for two weeks.
2. Launch checklist: RLS tested for every role, webhook tested twice-delivered, refund and payout tested live, policies published and consent recording, backups tested, MFA on, CAPTCHA on, monitoring on, an on-call person for critical alerts.
3. Write short runbooks: a critical alert nobody acknowledges, a failed payout or refund, a customer data request, a restore from backup.

## Still to build in the code
Lawyer registration and workspace (`/lawyer`), customer escalation checkout on `/track`, admin screens (airline and lawyer approval, price bands, ledger, incident queue), the Paystack routes above, AI summaries and draft replies, media-watch alerts.

---

## Setup for the features that are now built
These are in the code. Each needs the configuration below before it works.

1. **Run `supabase/migrations/004_payment_status.sql`** in the SQL editor (adds the `pending_payment` case status).
2. **Environment variables** (`.env.local` locally, Vercel settings in production): `PAYSTACK_SECRET_KEY` (test key first), `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `CRON_SECRET` (any long random string), `RESEND_API_KEY` and `MAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.
3. **Paystack dashboard:** set the webhook URL to `https://<your-domain>/api/paystack/webhook` (locally, use an ngrok address). Payouts: turn off the "require OTP to approve transfers" setting for API transfers, or the payout call will stall waiting for a code. Transfers are paid from your *settled* Paystack balance, so customer payments must have settled before a payout can succeed.
4. **Expiry job:** `vercel.json` calls `/api/cron/refund-expired` every 10 minutes (Vercel sends `CRON_SECRET`). Vercel's free plan limits how often cron jobs run; if yours is limited, call that URL with the header `Authorization: Bearer <CRON_SECRET>` from Supabase `pg_cron` + `pg_net`, or from any scheduler. It expires lawyer requests older than 48 hours and retries any refund that failed.
5. **Test the money path in test mode, in this order:**
   1. Admin: approve a lawyer and a grade; the lawyer sets prices, picks a bank and enters an account number (it is verified with Paystack), and ticks "Accepting new requests".
   2. Customer: open a complaint in `/track`, choose a service and grade, pick the lawyer, pay with a Paystack test card.
   3. After the webhook arrives, the case shows as awaiting the lawyer; the lawyer accepts, chats, and marks the case complete.
   4. Check the `payouts` row moves from `processing` to `paid`, and the admin ledger shows the platform fee.
   5. Repeat with a declined case and with a cancelled case to confirm the refund happens, and deliver the same webhook twice to confirm nothing is paid twice.
6. **Admin sign-in** goes to `/admin` after you create your admin profile (see step 1.8).

## Still not built
Admin two-step login (MFA), CAPTCHA, direct-to-storage uploads over 4MB with virus scanning, SMS codes, WhatsApp alerts, a news/social media-watch feed, a real AI model behind the draft-reply and summary buttons, and a strict Content-Security-Policy.
