// Pure math for the "Dónde está" block of the balance card (web + mobile).
// Given the per-account balances of `getDashboardHero`, it derives — for EACH
// currency independently — the accounts that hold the most money and their
// share of that currency's total.
//
// Bimoneda: ARS and USD are never summed nor converted (there is no global FX
// rate in the system; the FX lives per transaction). Each currency gets its own
// total and its own percentages, so a share is always "of the money you hold in
// THIS currency". A currency with no money yields no rows at all rather than a
// list of zeros — the UI renders nothing for it.
//
// RN-safe: no DOM/Node deps.

import type { ResolvedAccountAvatar } from '@grana/ui-contracts'

/** How many accounts each currency column lists. The rest live in /accounts. */
export const PLACEMENT_ROWS_PER_CURRENCY = 2

export type PlacementAccount = {
  id: string
  name: string
  /** Bank/institution display name when the account has one; null for cash. */
  institutionName: string | null
  ars: number
  usd: number
  avatar: ResolvedAccountAvatar
}

export type PlacementRow = {
  id: string
  /** What the row shows: the institution when there is one, else the account name. */
  label: string
  /** Balance in the column's currency. Always positive (see `total`). */
  amount: number
  /**
   * Share of this account over the total of ITS OWN currency, rounded to an
   * integer for display. The listed rows are the top N of the column, so these
   * percentages intentionally DO NOT add up to 100 whenever the user holds that
   * currency in more accounts than the column lists.
   */
  pct: number
  avatar: ResolvedAccountAvatar
}

export type CurrencyPlacement = {
  /** Sum of the POSITIVE balances of this currency across every account. */
  total: number
  /** Top accounts by balance desc. Empty when the currency holds nothing. */
  rows: PlacementRow[]
}

export type BalancePlacement = {
  ARS: CurrencyPlacement
  USD: CurrencyPlacement
}

const labelOf = (account: PlacementAccount): string => account.institutionName ?? account.name

/**
 * Rank one currency's accounts and take the top N.
 *
 * Negative balances (an overdrawn account) are excluded from both the total and
 * the rows: a share of a negative number is not a proportion, and the block's
 * job is to answer "where is the money", not "who is in the red". Zero balances
 * are excluded for the same reason — a column lists what holds money.
 */
const placeCurrency = (
  accounts: PlacementAccount[],
  amountOf: (account: PlacementAccount) => number,
  rowCount: number,
): CurrencyPlacement => {
  const holding = accounts.filter((account) => amountOf(account) > 0)
  const total = holding.reduce((sum, account) => sum + amountOf(account), 0)

  if (total <= 0) return { total: 0, rows: [] }

  // Sort by amount desc, breaking ties by id so two accounts with the same
  // balance always land in the same order — web and native must agree, and the
  // caller's input order is not guaranteed to be stable across reads.
  const ranked = [...holding].sort((a, b) => {
    const diff = amountOf(b) - amountOf(a)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })

  return {
    total,
    rows: ranked.slice(0, rowCount).map((account) => ({
      id: account.id,
      label: labelOf(account),
      amount: amountOf(account),
      // Rounded here, not in the components, so both platforms show the same
      // number. An account under 0.5% of its currency rounds to 0% — only
      // reachable when the whole currency is dust, which the amount makes plain.
      pct: Math.round((amountOf(account) / total) * 100),
      avatar: account.avatar,
    })),
  }
}

/**
 * Derive the "Dónde está" block: the top accounts of each currency with their
 * share of that currency's total.
 *
 * `rowCount` is injectable so a surface that has more room can list more without
 * forking the math; it defaults to what the design specifies.
 */
export function derivePlacement(
  accounts: PlacementAccount[],
  rowCount: number = PLACEMENT_ROWS_PER_CURRENCY,
): BalancePlacement {
  return {
    ARS: placeCurrency(accounts, (account) => account.ars, rowCount),
    USD: placeCurrency(accounts, (account) => account.usd, rowCount),
  }
}
