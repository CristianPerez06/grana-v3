export const locales = ['es', 'en'] as const
export const defaultLocale: Locale = 'es'
export const localeCookieName = 'NEXT_LOCALE'

export type Locale = (typeof locales)[number]

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value)
