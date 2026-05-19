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
