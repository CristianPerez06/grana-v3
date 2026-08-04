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
  // 23503 = foreign_key_violation. For a transaction this is almost always the
  // RESTRICT on `recurrences.created_from_transaction_id` (0053): the movement
  // seeded a recurrence rule. `deleteTransaction` pre-checks it and returns the
  // actionable `seeded_recurrence` guard, so reaching here means a caller that
  // bypassed the shared mutation — a net, not the expected path.
  if (code === '23503' && kind === 'transaction') {
    return t('seeded_recurrence')
  }
  return t('generic')
}
