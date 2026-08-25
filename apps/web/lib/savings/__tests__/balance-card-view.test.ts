import { describe, expect, it } from 'vitest'
import { deriveBalanceCardView, type MonthSummary } from '@grana/dashboard'

/**
 * The seam between "the maths is right" and "the screen shows the right number".
 *
 * The card's promise is one line long and everything here defends it:
 *
 *     Tenías + Entró − Se fué − Guardado === el disponible de arriba
 *
 * where `Tenías` is the ACCOUNT BALANCE the month opened with and `Guardado` is
 * the whole stock. Every row of the QA checklist for the card resolves here,
 * which is the point of one decision function instead of two copies: a bug in
 * this table is a bug on both platforms.
 */

const summary = (entro: number, seFue: number): MonthSummary => ({ entro, seFue })
const zero: MonthSummary = { entro: 0, seFue: 0 }
const both = (ars: number, usd = 0) => ({ ARS: ars, USD: usd })

/** Accounts of 1.800.000 at the cut, with `reserved` set aside. */
const currentMonth = (reserved: number) => ({
  isCurrent: true,
  accounts: both(1_800_000),
  summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
  available: { available: both(1_800_000 - reserved), reserved: both(reserved) },
})

const closes = (view: ReturnType<typeof deriveBalanceCardView>, s: MonthSummary, saved: number) =>
  Math.abs((view.venia?.ARS ?? 0) + s.entro - s.seFue - saved - view.displayed.ARS) < 0.005

describe('the current month shows the disponible', () => {
  it('renders accounts minus what is set aside, and closes against it', () => {
    const view = deriveBalanceCardView(currentMonth(490_000))

    expect(view.displayed.ARS).toBe(1_310_000)
    expect(view.savings.ARS).toEqual({ state: 'stock', amount: 490_000 })
    // "Tenías" is the ACCOUNT balance the month opened with — verifiable against
    // the user's own accounts — not a disponible that silently absorbed earlier
    // reserves.
    expect(view.venia?.ARS).toBe(1_000_000)
    expect(closes(view, currentMonth(490_000).summary.ARS, 490_000)).toBe(true)
  })

  it('subtracts the whole stock, carried-over months included', () => {
    // 300.000 set aside in July and 190.000 net in August: the row shows 490.000
    // and July's pesos appear ON SCREEN once, instead of being netted into
    // "Tenías" where nobody could find them.
    const view = deriveBalanceCardView(currentMonth(490_000))
    expect(view.savings.ARS?.amount).toBe(490_000)
    // And "Tenías" is the same number it would be with nothing set aside at all.
    expect(deriveBalanceCardView(currentMonth(0)).venia?.ARS).toBe(1_000_000)
  })

  it('nets each currency on its own', () => {
    const view = deriveBalanceCardView({
      isCurrent: true,
      accounts: both(1_800_000, 850),
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      available: { available: both(1_600_000, 850), reserved: both(200_000, 0) },
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
    })

    expect(view.displayed.ARS).toBe(-50_000)
    expect(view.savings.ARS).toEqual({ state: 'stock', amount: 200_000 })
  })
})

describe('a past month shows the closing balance and no savings row', () => {
  it('does not net the reserve, and "Tenías" means the same thing it does today', () => {
    const view = deriveBalanceCardView({
      isCurrent: false,
      accounts: both(1_800_000),
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      // A past month never fetches this — but even handed it, the row and the
      // netting must stay off, so a caller that forgets `enabled` cannot rewrite
      // a closed month.
      available: null,
    })

    expect(view.displayed.ARS).toBe(1_800_000)
    expect(view.savings.ARS).toBeNull()
    expect(view.savings.USD).toBeNull()
    // Same account-opening figure as the current month. Before, "Tenías" meant
    // one thing here and another there, depending on where you were standing.
    expect(view.venia?.ARS).toBe(1_000_000)
  })
})

describe('the two states of the row', () => {
  it('shows the total when there is one', () => {
    expect(deriveBalanceCardView(currentMonth(350_000)).savings.ARS).toEqual({
      state: 'stock',
      amount: 350_000,
    })
  })

  it('invites the act when there is nothing set aside', () => {
    // The door to saving cannot depend on having already saved: this is the
    // state the user who dismissed the suggestion lands on.
    expect(deriveBalanceCardView(currentMonth(0)).savings.ARS).toEqual({
      state: 'empty',
      amount: 0,
    })
  })
})

describe('partial data never invents a number', () => {
  it('holds "Tenías" back until both reads have arrived', () => {
    const loading = deriveBalanceCardView({
      isCurrent: true,
      accounts: null,
      summary: { ARS: summary(2_000_000, 1_200_000), USD: zero },
      available: null,
    })
    expect(loading.venia).toBeNull()
    expect(loading.displayed).toEqual({ ARS: 0, USD: 0 })
  })

  it('falls back to the accounts total while the disponible is in flight', () => {
    // A card that rendered zero for a beat would read as "you have no money".
    const view = deriveBalanceCardView({ ...currentMonth(490_000), available: null })
    expect(view.displayed.ARS).toBe(1_800_000)
  })
})
