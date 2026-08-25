// Mirror of apps/web/lib/supabase/errors.ts but with hardcoded Spanish copy
// (mobile is Spanish-only for now — no i18n catalog yet).
// Keep in sync with packages/i18n-messages/src/es.json:auth.errors.*
const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Confirmá tu email antes de iniciar sesión.',
  user_already_exists: 'Ya existe una cuenta con ese email.',
  email_exists: 'Ya existe una cuenta con ese email.',
  weak_password: 'La contraseña es demasiado débil.',
  same_password: 'La contraseña nueva debe ser distinta a la actual.',
  otp_expired: 'El código expiró. Pedí uno nuevo.',
  otp_disabled: 'El código es inválido.',
  invalid_otp: 'El código es inválido.',
  over_email_send_rate_limit:
    'Demasiados intentos. Esperá unos minutos antes de volver a intentar.',
  over_request_rate_limit:
    'Demasiados intentos. Esperá unos minutos antes de volver a intentar.',
}

const GENERIC = 'Algo salió mal. Probá de nuevo en un momento.'

export function mapSupabaseError(
  error: { code?: string | null; message?: string } | null,
): string {
  const code = error?.code ?? undefined
  return (code && SUPABASE_ERROR_MESSAGES[code]) ?? GENERIC
}

// Locale-aware twin of `mapSupabaseError`, mirroring `supabaseErrorKey` in
// apps/web/lib/supabase/errors.ts: it returns the i18n key instead of a
// literal, so the caller can translate it with the active locale via `useT()`.
// New screens SHALL use this one — `mapSupabaseError` above still hardcodes
// Spanish and stays only for the `(auth)` screens that have not been
// retrofitted with the translator yet.
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

export function supabaseErrorKey(
  error: { code?: string | null } | null,
): string {
  const code = error?.code ?? undefined
  return (code && SUPABASE_ERROR_KEYS[code]) ?? GENERIC_KEY
}
