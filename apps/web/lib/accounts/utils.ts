import type { AccountWithDetails } from './types'

// balance = initial_balance + net transaction sums per currency.
// txSums is optional; when absent (legacy call sites), only initial_balance is used.
export function computeBalance(
  account: AccountWithDetails,
  txSums?: Record<'ARS' | 'USD', number>,
): Record<'ARS' | 'USD', number> {
  const result: Record<'ARS' | 'USD', number> = { ARS: 0, USD: 0 }

  for (const c of account.currencies) {
    if (c.currency_code === 'ARS' || c.currency_code === 'USD') {
      result[c.currency_code] = c.initial_balance + (txSums?.[c.currency_code] ?? 0)
    }
  }

  return result
}
