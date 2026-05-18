import type { AccountWithDetails } from './types'

// In v1 (no transactions module), balance = initial_balance per currency.
// When transactions module lands, this becomes: initial_balance + Σ transaction amounts.
export function computeBalance(
  account: AccountWithDetails,
): Record<'ARS' | 'USD', number> {
  const result: Record<'ARS' | 'USD', number> = { ARS: 0, USD: 0 }

  for (const c of account.currencies) {
    if (c.currency_code === 'ARS' || c.currency_code === 'USD') {
      result[c.currency_code] = c.initial_balance
    }
  }

  return result
}
