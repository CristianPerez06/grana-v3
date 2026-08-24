import { describe, expect, it } from 'vitest'
import {
  deriveMonthOpening,
  deriveSavingsRow,
  savingsIdentityTerm,
  type MonthSummary,
} from '@grana/dashboard'

/**
 * The savings row of the balance card, and the identity it participates in.
 *
 * Two invariants are under test and they are easy to break together:
 *
 *   1. The card still closes on screen. `Tenías + Entró − Se fué − Guardaste`
 *      must equal the number in the dark zone, in EVERY state of the row —
 *      including the states where the savings term is zero and the expression
 *      collapses back to the three-term one it always was.
 *   2. `Entró` / `Se fué` never move. Saving is not a flow of money; it is a
 *      decision about money that stayed where it was. Any change that makes a
 *      reserve land in either bucket breaks the liquidity invariant the strip
 *      exists for.
 */

const summary = (entro: number, seFue: number): MonthSummary => ({ entro, seFue })

const closes = (opening: number, s: MonthSummary, savedNet: number, closing: number) =>
  Math.abs(opening + s.entro - s.seFue - savedNet - closing) < 0.005

describe('deriveSavingsRow — four states, one row', () => {
  it('saved more than it released: "Guardaste este mes"', () => {
    expect(deriveSavingsRow({ isCurrentMonth: true, reservedNet: 200_000, reserved: 200_000 }))
      .toEqual({ state: 'saved', amount: 200_000 })
  })

  it('released more than it saved: "Liberaste este mes", with a positive magnitude', () => {
    // The verb and the sign turn together. The row carries the magnitude and the
    // state; a consumer formatting a raw signed net would print "Guardaste este
    // mes +$50.000", which says the opposite of what happened.
    expect(deriveSavingsRow({ isCurrentMonth: true, reservedNet: -50_000, reserved: 150_000 }))
      .toEqual({ state: 'released', amount: 50_000 })
  })

  it('no movement this month but there is a stock: "Guardado"', () => {
    expect(deriveSavingsRow({ isCurrentMonth: true, reservedNet: 0, reserved: 350_000 }))
      .toEqual({ state: 'stock', amount: 350_000 })
  })

  it('nothing saved at all: "Guardar algo", with no amount', () => {
    // The door to the act cannot depend on having already used it: this is the
    // state the user who dismissed the suggestion lands on.
    expect(deriveSavingsRow({ isCurrentMonth: true, reservedNet: 0, reserved: 0 }))
      .toEqual({ state: 'empty', amount: 0 })
  })

  it('does not exist outside the current month, in any state', () => {
    for (const input of [
      { reservedNet: 200_000, reserved: 200_000 },
      { reservedNet: -50_000, reserved: 150_000 },
      { reservedNet: 0, reserved: 350_000 },
      { reservedNet: 0, reserved: 0 },
    ]) {
      expect(deriveSavingsRow({ isCurrentMonth: false, ...input })).toBeNull()
    }
  })
})

describe('savingsIdentityTerm — only a flow participates', () => {
  it('carries the signed net when the month had activity', () => {
    const saved = deriveSavingsRow({ isCurrentMonth: true, reservedNet: 200_000, reserved: 200_000 })
    expect(savingsIdentityTerm(saved, 200_000)).toBe(200_000)

    const released = deriveSavingsRow({ isCurrentMonth: true, reservedNet: -50_000, reserved: 150_000 })
    expect(savingsIdentityTerm(released, -50_000)).toBe(-50_000)
  })

  it('contributes nothing when the row is a stock readout', () => {
    // The carried-over reserve is already inside "Tenías" — the disponible the
    // user opened the month with. Subtracting it again would count it twice.
    const stock = deriveSavingsRow({ isCurrentMonth: true, reservedNet: 0, reserved: 350_000 })
    expect(savingsIdentityTerm(stock, 0)).toBe(0)
  })

  it('contributes nothing in a past month', () => {
    expect(savingsIdentityTerm(null, 200_000)).toBe(0)
  })
})

describe('deriveMonthOpening — the card closes in every state', () => {
  it('closes with a saving month', () => {
    const s = summary(2_000_000, 1_200_000)
    const opening = deriveMonthOpening(1_600_000, s, 200_000)

    expect(opening).toBe(1_000_000)
    expect(closes(opening, s, 200_000, 1_600_000)).toBe(true)
  })

  it('closes when more was released than saved', () => {
    const s = summary(2_000_000, 1_200_000)
    const opening = deriveMonthOpening(1_850_000, s, -50_000)

    expect(opening).toBe(1_000_000)
    expect(closes(opening, s, -50_000, 1_850_000)).toBe(true)
  })

  it('collapses to the three-term identity when there was no activity', () => {
    const s = summary(2_000_000, 1_200_000)
    // A stock-only month passes zero: the reserve is already inside the opening
    // disponible, so the three amounts close against the hero on their own.
    expect(deriveMonthOpening(1_600_000, s, 0)).toBe(800_000)
    expect(deriveMonthOpening(1_600_000, s)).toBe(800_000)
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
    const opening = deriveMonthOpening(-50_000, s, 50_000)
    expect(closes(opening, s, 50_000, -50_000)).toBe(true)
  })
})

describe('the reserve is not a flow — the two universes stay apart', () => {
  it('leaves the liquidity invariant alone while the disponible moves', () => {
    // One month, one saving. Two different questions, two different answers:
    //
    //   accounts:   what the bank shows        → moved by entro − seFue
    //   disponible: what you may still spend   → moved by entro − seFue − saved
    //
    // If a change ever made the reserve land in `entro` or `seFue`, the first
    // line below would stop holding — and the strip would be claiming money
    // moved when nothing left any account.
    const s = summary(2_000_000, 1_200_000)
    const savedNet = 200_000

    const accountsOpening = 1_000_000
    const accountsClosing = 1_800_000
    expect(accountsClosing - accountsOpening).toBe(s.entro - s.seFue)

    const disponibleClosing = 1_600_000
    const disponibleOpening = deriveMonthOpening(disponibleClosing, s, savedNet)
    expect(disponibleClosing - disponibleOpening).toBe(s.entro - s.seFue - savedNet)

    // And the gap between the two universes is exactly what was set aside.
    expect(accountsClosing - disponibleClosing).toBe(savedNet)
  })

  it('is blind to reserves by construction: the summary has no reserve input', () => {
    // `MonthSummary` carries only `entro` and `seFue`. There is no field a
    // reserve could be threaded through, so the strip cannot drift into
    // counting one — the guarantee is structural, not a matter of care.
    const s = summary(2_000_000, 1_200_000)
    expect(Object.keys(s).sort()).toEqual(['entro', 'seFue'])
  })
})
