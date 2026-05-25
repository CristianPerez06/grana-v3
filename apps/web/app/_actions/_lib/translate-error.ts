import { getTranslations } from 'next-intl/server'

// Domain discriminator that selects which `*.errors` namespace to use when
// translating a Postgres error code into a user-facing message. Each kind's
// namespace MUST define at minimum `generic` and `duplicate` (and the special
// `duplicate_subcategory` for the `subcategory` kind).
export type ErrorKind =
  | 'account'
  | 'card'
  | 'transaction'
  | 'recurrence'
  | 'category'
  | 'subcategory'

const KIND_NAMESPACE: Record<ErrorKind, string> = {
  account: 'accounts.errors',
  card: 'cards.errors',
  transaction: 'transactions.errors',
  recurrence: 'recurrences.errors',
  category: 'settings.categories.errors',
  subcategory: 'settings.categories.errors',
}

// Maps a Postgres error code (from a Supabase response) to a user-facing
// i18n message in the active locale. Falls back to the kind's `generic`
// message for unmapped codes. Use this from server actions instead of
// returning `error.message` raw.
export async function translatePostgresError(
  code: string | undefined,
  kind: ErrorKind,
): Promise<string> {
  const t = await getTranslations(KIND_NAMESPACE[kind])
  if (code === '23505') {
    return kind === 'subcategory' ? t('duplicate_subcategory') : t('duplicate')
  }
  return t('generic')
}
