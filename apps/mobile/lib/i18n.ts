import { en as enMessages, es as esMessages, type Messages } from '@grana/i18n-messages'
import { defaultLocale, type Locale } from './locale'

type Params = Record<string, string | number>

const catalogs: Record<Locale, Messages> = {
  es: esMessages,
  en: enMessages,
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? esMessages
}

function lookup(messages: Messages, path: string): string | null {
  const parts = path.split('.')
  let current: unknown = messages
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as object)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }
  return typeof current === 'string' ? current : null
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return Object.entries(params).reduce(
    (acc, [key, value]) =>
      acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  )
}

export function translate(locale: Locale, path: string, params?: Params): string {
  const messages = getMessages(locale)
  const value = lookup(messages, path)
  if (value !== null) return interpolate(value, params)
  // Fallback to default locale before giving up.
  if (locale !== defaultLocale) {
    const fallback = lookup(getMessages(defaultLocale), path)
    if (fallback !== null) return interpolate(fallback, params)
  }
  return path
}

/**
 * Global `t()` for use OUTSIDE React components (pure helpers, error
 * mappers, etc.) — always resolves against the default locale (`es`).
 * Components that should react to locale changes MUST use `useT()` from
 * `lib/locale-context.tsx` instead.
 */
export function t(path: string, params?: Params): string {
  return translate(defaultLocale, path, params)
}
