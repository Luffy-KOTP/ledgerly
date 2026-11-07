export const SERVICES = ['Demand letter', 'Negotiation / mediation', 'Regulator petition', 'Court representation'] as const
export const GRADES = ['junior', 'mid_level', 'senior', 'corporate_firm'] as const
export const GRADE_LABEL: Record<string, string> = { junior: 'Junior', mid_level: 'Mid-level', senior: 'Senior', corporate_firm: 'Corporate firm' }
export const GRADE_INFO: Record<string, string> = { junior: 'Recently called to the bar, up to 3 years of experience.', mid_level: '4 to 9 years of practice.', senior: '10+ years, or head of chambers.', corporate_firm: 'Lawyers at established corporate firms.' }
export const naira = (kobo: number) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG')
