import { describe, expect, it } from 'vitest'
import {
  aggregateHero,
  buildMonthBalanceSeries,
  type HeroAccountRow,
  type MonthBalanceTxInput,
} from '../src/aggregations'

describe('aggregateHero', () => {
  // Avatar resolution is covered in apps/web account-avatar tests; here we just
  // tolerate the resolved `avatar` object on each breakdown entry.
  const anyAvatar = expect.any(Object)
  const row = (
    id: string,
    name: string,
    currencies: HeroAccountRow['currencies'],
  ): HeroAccountRow => ({
    id,
    name,
    type: 'cash',
    color_key: null,
    icon_key: null,
    institution: null,
    currencies,
  })

  it('sums initial balances and tx sums across ARS+USD accounts', () => {
    const accounts: HeroAccountRow[] = [
      row('cash-1', 'Billetera', [
        { currency_code: 'ARS', initial_balance: 100_000 },
        { currency_code: 'USD', initial_balance: 200 },
      ]),
      row('bank-1', 'Banco Galicia', [
        { currency_code: 'ARS', initial_balance: 50_000 },
        { currency_code: 'USD', initial_balance: 300 },
      ]),
    ]
    const txSums = new Map<string, { ARS: number; USD: number }>([
      ['cash-1', { ARS: 30_000, USD: 50 }],
      ['bank-1', { ARS: -20_000, USD: 0 }],
    ])

    expect(aggregateHero(accounts, txSums)).toEqual({
      ars: 160_000,
      usd: 550,
      accounts: [
        { id: 'cash-1', name: 'Billetera', ars: 130_000, usd: 250, avatar: anyAvatar },
        { id: 'bank-1', name: 'Banco Galicia', ars: 30_000, usd: 300, avatar: anyAvatar },
      ],
    })
  })

  it('orders the breakdown by ARS balance desc', () => {
    const accounts: HeroAccountRow[] = [
      row('small', 'Caja chica', [{ currency_code: 'ARS', initial_balance: 10_000 }]),
      row('big', 'Sueldo', [{ currency_code: 'ARS', initial_balance: 900_000 }]),
    ]
    const txSums = new Map<string, { ARS: number; USD: number }>()

    const result = aggregateHero(accounts, txSums)
    expect(result.accounts.map((a) => a.id)).toEqual(['big', 'small'])
  })

  it('respects off-ledger credit invariant by ignoring credit accounts upstream', () => {
    // aggregateHero only sees the rows passed in; the SQL filter already
    // excludes type='credit'. We simulate that by passing only cash/bank.
    const accounts: HeroAccountRow[] = [
      row('cash-1', 'Billetera', [{ currency_code: 'ARS', initial_balance: 100_000 }]),
    ]
    // getTransactionSums already filters status IS NULL, so credit card
    // expenses never appear here. We pass txSums that include no credit data.
    const txSums = new Map([['cash-1', { ARS: 0, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({
      ars: 100_000,
      usd: 0,
      accounts: [{ id: 'cash-1', name: 'Billetera', ars: 100_000, usd: 0, avatar: anyAvatar }],
    })
  })

  it('handles accounts with currencies the user holds no transactions in', () => {
    const accounts: HeroAccountRow[] = [
      row('cash-1', 'Billetera', [
        { currency_code: 'ARS', initial_balance: 0 },
        { currency_code: 'USD', initial_balance: 0 },
      ]),
    ]
    const txSums = new Map([['cash-1', { ARS: 0, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({
      ars: 0,
      usd: 0,
      accounts: [{ id: 'cash-1', name: 'Billetera', ars: 0, usd: 0, avatar: anyAvatar }],
    })
  })

  it('returns zeros for users without any accounts', () => {
    expect(aggregateHero([], new Map())).toEqual({ ars: 0, usd: 0, accounts: [] })
  })

  it('uses decimal math to avoid float drift', () => {
    const accounts: HeroAccountRow[] = [
      row('cash-1', 'Billetera', [{ currency_code: 'ARS', initial_balance: '0.10' }]),
    ]
    const txSums = new Map([['cash-1', { ARS: 0.2, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({
      ars: 0.3,
      usd: 0,
      accounts: [{ id: 'cash-1', name: 'Billetera', ars: 0.3, usd: 0, avatar: anyAvatar }],
    })
  })
})

describe('buildMonthBalanceSeries', () => {
  const accIds = ['cash-1', 'bank-1']

  it('returns a flat zero series for a month with no movements', () => {
    const series = buildMonthBalanceSeries(2026, 5, [], accIds)

    expect(series.days).toHaveLength(31)
    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.totalAdjustment).toBe(0)
    expect(series.finalBalance).toBe(0)
    expect(series.days.every((d) => d.accumulatedBalance === 0)).toBe(true)
  })

  it('returns empty series when the user has no cash/bank accounts', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-15', type: 'income', amount: 100, account_id: 'cash-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, [])

    expect(series.totalIncome).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('reflects sueldo day as a jump and steady expense days as decline', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-05', type: 'expense', amount: 10_000, account_id: 'cash-1' },
      { date: '2026-05-10', type: 'expense', amount: 5_000, account_id: 'cash-1' },
      { date: '2026-05-15', type: 'income', amount: 850_000, account_id: 'bank-1' },
      { date: '2026-05-20', type: 'expense', amount: 30_000, account_id: 'bank-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.totalIncome).toBe(850_000)
    expect(series.totalExpense).toBe(45_000)
    expect(series.finalBalance).toBe(805_000)

    expect(series.days[4].accumulatedBalance).toBe(-10_000)
    expect(series.days[9].accumulatedBalance).toBe(-15_000)
    expect(series.days[14].accumulatedBalance).toBe(835_000)
    expect(series.days[19].accumulatedBalance).toBe(805_000)
    expect(series.days[30].accumulatedBalance).toBe(805_000)
  })

  it('treats a card statement payment (expense on cash/bank) as a balance drop on its date', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-01', type: 'income', amount: 500_000, account_id: 'bank-1' },
      // Pago de resumen Visa el día 27 (expense en bank, status NULL → entra)
      { date: '2026-05-27', type: 'expense', amount: 145_200, account_id: 'bank-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.days[0].accumulatedBalance).toBe(500_000)
    expect(series.days[26].accumulatedBalance).toBe(354_800)
    expect(series.finalBalance).toBe(354_800)
  })

  it('skips transfer rows (cash↔cash do not change net worth)', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-10', type: 'transfer', amount: 200_000, account_id: 'cash-1' },
      { date: '2026-05-10', type: 'transfer', amount: 200_000, account_id: 'bank-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('routes adjustments to their own signed bucket, out of income/expense', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-15', type: 'adjustment', amount: 1000, account_id: 'cash-1' },
      { date: '2026-05-16', type: 'adjustment', amount: -500, account_id: 'cash-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    // Adjustments are stock corrections, not flow: they don't inflate the bars.
    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.totalAdjustment).toBe(500) // 1000 − 500, net signed
    expect(series.finalBalance).toBe(500) // still moves the accumulated balance
    expect(series.days[14].dailyAdjustment).toBe(1000)
    expect(series.days[15].dailyAdjustment).toBe(-500)
  })

  it('keeps Gastos clean and reconciles the net (QA scenario)', () => {
    // Real first-month data: real spend + real income + adjustments that mostly
    // lower the balance. "Gastos" must reflect only the real expense, while the
    // net still reconciles with the change in available balance.
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-06-10', type: 'expense', amount: 254_461.25, account_id: 'cash-1' },
      { date: '2026-06-05', type: 'income', amount: 7_349_361.79, account_id: 'bank-1' },
      { date: '2026-06-12', type: 'adjustment', amount: -3_152_222.01, account_id: 'cash-1' },
      { date: '2026-06-20', type: 'adjustment', amount: 615_610.22, account_id: 'bank-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 6, txs, accIds)

    expect(series.totalExpense).toBe(254_461.25) // only real spend, not the adjustments
    expect(series.totalIncome).toBe(7_349_361.79) // only real income
    expect(series.totalAdjustment).toBe(-2_536_611.79) // 615_610.22 − 3_152_222.01
    expect(series.finalBalance).toBe(4_558_288.75)
    // Invariant: finalBalance === income − expense + adjustment
    expect(series.finalBalance).toBe(
      series.totalIncome - series.totalExpense + series.totalAdjustment,
    )
  })

  it('reports zero adjustment for a month without any', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-05', type: 'expense', amount: 10_000, account_id: 'cash-1' },
      { date: '2026-05-15', type: 'income', amount: 100_000, account_id: 'bank-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.totalAdjustment).toBe(0)
  })

  it('ignores transactions from accounts not owned by the user', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-10', type: 'expense', amount: 999, account_id: 'someone-elses-account' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.totalExpense).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('produces the right number of days for short months', () => {
    expect(buildMonthBalanceSeries(2026, 2, [], accIds).days).toHaveLength(28)
    expect(buildMonthBalanceSeries(2028, 2, [], accIds).days).toHaveLength(29)
    expect(buildMonthBalanceSeries(2026, 4, [], accIds).days).toHaveLength(30)
  })
})
