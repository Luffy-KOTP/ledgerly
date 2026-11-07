import 'server-only'
/** Returns true if the email was handed to the provider. In development the message is always printed in the terminal too. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const dev = process.env.NODE_ENV !== 'production'
  if (dev) console.log(`[DEV mail to ${to}] ${subject}: ${text}`)
  if (!process.env.RESEND_API_KEY) return dev
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }) })
    if (!r.ok) { console.error('[mail] Resend rejected the email:', r.status, await r.text()); return false }
    return true
  } catch (e) { console.error('[mail] could not reach Resend:', e); return false }
}
