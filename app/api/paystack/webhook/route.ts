import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifyTransaction, refund } from '@/lib/paystack'
import { sendMail } from '@/lib/mail'

export async function POST(req: Request) {
  const raw = await req.text(), key = process.env.PAYSTACK_SECRET_KEY
  const sig = req.headers.get('x-paystack-signature') ?? '', mac = createHmac('sha512', key ?? '').update(raw).digest('hex')
  if (!key || sig.length !== mac.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) return new Response('bad signature', { status: 401 })
  const ev = JSON.parse(raw) as { event: string; data: { reference?: string; transfer_code?: string } }
  const db = supabaseAdmin(), now = new Date().toISOString()
  try {
    if (ev.event === 'charge.success' && ev.data.reference) {
      const { data: p } = await db.from('payments').select('id,case_id,amount_kobo').eq('paystack_reference', ev.data.reference).eq('status', 'initiated').maybeSingle()
      if (p) { // only payments we started and have not processed; a repeated delivery finds nothing here
        const v = await verifyTransaction(ev.data.reference) // never trust the webhook body alone
        if (v.status !== 'success' || v.amount !== p.amount_kobo || v.currency !== 'NGN') { await db.from('audit_log').insert({ action: 'payment_mismatch', entity: 'payment', entity_id: p.id, meta: { v } }); return new Response('ok') }
        const { data: claimed } = await db.from('payments').update({ status: 'held', paid_at: now, raw: ev }).eq('id', p.id).eq('status', 'initiated').select('id').maybeSingle()
        if (claimed) {
          const { data: k } = await db.from('legal_cases').update({ status: 'awaiting_lawyer', accept_by: new Date(Date.now() + 48 * 36e5).toISOString() }).eq('id', p.case_id).eq('status', 'pending_payment').select('id,lawyer_id,service').maybeSingle()
          if (!k) { await refund(ev.data.reference); await db.from('payments').update({ status: 'refunded', refunded_at: now }).eq('id', p.id) } // paid after the customer cancelled
          else {
            await db.from('case_messages').insert({ case_id: k.id, sender: 'system', body: 'Payment received and held securely until the work is complete.' })
            const { data: l } = await db.from('lawyers').select('user_id').eq('id', k.lawyer_id).single()
            const { data: u } = l ? await db.auth.admin.getUserById(l.user_id) : { data: null }
            if (u?.user?.email) await sendMail(u.user.email, 'New legal request on Ledgerly', `You have a new "${k.service}" request. Please accept or decline within 48 hours: ${process.env.NEXT_PUBLIC_SITE_URL}/lawyer`)
          }
        }
      }
    } else if ((ev.event === 'transfer.success' || ev.event === 'transfer.failed' || ev.event === 'transfer.reversed') && ev.data.transfer_code) {
      const ok = ev.event === 'transfer.success'
      const { data: po } = await db.from('payouts').update({ status: ok ? 'paid' : 'failed' }).eq('paystack_transfer_code', ev.data.transfer_code).select('case_id').maybeSingle()
      if (po && ok) await db.from('payments').update({ status: 'released' }).eq('case_id', po.case_id)
    }
  } catch (e) { console.error('[paystack webhook]', e); return new Response('error', { status: 500 }) } // non-200 makes Paystack retry
  return new Response('ok')
}
