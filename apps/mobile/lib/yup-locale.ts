import { setYupLocale } from '@grana/validation'

// Mobile is Spanish-only for now (no i18n catalog yet). Mirror the keys
// from packages/i18n-messages/src/es.json:validation.* so behavior matches
// the web app. When mobile i18n lands, swap these literals for t() calls.
setYupLocale({
  mixed: {
    required: 'Este campo es obligatorio.',
    notType: 'Valor inválido.',
  },
  string: {
    email: 'Ingresá un email válido.',
    min: ({ min }) => `Debe tener al menos ${min} caracteres.`,
    max: ({ max }) => `No puede tener más de ${max} caracteres.`,
  },
})

const CUSTOM_MESSAGES: Record<string, string> = {
  password_letter: 'Debe incluir al menos una letra.',
  password_number: 'Debe incluir al menos un número.',
  password_match: 'Las contraseñas no coinciden.',
  otp_format: 'El código debe tener exactamente 8 dígitos.',
}

export const translateValidationMessage = (
  message: string | undefined,
): string | undefined => {
  if (!message) return undefined
  return CUSTOM_MESSAGES[message] ?? message
}
