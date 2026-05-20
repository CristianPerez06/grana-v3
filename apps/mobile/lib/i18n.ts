import { es as esMessages } from '@grana/i18n-messages'

type Params = Record<string, string | number>

export function t(path: string, params?: Params): string {
  const parts = path.split('.')
  let current: unknown = esMessages
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as object)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path
    }
  }
  if (typeof current !== 'string') return path
  if (!params) return current
  return Object.entries(params).reduce(
    (acc, [key, value]) =>
      acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    current,
  )
}
