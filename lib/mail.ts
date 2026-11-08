import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

// Email goes out over plain SMTP, so any provider works (Gmail with an app password, Brevo, SendGrid, Resend's SMTP, your own server).
// Switching provider later is only a change to the SMTP_* values in .env.local. No SMTP settings: development prints the email in the terminal.
let tx: Transporter | null = null
function transport() {
  if (tx) return tx
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  const port = Number(SMTP_PORT ?? 587)
  tx = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  return tx
}

/** Returns true if the email was handed to the mail server (or, in development with no SMTP settings, printed in the terminal). */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const dev = process.env.NODE_ENV !== 'production'
  if (dev) console.log(`[DEV mail to ${to}] ${subject}: ${text}`)
  const t = transport()
  if (!t) return dev // no mail server configured: fine in development (read the terminal), a failure in production
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text })
    return true
  } catch (e) { console.error('[mail] SMTP send failed:', e); return false }
}
