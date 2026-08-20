import { describe, expect, it } from 'vitest'
import {
  derivePlacement,
  PLACEMENT_ROWS_PER_CURRENCY,
  type PlacementAccount,
} from '../src/placement'

const avatar = (monogram: string) => ({
  colorKey: null,
  colorOverride: null,
  iconKey: null,
  monogram,
})

const account = (
  id: string,
  name: string,
  balances: { ars?: number; usd?: number; institutionName?: string | null },
): PlacementAccount => ({
  id,
  name,
  institutionName: balances.institutionName ?? null,
  ars: balances.ars ?? 0,
  usd: balances.usd ?? 0,
  avatar: avatar(name[0]!.toUpperCase()),
})

describe('derivePlacement', () => {
  it('lists the top accounts of each currency with their share of that currency', () => {
    const accounts = [
      account('mp', 'Mercado Pago', { ars: 6_741_212.89, usd: 48, institutionName: 'Mercado Pago' }),
      account('lemon', 'Lemon', { ars: 1_291_521.34, usd: 552, institutionName: 'Lemon' }),
      account('santander', 'Santander', { ars: 127_090.23, institutionName: 'Santander' }),
    ]

    const placement = derivePlacement(accounts)

    expect(placement.ARS.rows.map((r) => [r.label, r.pct])).toEqual([
      ['Mercado Pago', 83],
      ['Lemon', 16],
    ])
    // USD ranks independently: Lemon holds most of the dollars even though
    // Mercado Pago holds most of the pesos.
    expect(placement.USD.rows.map((r) => [r.label, r.pct])).toEqual([
      ['Lemon', 92],
      ['Mercado Pago', 8],
    ])
  })

  it('computes each share over the full currency total, not over the listed rows', () => {
    // Four accounts, only two listed: the percentages must still be shares of
    // the whole, so they add up to less than 100.
    const accounts = [
      account('a', 'A', { ars: 500 }),
      account('b', 'B', { ars: 300 }),
      account('c', 'C', { ars: 150 }),
      account('d', 'D', { ars: 50 }),
    ]

    const placement = derivePlacement(accounts)

    expect(placement.ARS.total).toBe(1_000)
    expect(placement.ARS.rows).toHaveLength(PLACEMENT_ROWS_PER_CURRENCY)
    expect(placement.ARS.rows.map((r) => r.pct)).toEqual([50, 30])
  })

  it('never sums or converts across currencies', () => {
    const accounts = [account('only-usd', 'Lemon', { usd: 600, institutionName: 'Lemon' })]

    const placement = derivePlacement(accounts)

    // The dollars do not leak into the ARS column in any form.
    expect(placement.ARS).toEqual({ total: 0, rows: [] })
    expect(placement.USD.total).toBe(600)
    expect(placement.USD.rows[0]!.pct).toBe(100)
  })

  it('returns no rows for a currency the user does not hold', () => {
    const placement = derivePlacement([account('mp', 'Mercado Pago', { ars: 10_000 })])

    expect(placement.USD).toEqual({ total: 0, rows: [] })
  })

  it('returns empty placements for a user with no accounts', () => {
    expect(derivePlacement([])).toEqual({
      ARS: { total: 0, rows: [] },
      USD: { total: 0, rows: [] },
    })
  })

  it('does not divide by zero when a currency totals zero', () => {
    const accounts = [account('a', 'A', { ars: 0 }), account('b', 'B', { ars: 0 })]

    const placement = derivePlacement(accounts)

    expect(placement.ARS.rows).toEqual([])
    // Guards against NaN/Infinity leaking into the UI as "NaN%".
    expect(Number.isFinite(placement.ARS.total)).toBe(true)
    expect(placement.ARS.total).toBe(0)
  })

  it('excludes overdrawn accounts from the total and the rows', () => {
    const accounts = [
      account('good', 'Good', { ars: 1_000 }),
      account('overdrawn', 'Overdrawn', { ars: -400 }),
    ]

    const placement = derivePlacement(accounts)

    // The negative balance neither shrinks the total nor claims a share.
    expect(placement.ARS.total).toBe(1_000)
    expect(placement.ARS.rows.map((r) => r.id)).toEqual(['good'])
    expect(placement.ARS.rows[0]!.pct).toBe(100)
  })

  it('breaks ties by id so both platforms rank the same way', () => {
    const forward = [
      account('zeta', 'Zeta', { ars: 500 }),
      account('alpha', 'Alpha', { ars: 500 }),
    ]
    const reversed = [...forward].reverse()

    // Same balances, opposite input order → same output order.
    expect(derivePlacement(forward).ARS.rows.map((r) => r.id)).toEqual(['alpha', 'zeta'])
    expect(derivePlacement(reversed).ARS.rows.map((r) => r.id)).toEqual(['alpha', 'zeta'])
  })

  it('falls back to the account name when there is no institution', () => {
    const accounts = [account('cash', 'Billetera', { ars: 900, institutionName: null })]

    expect(derivePlacement(accounts).ARS.rows[0]!.label).toBe('Billetera')
  })

  it('lists a single account when the currency has only one holder', () => {
    const placement = derivePlacement([account('solo', 'Solo', { ars: 42 })])

    expect(placement.ARS.rows).toHaveLength(1)
    expect(placement.ARS.rows[0]!.pct).toBe(100)
  })

  it('honours a custom row count without forking the math', () => {
    const accounts = [
      account('a', 'A', { ars: 400 }),
      account('b', 'B', { ars: 300 }),
      account('c', 'C', { ars: 300 }),
    ]

    expect(derivePlacement(accounts, 3).ARS.rows.map((r) => r.pct)).toEqual([40, 30, 30])
  })
})
