// Pure, presentational concentration math for the "Dónde está" card (web +
// mobile). Given the per-account ARS balances, it derives the dominant-account
// share and the proportional widths of the concentration bar. Widths/percentages
// are derived from the data — never hardcoded. Negative balances (overdrafts) do
// not contribute to the bar (a width can't be negative); they still show in the
// grid. RN-safe: no DOM/Node deps.

export type ConcentrationAccount = {
  id: string
  ars: number
}

export type ConcentrationSegment = {
  id: string
  /** Width of this account's segment, 0–100, proportional to its ARS share. */
  pct: number
}

export type Concentration = {
  /** Sum of positive ARS balances across the accounts. */
  totalArs: number
  /** Id of the account with the largest ARS balance, or null when total ≤ 0. */
  dominantId: string | null
  /** Dominant account share as an integer percentage, or null when total ≤ 0. */
  dominantPct: number | null
  /** One segment per account with a positive balance, in input order. */
  segments: ConcentrationSegment[]
}

/**
 * Compute the concentration of the available balance across accounts. Accounts
 * are expected pre-sorted by ARS balance descending (as `getDashboardHero`
 * returns them), so `dominantId` is the first positive account.
 */
export function computeConcentration(accounts: ConcentrationAccount[]): Concentration {
  const totalArs = accounts.reduce((sum, a) => sum + Math.max(a.ars, 0), 0)

  if (totalArs <= 0) {
    return { totalArs: 0, dominantId: null, dominantPct: null, segments: [] }
  }

  const segments: ConcentrationSegment[] = accounts
    .filter((a) => a.ars > 0)
    .map((a) => ({ id: a.id, pct: (a.ars / totalArs) * 100 }))

  // Dominant = the largest positive balance. Accounts arrive sorted desc, but we
  // pick the max defensively so the helper is correct for any input order.
  const dominant = accounts.reduce<ConcentrationAccount | null>(
    (best, a) => (a.ars > 0 && (best === null || a.ars > best.ars) ? a : best),
    null,
  )

  return {
    totalArs,
    dominantId: dominant?.id ?? null,
    dominantPct: dominant ? Math.round((dominant.ars / totalArs) * 100) : null,
    segments,
  }
}
