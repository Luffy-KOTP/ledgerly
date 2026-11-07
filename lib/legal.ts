import 'server-only'
import { supabaseAdmin } from './supabase/admin'
import { refund } from './paystack'
export const feeOf = (price: number, pct: number) => Math.round((price * pct) / 100)

/** Ends a case that has not completed. If the customer had paid, the money is refunded; a failed refund is logged and retried by the cron route. */
export async function closeAndRefund(caseId: string, status: 'declined' | 'expired' | 'cancelled') {
  const db = supabaseAdmin()
  const { data: k } = await db.from('legal_cases').update({ status }).eq('id', caseId).in('status', ['pending_payment', 'awaiting_lawyer', 'active']).select('id').maybeSingle()
  if (!k) return false
  await db.from('case_messages').insert({ case_id: caseId, sender: 'system', body: `This case was ${status}. Any payment is being refunded.` })
  await refundHeld(caseId)
  return true
}
export async function refundHeld(caseId: string) {
  const db = supabaseAdmin()
  const { data: p } = await db.from('payments').select('id,paystack_reference').eq('case_id', caseId).eq('status', 'held').maybeSingle()
  if (!p) return
  try {
    await refund(p.paystack_reference)
    await db.from('payments').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', p.id)
  } catch (e) { console.error('[refund failed]', caseId, e); await db.from('audit_log').insert({ action: 'refund_failed', entity: 'legal_case', entity_id: caseId, meta: { error: String(e) } }) }
}
