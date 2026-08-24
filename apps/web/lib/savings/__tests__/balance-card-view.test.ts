import { describe, expect, it } from 'vitest'
import { deriveBalanceCardView, type MonthSummary } from '@grana/dashboard'

/**
 * The seam between "the maths is right" and "the screen shows the right number".
 *
 * Every row of the QA checklist for the balance card resolves here, which is the
 * point of having one decision function instead of two copies: a bug in this
 * table is a bug on both platforms, and a fix is a fix on both.
 */

const summary = (entro: number, seFue: number): MonthSummary => ({ entro, seFue })
const zero: MonthSummary = { entro: 0, seFue: 0 }
const both = (ars: number, usd = 0) => ({ ARS: ars, USD: usd })

const CURRENT = {
  isCurrent: true,
  accounts: both(1_800_000),
  summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
}

describe('the current month shows the disponible', () => {
  it('renders accounts minus what is set aside, not the accounts total', () => {
    const view = deriveBalanceCardView({
      ...CURRENT,
      available: { available: both(1_600_000), reserved: both(200_000) },
      reservedNet: both(200_000),
    })

    expect(view.displayed.ARS).toBe(1_600_000)
    expect(view.savings.ARS).toEqual({ state: 'saved', amount: 200_000 })
    // And the card closes: 1.000.000 + 2.000.000 − 1.200.000 − 200.000.
    expect(view.venia?.ARS).toBe(1_000_000)
  })

  it('nets each currency on its own', () => {
    const view = deriveBalanceCardView({
      isCurrent: true,
      accounts: both(1_800_000, 850),
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      available: { available: both(1_600_000, 850), reserved: both(200_000, 0) },
      reservedNet: both(200_000, 0),
    })

    expect(view.displayed).toEqual({ ARS: 1_600_000, USD: 850 })
    expect(view.savings.USD).toEqual({ state: 'empty', amount: 0 })
  })

  it('shows a negative disponible instead of shrinking the reserve', () => {
    const view = deriveBalanceCardView({
      isCurrent: true,
      accounts: both(150_000),
      summary: { ARS: summary(100_000, 300_000), USD: zero },
      available: { available: both(-50_000), reserved: both(200_000) },
      reservedNet: both(50_000),
    })

    expect(view.displayed.ARS).toBe(-50_000)
    expect(view.savings.ARS).toEqual({ state: 'saved', amount: 50_000 })
  })
})

describe('a past month shows the closing balance and no savings row', () => {
  it('does not net the reserve', () => {
    const view = deriveBalanceCardView({
      isCurrent: false,
      accounts: both(1_800_000),
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      // A past month never fetches these — but even handed them, the row and the
      // netting must stay off, so a future caller that forgets `enabled` cannot
      // rewrite a closed month.
      available: null,
      reservedNet: both(200_000),
    })

    expect(view.displayed.ARS).toBe(1_800_000)
    expect(view.savings.ARS).toBeNull()
    expect(view.savings.USD).toBeNull()
    // Back to the three-term identity it always was.
    expect(view.venia?.ARS).toBe(1_000_000)
  })
})

describe('the four states of the row', () => {
  const withFlowAndStock = (net: number, stock: number) =>
    deriveBalanceCardView({
      isCurrent: true,
      accounts: both(1_800_000),
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      available: { available: both(1_800_000 - stock), reserved: both(stock) },
      reservedNet: both(net),
    })

  it('saved / released / stock / empty', () => {
    expect(withFlowAndStock(200_000, 200_000).savings.ARS).toEqual({
      state: 'saved',
      amount: 200_000,
    })
    expect(withFlowAndStock(-50_000, 150_000).savings.ARS).toEqual({
      state: 'released',
      amount: 50_000,
    })
    expect(withFlowAndStock(0, 350_000).savings.ARS).toEqual({
      state: 'stock',
      amount: 350_000,
    })
    expect(withFlowAndStock(0, 0).savings.ARS).toEqual({ state: 'empty', amount: 0 })
  })

  it('does not subtract a carried-over stock twice', () => {
    // The month had no activity: the $350.000 are already inside the disponible
    // the month OPENED with, so the three amounts close on their own. Passing
    // the stock into the identity would report an opening the user never had.
    const view = withFlowAndStock(0, 350_000)

    expect(view.displayed.ARS).toBe(1_450_000)
    expect(view.venia?.ARS).toBe(650_000)
    expect(650_000 + 2_000_000 - 1_200_000).toBe(1_450_000)
  })
})

describe('partial data never invents a number', () => {
  it('holds "Tenías" back until both reads have arrived', () => {
    const loading = deriveBalanceCardView({
      isCurrent: true,
      accounts: null,
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      available: null,
      reservedNet: both(0),
    })
    expect(loading.venia).toBeNull()
    expect(loading.displayed).toEqual({ ARS: 0, USD: 0 })
  })

  it('falls back to the accounts total while the disponible is in flight', () => {
    // A card that rendered zero for a beat would read as "you have no money".
    const view = deriveBalanceCardView({
      ...CURRENT,
      available: null,
      reservedNet: both(0),
    })
    expect(view.displayed.ARS).toBe(1_800_000)
  })
})
