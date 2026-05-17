import type { AuthError } from '@supabase/supabase-js'

const SUPABASE_ERROR_KEYS: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_not_confirmed: 'auth.errors.email_not_confirmed',
  user_already_exists: 'auth.errors.user_already_exists',
  email_exists: 'auth.errors.user_already_exists',
  weak_password: 'auth.errors.weak_password',
  same_password: 'auth.errors.same_password',
  over_email_send_rate_limit: 'auth.errors.over_email_send_rate_limit',
  over_request_rate_limit: 'auth.errors.over_email_send_rate_limit',
}

export const mapSupabaseError = (
  error: AuthError | { code?: string | null; message?: string } | null,
  t: (key: string) => string,
): string => {
  const code = error?.code ?? undefined
  const key = (code && SUPABASE_ERROR_KEYS[code]) ?? 'auth.errors.generic'
  return t(key)
}
