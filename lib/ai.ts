// Rule-based helpers (no model call yet). Swap the bodies for an LLM call later; the signatures can stay.
export function summarize(text: string) {
  const s = text.split(/(?<=[.!?])\s+/).filter(Boolean), cut = (x: string) => (x.length > 130 ? x.slice(0, 127) + '…' : x)
  const rest = s.slice(1).sort((a, b) => b.length - a.length)[0]
  return [s[0], rest].filter(Boolean).map((x) => '• ' + cut(x!)).join('\n')
}
export function draftReply(c: { customer_name: string; ref: string; subject: string; category: string; is_critical: boolean }, airline: string) {
  const f = c.customer_name.split(' ')[0]
  const open = c.is_critical ? `We sincerely apologise, ${f}, and we are treating this as a priority.` : `Thank you for contacting us, ${f}, and we are sorry for the trouble.`
  return `Hello ${f},\n\n${open} We have reviewed your complaint ${c.ref} about "${c.subject}" (${c.category}). A member of our team will contact you within 24 hours with a clear plan.\n\nKind regards,\n${airline} Customer Care`
}
