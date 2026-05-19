import type { AuthError } from '@supabase/supabase-js'

const SUPABASE_ERROR_KEYS: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_not_confirmed: 'auth.errors.email_not_confirmed',
  user_already_exists: 'auth.errors.user_already_exists',
  email_exists: 'auth.errors.user_already_exists',
  weak_password: 'auth.errors.weak_password',
  same_password: 'auth.errors.same_password',
  otp_expired: 'auth.errors.otp_expired',
  otp_disabled: 'auth.errors.invalid_otp',
  invalid_otp: 'auth.errors.invalid_otp',
  over_email_send_rate_limit: 'auth.errors.over_email_send_rate_limit',
  over_request_rate_limit: 'auth.errors.over_email_send_rate_limit',
}

const GENERIC_KEY = 'auth.errors.generic'

export const supabaseErrorKey = (
  error: AuthError | { code?: string | null } | null,
): string => {
  const code = error?.code ?? undefined
  return (code && SUPABASE_ERROR_KEYS[code]) ?? GENERIC_KEY
}

export const mapSupabaseError = (
  error: AuthError | { code?: string | null; message?: string } | null,
  t: (key: string) => string,
): string => t(supabaseErrorKey(error))
