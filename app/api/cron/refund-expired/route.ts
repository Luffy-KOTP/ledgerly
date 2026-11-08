import { supabaseAdmin } from '@/lib/supabase/admin'
import { refundHeld } from '@/lib/legal'

// Called every 10 minutes by Vercel Cron (see vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 })
  const db = supabaseAdmin()
  const { data: exp } = await db.from('legal_cases').update({ status: 'expired' }).eq('status', 'awaiting_lawyer').lt('accept_by', new Date().toISOString()).select('id')
  const { data: stuck } = await db.from('payments').select('case_id, legal_cases!inner(status)').eq('status', 'held').in('legal_cases.status', ['declined', 'expired', 'cancelled'])
  for (const s of stuck ?? []) await refundHeld(s.case_id)
  return Response.json({ expired: exp?.length ?? 0, refundsAttempted: stuck?.length ?? 0 })
}
