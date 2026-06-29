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

// CLDR cardinal category for the value. `Intl.PluralRules` is NOT available in
// the Hermes runtime, so we encode the rule directly: both supported locales
// (es, en) use `one` iff n === 1, else `other`. Exact `=N` selectors (resolved
// before this) cover the `=0`/`=2`/… cases the catalog uses. Revisit if a locale
// with richer plural rules (pl, ru, ar) is ever added.
function pluralCategory(n: number): 'one' | 'other' {
  return n === 1 ? 'one' : 'other'
}

// Index of the `}` that closes the `{` at `open`. Returns -1 if unbalanced.
function matchBrace(str: string, open: number): number {
  let depth = 0
  for (let i = open; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Parse a plural branch body (`=0 {…} one {…} other {…}`) into a selector→text map.
function parseBranches(inner: string): Record<string, string> {
  const branches: Record<string, string> = {}
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i++
    let sel = ''
    while (i < inner.length && inner[i] !== '{' && !/\s/.test(inner[i])) sel += inner[i++]
    while (i < inner.length && /\s/.test(inner[i])) i++
    if (inner[i] !== '{') break
    const end = matchBrace(inner, i)
    if (end === -1) break
    branches[sel] = inner.slice(i + 1, end)
    i = end + 1
  }
  return branches
}

// Resolve ICU `{name, plural, …}` blocks (the only ICU construct the catalog
// uses). Web gets this for free via next-intl; mobile evaluates it here. Exact
// `=N` matches win, else the CLDR category (`one`/`other`) from `pluralCategory`,
// else `other`. `#` inside the chosen branch becomes the count.
function resolvePlurals(template: string, params: Params): string {
  const re = /\{\s*([A-Za-z0-9_]+)\s*,\s*plural\s*,/g
  let result = template
  let match: RegExpExecArray | null
  while ((match = re.exec(result)) !== null) {
    const start = match.index
    const end = matchBrace(result, start)
    if (end === -1) break
    const inner = result.slice(match.index + match[0].length, end)
    const value = Number(params[match[1]])
    const branches = parseBranches(inner)
    let chosen = branches[`=${value}`]
    if (chosen == null) {
      chosen = branches[pluralCategory(value)] ?? branches.other ?? ''
    }
    chosen = chosen.replace(/#/g, String(value))
    result = result.slice(0, start) + chosen + result.slice(end + 1)
    re.lastIndex = start + chosen.length
  }
  return result
}

function interpolate(template: string, params: Params | undefined): string {
  if (!params) return template
  const withPlurals = resolvePlurals(template, params)
  return Object.entries(params).reduce(
    (acc, [key, value]) =>
      acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    withPlurals,
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
