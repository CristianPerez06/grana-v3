// The accounts domain types now live in `@grana/accounts` so mobile can reuse
// them. Re-exported here so existing `@/lib/accounts/types` importers keep
// working with a single source of truth.
export type {
  AccountType,
  Account,
  AccountCurrency,
  Institution,
  AccountWithDetails,
  AccountWithBalances,
  GroupedAccounts,
} from '@grana/accounts'
