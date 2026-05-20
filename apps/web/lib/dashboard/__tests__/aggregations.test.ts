import { describe, expect, it } from 'vitest'
import {
  aggregateHero,
  buildMonthBalanceSeries,
  buildUpcomingFortnight,
  type HeroAccountRow,
  type MonthBalanceTxInput,
  type UpcomingCardPeriodInput,
  type UpcomingPeriodTxInput,
  type UpcomingRecurrenceInstanceInput,
} from '../aggregations'

describe('aggregateHero', () => {
  it('sums initial balances and tx sums across ARS+USD accounts', () => {
    const accounts: HeroAccountRow[] = [
      {
        id: 'cash-1',
        currencies: [
          { currency_code: 'ARS', initial_balance: 100_000 },
          { currency_code: 'USD', initial_balance: 200 },
        ],
      },
      {
        id: 'bank-1',
        currencies: [
          { currency_code: 'ARS', initial_balance: 50_000 },
          { currency_code: 'USD', initial_balance: 300 },
        ],
      },
    ]
    const txSums = new Map<string, { ARS: number; USD: number }>([
      ['cash-1', { ARS: 30_000, USD: 50 }],
      ['bank-1', { ARS: -20_000, USD: 0 }],
    ])

    expect(aggregateHero(accounts, txSums)).toEqual({ ars: 160_000, usd: 550 })
  })

  it('respects off-ledger credit invariant by ignoring credit accounts upstream', () => {
    // aggregateHero only sees the rows passed in; the SQL filter already
    // excludes type='credit'. We simulate that by passing only cash/bank.
    const accounts: HeroAccountRow[] = [
      {
        id: 'cash-1',
        currencies: [{ currency_code: 'ARS', initial_balance: 100_000 }],
      },
    ]
    // getTransactionSums already filters status IS NULL, so credit card
    // expenses never appear here. We pass txSums that include no credit data.
    const txSums = new Map([['cash-1', { ARS: 0, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({ ars: 100_000, usd: 0 })
  })

  it('handles accounts with currencies the user holds no transactions in', () => {
    const accounts: HeroAccountRow[] = [
      {
        id: 'cash-1',
        currencies: [
          { currency_code: 'ARS', initial_balance: 0 },
          { currency_code: 'USD', initial_balance: 0 },
        ],
      },
    ]
    const txSums = new Map([['cash-1', { ARS: 0, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({ ars: 0, usd: 0 })
  })

  it('returns zeros for users without any accounts', () => {
    expect(aggregateHero([], new Map())).toEqual({ ars: 0, usd: 0 })
  })

  it('uses decimal math to avoid float drift', () => {
    const accounts: HeroAccountRow[] = [
      {
        id: 'cash-1',
        currencies: [{ currency_code: 'ARS', initial_balance: '0.10' }],
      },
    ]
    const txSums = new Map([['cash-1', { ARS: 0.2, USD: 0 }]])

    expect(aggregateHero(accounts, txSums)).toEqual({ ars: 0.3, usd: 0 })
  })
})

describe('buildUpcomingFortnight', () => {
  const visaAccount = { id: 'card-visa', name: 'Visa Galicia' }
  const amexAccount = { id: 'card-amex', name: 'Amex' }
  const sueldoAccount = { id: 'bank-sueldo', name: 'Cuenta sueldo' }

  it('builds A pagar from unpaid closed periods, one row per currency with amount > 0', () => {
    const periods: UpcomingCardPeriodInput[] = [
      {
        id: 'period-visa',
        account_id: visaAccount.id,
        due_date: '2026-05-27',
        account: visaAccount,
      },
    ]
    const txs: UpcomingPeriodTxInput[] = [
      { card_period_id: 'period-visa', currency_code: 'ARS', amount: '100000' },
      { card_period_id: 'period-visa', currency_code: 'ARS', amount: '45200' },
      { card_period_id: 'period-visa', currency_code: 'USD', amount: '0' },
    ]

    const result = buildUpcomingFortnight(periods, new Set(), txs, [])

    expect(result.toCollect).toEqual([])
    expect(result.toPay).toEqual([
      {
        id: 'period-visa_ARS',
        kind: 'card_period',
        direction: 'pay',
        date: '2026-05-27',
        label: 'Visa Galicia',
        amount: 145_200,
        currency: 'ARS',
        href: '/cards/card-visa/periods/period-visa',
      },
    ])
  })

  it('excludes already paid periods', () => {
    const periods: UpcomingCardPeriodInput[] = [
      {
        id: 'period-visa',
        account_id: visaAccount.id,
        due_date: '2026-05-27',
        account: visaAccount,
      },
    ]
    const txs: UpcomingPeriodTxInput[] = [
      { card_period_id: 'period-visa', currency_code: 'ARS', amount: '100000' },
    ]
    const paidIds = new Set(['period-visa'])

    const result = buildUpcomingFortnight(periods, paidIds, txs, [])

    expect(result.toPay).toEqual([])
  })

  it('handles overlap of card period and recurrence on the same date', () => {
    const periods: UpcomingCardPeriodInput[] = [
      {
        id: 'period-visa',
        account_id: visaAccount.id,
        due_date: '2026-05-30',
        account: visaAccount,
      },
    ]
    const txs: UpcomingPeriodTxInput[] = [
      { card_period_id: 'period-visa', currency_code: 'ARS', amount: '120000' },
    ]
    const instances: UpcomingRecurrenceInstanceInput[] = [
      {
        id: 'inst-sueldo',
        scheduled_date: '2026-05-30',
        amount: 850_000,
        currency_code: 'ARS',
        recurrence: {
          movement_type: 'income',
          description: 'Sueldo',
          account: sueldoAccount,
        },
      },
    ]

    const result = buildUpcomingFortnight(periods, new Set(), txs, instances)

    expect(result.toPay).toHaveLength(1)
    expect(result.toPay[0]).toMatchObject({
      kind: 'card_period',
      amount: 120_000,
      date: '2026-05-30',
    })
    expect(result.toCollect).toHaveLength(1)
    expect(result.toCollect[0]).toMatchObject({
      kind: 'recurrence_instance',
      label: 'Sueldo',
      amount: 850_000,
      date: '2026-05-30',
    })
  })

  it('routes recurrence movement_type income → collect, expense/transfer → pay', () => {
    const instances: UpcomingRecurrenceInstanceInput[] = [
      {
        id: 'inst-1',
        scheduled_date: '2026-06-01',
        amount: 280_000,
        currency_code: 'ARS',
        recurrence: {
          movement_type: 'expense',
          description: 'Alquiler',
          account: { id: 'bank-1', name: 'Banco' },
        },
      },
      {
        id: 'inst-2',
        scheduled_date: '2026-06-05',
        amount: 50_000,
        currency_code: 'ARS',
        recurrence: {
          movement_type: 'transfer',
          description: 'Pase a ahorro',
          account: { id: 'bank-1', name: 'Banco' },
        },
      },
      {
        id: 'inst-3',
        scheduled_date: '2026-06-10',
        amount: 1_200_000,
        currency_code: 'ARS',
        recurrence: {
          movement_type: 'income',
          description: 'Freelance',
          account: { id: 'cash-1', name: 'Caja' },
        },
      },
    ]

    const result = buildUpcomingFortnight([], new Set(), [], instances)

    expect(result.toPay.map((i) => i.id)).toEqual(['inst-1', 'inst-2'])
    expect(result.toCollect.map((i) => i.id)).toEqual(['inst-3'])
  })

  it('emits separate rows per currency for periods with both ARS and USD pending', () => {
    const periods: UpcomingCardPeriodInput[] = [
      {
        id: 'period-amex',
        account_id: amexAccount.id,
        due_date: '2026-06-03',
        account: amexAccount,
      },
    ]
    const txs: UpcomingPeriodTxInput[] = [
      { card_period_id: 'period-amex', currency_code: 'ARS', amount: '50000' },
      { card_period_id: 'period-amex', currency_code: 'USD', amount: '230' },
    ]

    const result = buildUpcomingFortnight(periods, new Set(), txs, [])

    expect(result.toPay).toHaveLength(2)
    expect(result.toPay.map((i) => i.currency).sort()).toEqual(['ARS', 'USD'])
    expect(result.toPay.find((i) => i.currency === 'USD')?.amount).toBe(230)
  })

  it('falls back to account name when recurrence has no description', () => {
    const instances: UpcomingRecurrenceInstanceInput[] = [
      {
        id: 'inst-1',
        scheduled_date: '2026-06-01',
        amount: 1000,
        currency_code: 'ARS',
        recurrence: {
          movement_type: 'income',
          description: null,
          account: { id: 'cash-1', name: 'Mi plata' },
        },
      },
    ]

    const result = buildUpcomingFortnight([], new Set(), [], instances)

    expect(result.toCollect[0].label).toBe('Mi plata')
  })

  it('sorts items chronologically across both columns', () => {
    const periods: UpcomingCardPeriodInput[] = [
      {
        id: 'period-late',
        account_id: visaAccount.id,
        due_date: '2026-06-10',
        account: visaAccount,
      },
      {
        id: 'period-early',
        account_id: amexAccount.id,
        due_date: '2026-05-25',
        account: amexAccount,
      },
    ]
    const txs: UpcomingPeriodTxInput[] = [
      { card_period_id: 'period-late', currency_code: 'ARS', amount: '100' },
      { card_period_id: 'period-early', currency_code: 'ARS', amount: '200' },
    ]

    const result = buildUpcomingFortnight(periods, new Set(), txs, [])

    expect(result.toPay.map((i) => i.date)).toEqual(['2026-05-25', '2026-06-10'])
  })
})

describe('buildMonthBalanceSeries', () => {
  const accIds = ['cash-1', 'bank-1']

  it('returns a flat zero series for a month with no movements', () => {
    const series = buildMonthBalanceSeries(2026, 5, [], accIds)

    expect(series.days).toHaveLength(31)
    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
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

  it('splits signed adjustments into the right bucket', () => {
    const txs: MonthBalanceTxInput[] = [
      { date: '2026-05-15', type: 'adjustment', amount: 1000, account_id: 'cash-1' },
      { date: '2026-05-16', type: 'adjustment', amount: -500, account_id: 'cash-1' },
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds)

    expect(series.totalIncome).toBe(1000)
    expect(series.totalExpense).toBe(500)
    expect(series.finalBalance).toBe(500)
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
