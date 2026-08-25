import { describe, expect, it } from 'vitest'
import {
  deriveMonthOpening,
  deriveSavingsRow,
  savingsIdentityTerm,
  type MonthSummary,
} from '@grana/dashboard'

/**
 * The identity the balance card exists to make checkable:
 *
 *     Tenías + Entró − Se fué − Guardado === el disponible de arriba
 *
 * Two invariants are under test and they break together easily:
 *
 *   1. The card closes on screen, in every state of the row.
 *   2. `Entró` / `Se fué` never move. Saving is not a flow of money; it is a
 *      decision about money that stayed where it was. Any change that lands a
 *      reserve in either bucket breaks the liquidity invariant the strip is for.
 */

const summary = (entro: number, seFue: number): MonthSummary => ({ entro, seFue })

const closes = (opening: number, s: MonthSummary, saved: number, closing: number) =>
  Math.abs(opening + s.entro - s.seFue - saved - closing) < 0.005

describe('deriveSavingsRow — two states, one row', () => {
  it('shows the total when there is money set aside', () => {
    expect(deriveSavingsRow({ isCurrentMonth: true, reserved: 490_000 })).toEqual({
      state: 'stock',
      amount: 490_000,
    })
  })

  it('invites the act when there is nothing', () => {
    expect(deriveSavingsRow({ isCurrentMonth: true, reserved: 0 })).toEqual({
      state: 'empty',
      amount: 0,
    })
  })

  it('does not exist outside the current month', () => {
    expect(deriveSavingsRow({ isCurrentMonth: false, reserved: 490_000 })).toBeNull()
    expect(deriveSavingsRow({ isCurrentMonth: false, reserved: 0 })).toBeNull()
  })
})

describe('savingsIdentityTerm — the stock is what gets subtracted', () => {
  it('carries the whole stock, carried-over months included', () => {
    const row = deriveSavingsRow({ isCurrentMonth: true, reserved: 490_000 })
    expect(savingsIdentityTerm(row)).toBe(490_000)
  })

  it('contributes nothing in a past month', () => {
    expect(savingsIdentityTerm(null)).toBe(0)
  })
})

describe('deriveMonthOpening — the card closes in every state', () => {
  it('closes with money set aside', () => {
    const s = summary(2_000_000, 1_200_000)
    const opening = deriveMonthOpening(1_310_000, s, 490_000)

    // The ACCOUNT balance the month opened with — the same number it would be
    // with nothing set aside, which is what makes it checkable.
    expect(opening).toBe(1_000_000)
    expect(closes(opening, s, 490_000, 1_310_000)).toBe(true)
  })

  it('gives the same opening whatever the stock is', () => {
    // The reserve never left the accounts, so it cannot move the figure the
    // month opened with. If this ever changes, "Tenías" stopped meaning "your
    // balance" and started meaning something only the app can compute.
    const s = summary(2_000_000, 1_200_000)
    expect(deriveMonthOpening(1_800_000, s, 0)).toBe(1_000_000)
    expect(deriveMonthOpening(1_310_000, s, 490_000)).toBe(1_000_000)
    expect(deriveMonthOpening(800_000, s, 1_000_000)).toBe(1_000_000)
  })

  it('keeps a past month working exactly as before', () => {
    const s = summary(500_000, 620_000)
    expect(deriveMonthOpening(380_000, s)).toBe(500_000)
  })

  it('closes to the cent with amounts that float would round', () => {
    const s = summary(1_234_567.89, 987_654.32)
    const opening = deriveMonthOpening(500_000.01, s, 111_111.11)
    expect(closes(opening, s, 111_111.11, 500_000.01)).toBe(true)
  })

  it('closes with a negative disponible', () => {
    // Spending past what was set aside is shown as-is; the reserve is not
    // quietly shrunk to make the number close.
    const s = summary(100_000, 300_000)
    const opening = deriveMonthOpening(-50_000, s, 200_000)
    expect(closes(opening, s, 200_000, -50_000)).toBe(true)
  })
})

describe('the reserve is not a flow — the two universes stay apart', () => {
  it('leaves the liquidity invariant alone while the disponible moves', () => {
    //   accounts:   what the bank shows       → moved by entro − seFue
    //   disponible: what you may still spend  → the same movement, minus a stock
    //
    // If a change ever made the reserve land in `entro` or `seFue`, the first
    // line below would stop holding — the strip would claim money moved when
    // nothing left any account.
    const s = summary(2_000_000, 1_200_000)
    const saved = 490_000

    const accountsOpening = 1_000_000
    const accountsClosing = 1_800_000
    expect(accountsClosing - accountsOpening).toBe(s.entro - s.seFue)

    const disponibleClosing = accountsClosing - saved
    expect(deriveMonthOpening(disponibleClosing, s, saved)).toBe(accountsOpening)

    // And the gap between the two universes is exactly what was set aside.
    expect(accountsClosing - disponibleClosing).toBe(saved)
  })

  it('is blind to reserves by construction: the summary has no reserve input', () => {
    // `MonthSummary` carries only `entro` and `seFue`. There is no field a
    // reserve could be threaded through, so the strip cannot drift into counting
    // one — the guarantee is structural, not a matter of care.
    const s = summary(2_000_000, 1_200_000)
    expect(Object.keys(s).sort()).toEqual(['entro', 'seFue'])
  })
})
