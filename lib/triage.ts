// Ported from the prototype: safety keyword triage. Keep a human in the loop; this will over- and under-flag.
export const CRIT = /bleed|blood|faint|collaps|unconscious|medical|emergency|smoke|fire\b|injur|oxygen|suffocat|chok|air condition|engine|evacuat|hijack|assault|crash|turbulence|unsafe/i
export const isCritical = (category: string, subject: string, description: string) =>
  category === 'Safety / Medical Incident' || CRIT.test(`${subject} ${description}`)
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
