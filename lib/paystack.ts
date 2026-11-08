import 'server-only'
// Thin wrapper over the Paystack REST API. Amounts are always in kobo. Server only: it uses the secret key.
async function ps<T>(path: string, init?: RequestInit): Promise<T> {
  if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is missing from .env.local')
  const r = await fetch(`https://api.paystack.co${path}`, { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.status) throw new Error(j.message ?? `Paystack error ${r.status}`)
  return j.data as T
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
export const initTransaction = (email: string, amount: number, reference: string, callback_url: string) => ps<{ authorization_url: string }>('/transaction/initialize', post({ email, amount, reference, callback_url, currency: 'NGN' }))
export const verifyTransaction = (ref: string) => ps<{ status: string; amount: number; currency: string }>(`/transaction/verify/${encodeURIComponent(ref)}`)
export const refund = (transaction: string) => ps<unknown>('/refund', post({ transaction }))
export const listBanks = () => ps<{ name: string; code: string }[]>('/bank?country=nigeria&perPage=100')
export const resolveAccount = (account: string, bank: string) => ps<{ account_name: string }>(`/bank/resolve?account_number=${encodeURIComponent(account)}&bank_code=${encodeURIComponent(bank)}`)
export const createRecipient = (name: string, account_number: string, bank_code: string) => ps<{ recipient_code: string }>('/transferrecipient', post({ type: 'nuban', name, account_number, bank_code, currency: 'NGN' }))
export const transfer = (amount: number, recipient: string, reference: string, reason: string) => ps<{ transfer_code: string; status: string }>('/transfer', post({ source: 'balance', amount, recipient, reference, reason }))
