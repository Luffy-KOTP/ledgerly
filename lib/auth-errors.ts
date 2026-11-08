/** Turns a Supabase sign-up error into a message people can act on. The real reason is always logged on the server, and shown on screen in development. */
export function signUpError(e: { code?: string; message: string; status?: number }): string {
  console.error('[signUp]', e.status, e.code, e.message)
  const dev = process.env.NODE_ENV !== 'production' ? ` (${e.code ?? e.status}: ${e.message})` : ''
  switch (e.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Too many sign-up emails have been sent recently. Please wait a while and try again.' + dev
    case 'weak_password': return 'That password is too weak. Use a longer, less common password.' + dev
    case 'email_address_invalid': return 'That email address is not accepted. Use a real email address.' + dev
    case 'signup_disabled': return 'Sign-ups are switched off for this project.' + dev
    default: return 'Could not create the account. Try a different email or password.' + dev
  }
}
