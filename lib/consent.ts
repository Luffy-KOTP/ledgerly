import 'server-only'
import { supabaseAdmin } from './supabase/admin'
// Bump a version whenever the document changes in a way users must re-accept.
export const LEGAL_VERSIONS = { terms: '2026-11-06', privacy: '2026-11-06', refunds: '2026-11-06', 'lawyer-terms': '2026-11-06', 'airline-terms': '2026-11-06' } as const
export async function recordConsent(email: string, docs: (keyof typeof LEGAL_VERSIONS)[], ip?: string) {
  await supabaseAdmin().from('consents').insert(docs.map((d) => ({ subject_email: email, document: d, version: LEGAL_VERSIONS[d], ip })))
}
