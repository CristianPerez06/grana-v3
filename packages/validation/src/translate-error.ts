// Custom Yup messages we set as bare i18n keys (because Yup's setLocale
// doesn't get a chance to localize messages provided inline to .matches/.oneOf).
// We translate them at render time inside the form.

const KNOWN_KEYS = new Set([
  'password_letter',
  'password_number',
  'password_match',
  'otp_format',
])

export const translateFieldError = (
  message: string | undefined,
  t: (key: string) => string,
): string | undefined => {
  if (!message) return undefined
  return KNOWN_KEYS.has(message) ? t(message) : message
}
