import { describe, expect, it } from 'vitest'
import {
  aggregateCardDebt,
  aggregateHero,
  aggregateRecurrenceProjection,
  buildMonthBalanceSeries,
  calculateTransactionSums,
  sumByCurrency,
  topCommittedItems,
  type BalanceTransactionRow,
  type CardDebtRow,
  type CommittedItemRow,
  type CommittedRecurrenceRule,
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
        { id: 'cash-1', name: 'Billetera', institutionName: null, ars: 130_000, usd: 250, avatar: anyAvatar },
        { id: 'bank-1', name: 'Banco Galicia', institutionName: null, ars: 30_000, usd: 300, avatar: anyAvatar },
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
      accounts: [{ id: 'cash-1', name: 'Billetera', institutionName: null, ars: 100_000, usd: 0, avatar: anyAvatar }],
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
      accounts: [{ id: 'cash-1', name: 'Billetera', institutionName: null, ars: 0, usd: 0, avatar: anyAvatar }],
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
      accounts: [{ id: 'cash-1', name: 'Billetera', institutionName: null, ars: 0.3, usd: 0, avatar: anyAvatar }],
    })
  })
})

describe('buildMonthBalanceSeries', () => {
  const accIds = ['cash-1', 'bank-1']

  // Row factory with sensible defaults so each test only states what matters.
  const tx = (over: Partial<MonthBalanceTxInput> & Pick<MonthBalanceTxInput, 'date' | 'type' | 'amount' | 'account_id'>): MonthBalanceTxInput => ({
    currency_code: 'ARS',
    ...over,
  })

  it('returns a flat zero series for a month with no movements', () => {
    const series = buildMonthBalanceSeries(2026, 5, [], accIds, 'ARS')

    expect(series.days).toHaveLength(31)
    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.totalAdjustment).toBe(0)
    expect(series.totalCardPayment).toBe(0)
    expect(series.totalReimbursement).toBe(0)
    expect(series.totalSettlement).toBe(0)
    expect(series.totalExchange).toBe(0)
    expect(series.finalBalance).toBe(0)
    expect(series.days.every((d) => d.accumulatedBalance === 0)).toBe(true)
  })

  it('returns empty series when the user has no cash/bank accounts', () => {
    const txs = [tx({ date: '2026-05-15', type: 'income', amount: 100, account_id: 'cash-1' })]
    const series = buildMonthBalanceSeries(2026, 5, txs, [], 'ARS')

    expect(series.totalIncome).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('reflects sueldo day as a jump and steady expense days as decline', () => {
    const txs = [
      tx({ date: '2026-05-05', type: 'expense', amount: 10_000, account_id: 'cash-1' }),
      tx({ date: '2026-05-10', type: 'expense', amount: 5_000, account_id: 'cash-1' }),
      tx({ date: '2026-05-15', type: 'income', amount: 850_000, account_id: 'bank-1' }),
      tx({ date: '2026-05-20', type: 'expense', amount: 30_000, account_id: 'bank-1' }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    expect(series.totalIncome).toBe(850_000)
    expect(series.totalExpense).toBe(45_000)
    expect(series.finalBalance).toBe(805_000)

    expect(series.days[4].accumulatedBalance).toBe(-10_000)
    expect(series.days[9].accumulatedBalance).toBe(-15_000)
    expect(series.days[14].accumulatedBalance).toBe(835_000)
    expect(series.days[19].accumulatedBalance).toBe(805_000)
    expect(series.days[30].accumulatedBalance).toBe(805_000)
  })

  it('routes a card statement payment to its own bucket, out of Gastos, still lowering the net', () => {
    const txs = [
      tx({ date: '2026-05-01', type: 'income', amount: 500_000, account_id: 'bank-1' }),
      // Pago de resumen Visa el día 27 (expense en bank, vinculado a period_payments)
      tx({
        date: '2026-05-27',
        type: 'expense',
        amount: 145_200,
        account_id: 'bank-1',
        is_card_payment: true,
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    expect(series.totalExpense).toBe(0) // card payment is NOT real spend
    expect(series.totalCardPayment).toBe(145_200)
    expect(series.days[0].accumulatedBalance).toBe(500_000)
    expect(series.days[26].accumulatedBalance).toBe(354_800) // it still left cash
    expect(series.finalBalance).toBe(354_800)
  })

  it('skips a transfer between owned accounts (nets to zero)', () => {
    const txs = [
      tx({
        date: '2026-05-10',
        type: 'transfer',
        amount: 200_000,
        account_id: 'cash-1',
        transfer_destination_account_id: 'bank-1',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('routes adjustments to their own signed bucket, out of income/expense', () => {
    const txs = [
      tx({ date: '2026-05-15', type: 'adjustment', amount: 1000, account_id: 'cash-1' }),
      tx({ date: '2026-05-16', type: 'adjustment', amount: -500, account_id: 'cash-1' }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    // Adjustments are stock corrections, not flow: they don't inflate the bars.
    expect(series.totalIncome).toBe(0)
    expect(series.totalExpense).toBe(0)
    expect(series.totalAdjustment).toBe(500) // 1000 − 500, net signed
    expect(series.finalBalance).toBe(500) // still moves the accumulated balance
    expect(series.days[14].dailyAdjustment).toBe(1000)
    expect(series.days[15].dailyAdjustment).toBe(-500)
  })

  it('counts only a received "a cuenta" reimbursement, not pending or cancelled ones', () => {
    const txs = [
      tx({
        date: '2026-05-10',
        type: 'reimbursement',
        amount: 50_000,
        account_id: 'cash-1',
        reimbursement_target: 'account',
        received_at: '2026-05-10T00:00:00Z',
      }),
      // Pendiente (received_at null) → no cuenta
      tx({
        date: '2026-05-11',
        type: 'reimbursement',
        amount: 99_999,
        account_id: 'cash-1',
        reimbursement_target: 'account',
        received_at: null,
      }),
      // Cancelado → no cuenta
      tx({
        date: '2026-05-12',
        type: 'reimbursement',
        amount: 88_888,
        account_id: 'cash-1',
        reimbursement_target: 'account',
        received_at: '2026-05-12T00:00:00Z',
        cancelled_at: '2026-05-13T00:00:00Z',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    expect(series.totalReimbursement).toBe(50_000)
    expect(series.finalBalance).toBe(50_000)
  })

  it('keeps Gastos clean and reconciles the net (QA scenario)', () => {
    const txs = [
      tx({ date: '2026-06-10', type: 'expense', amount: 254_461.25, account_id: 'cash-1' }),
      tx({ date: '2026-06-05', type: 'income', amount: 7_349_361.79, account_id: 'bank-1' }),
      tx({ date: '2026-06-12', type: 'adjustment', amount: -3_152_222.01, account_id: 'cash-1' }),
      tx({ date: '2026-06-20', type: 'adjustment', amount: 615_610.22, account_id: 'bank-1' }),
    ]
    const series = buildMonthBalanceSeries(2026, 6, txs, accIds, 'ARS')

    expect(series.totalExpense).toBe(254_461.25)
    expect(series.totalIncome).toBe(7_349_361.79)
    expect(series.totalAdjustment).toBe(-2_536_611.79)
    expect(series.finalBalance).toBe(4_558_288.75)
    expect(series.finalBalance).toBe(
      series.totalIncome - series.totalExpense + series.totalAdjustment,
    )
  })

  it('ignores transactions from accounts not owned by the user', () => {
    const txs = [
      tx({ date: '2026-05-10', type: 'expense', amount: 999, account_id: 'someone-elses-account' }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, txs, accIds, 'ARS')

    expect(series.totalExpense).toBe(0)
    expect(series.finalBalance).toBe(0)
  })

  it('produces the right number of days for short months', () => {
    expect(buildMonthBalanceSeries(2026, 2, [], accIds, 'ARS').days).toHaveLength(28)
    expect(buildMonthBalanceSeries(2028, 2, [], accIds, 'ARS').days).toHaveLength(29)
    expect(buildMonthBalanceSeries(2026, 4, [], accIds, 'ARS').days).toHaveLength(30)
  })

  // ── Reconciliation guardrail: the month net must equal the change in
  //    `disponible` (calculateTransactionSums) over the same rows, by currency.
  describe('reconciles with calculateTransactionSums (Disponible)', () => {
    // One representative month touching every cash-movement type + the
    // exclusions (pending/cancelled reimbursement, transfer netting to zero).
    const rows: MonthBalanceTxInput[] = [
      tx({ date: '2026-05-02', type: 'income', amount: 850_000, account_id: 'bank-1' }),
      tx({ date: '2026-05-04', type: 'expense', amount: 254_461.25, account_id: 'cash-1' }),
      tx({
        date: '2026-05-06',
        type: 'expense',
        amount: 145_200,
        account_id: 'bank-1',
        is_card_payment: true,
      }),
      tx({ date: '2026-05-08', type: 'adjustment', amount: -3_000, account_id: 'cash-1' }),
      tx({ date: '2026-05-09', type: 'adjustment', amount: 1_000, account_id: 'bank-1' }),
      tx({
        date: '2026-05-10',
        type: 'reimbursement',
        amount: 50_000,
        account_id: 'cash-1',
        reimbursement_target: 'account',
        received_at: '2026-05-10T00:00:00Z',
      }),
      tx({
        date: '2026-05-11',
        type: 'reimbursement',
        amount: 99_999,
        account_id: 'cash-1',
        reimbursement_target: 'account',
        received_at: null,
      }),
      tx({ date: '2026-05-12', type: 'settlement', amount: 40_000, account_id: 'bank-1', settlement_direction: 'in' }),
      tx({ date: '2026-05-13', type: 'settlement', amount: 10_000, account_id: 'cash-1', settlement_direction: 'out' }),
      tx({
        date: '2026-05-14',
        type: 'exchange',
        amount: 120_000,
        account_id: 'cash-1',
        currency_code: 'ARS',
        transfer_destination_account_id: 'bank-1',
        destination_amount: 100,
        destination_currency: 'USD',
      }),
      tx({
        date: '2026-05-15',
        type: 'transfer',
        amount: 200_000,
        account_id: 'cash-1',
        transfer_destination_account_id: 'bank-1',
      }),
      tx({ date: '2026-05-16', type: 'income', amount: 500, account_id: 'bank-1', currency_code: 'USD' }),
    ]

    // calculateTransactionSums ignores `date`/`is_card_payment`; the extra fields
    // are harmless. Sum its per-account result across owned accounts, per currency.
    const sums = calculateTransactionSums(rows as unknown as BalanceTransactionRow[], accIds)
    const disponible = (currency: 'ARS' | 'USD') =>
      accIds.reduce((acc, id) => acc + (sums.get(id)?.[currency] ?? 0), 0)

    it('ARS net equals the ARS change in disponible', () => {
      const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')
      expect(series.finalBalance).toBeCloseTo(disponible('ARS'), 6)
      expect(series.finalBalance).toBe(408_338.75)
    })

    it('USD net equals the USD change in disponible (exchange destination + income)', () => {
      const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'USD')
      expect(series.finalBalance).toBeCloseTo(disponible('USD'), 6)
      expect(series.finalBalance).toBe(600) // 500 income + 100 exchange-in
      expect(series.totalExchange).toBe(100)
    })

    it('buckets each type correctly (ARS)', () => {
      const s = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')
      expect(s.totalIncome).toBe(850_000)
      expect(s.totalExpense).toBe(254_461.25) // excludes the card payment
      expect(s.totalCardPayment).toBe(145_200)
      expect(s.totalAdjustment).toBe(-2_000)
      expect(s.totalReimbursement).toBe(50_000) // pending one excluded
      expect(s.totalSettlement).toBe(30_000) // 40_000 in − 10_000 out
      expect(s.totalExchange).toBe(-120_000) // source leg leaves ARS
    })

    it('matches the legacy formula when only income/expense/adjustment exist (no regression)', () => {
      const legacyRows = rows.filter(
        (r) => (r.type === 'income' || r.type === 'expense' || r.type === 'adjustment') && r.currency_code === 'ARS' && !r.is_card_payment,
      )
      const s = buildMonthBalanceSeries(2026, 5, legacyRows, accIds, 'ARS')
      expect(s.finalBalance).toBe(s.totalIncome - s.totalExpense + s.totalAdjustment)
    })
  })
})

describe('aggregateCardDebt', () => {
  it('sums pending consumos minus received reimbursements, per currency', () => {
    const rows: CardDebtRow[] = [
      { type: 'expense', amount: 120_000, currency_code: 'ARS', status: 'pending', received_at: null, cancelled_at: null },
      { type: 'expense', amount: 90_000, currency_code: 'ARS', status: 'pending', received_at: null, cancelled_at: null },
      // received statement reimbursement reduces the debt
      { type: 'reimbursement', amount: 15_000, currency_code: 'ARS', status: null, received_at: '2026-06-10T00:00:00Z', cancelled_at: null },
      { type: 'expense', amount: 50, currency_code: 'USD', status: 'pending', received_at: null, cancelled_at: null },
      // a paid consumo does not count (only pending)
      { type: 'expense', amount: 999, currency_code: 'ARS', status: 'paid', received_at: null, cancelled_at: null },
      // pending (not yet received) reimbursement: does not reduce debt
      { type: 'reimbursement', amount: 7_000, currency_code: 'ARS', status: null, received_at: null, cancelled_at: null },
      // cancelled reimbursement: does not reduce debt
      { type: 'reimbursement', amount: 8_000, currency_code: 'ARS', status: null, received_at: '2026-06-11T00:00:00Z', cancelled_at: '2026-06-12T00:00:00Z' },
    ]
    expect(aggregateCardDebt(rows)).toEqual({ ARS: 195_000, USD: 50 })
  })

  it('returns zeros for no rows', () => {
    expect(aggregateCardDebt([])).toEqual({ ARS: 0, USD: 0 })
  })
})

describe('aggregateRecurrenceProjection', () => {
  const rule = (over: Partial<CommittedRecurrenceRule> & Pick<CommittedRecurrenceRule, 'id' | 'amount' | 'movement_type'>): CommittedRecurrenceRule => ({
    start_date: '2026-01-15',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month',
    max_occurrences: null,
    last_generated_date: null,
    currency_code: 'ARS',
    ...over,
  })

  it('sums occurrences in the window by currency and movement_type; ignores transfer', () => {
    const rules: CommittedRecurrenceRule[] = [
      rule({ id: 'rent', amount: 132_000, movement_type: 'expense', start_date: '2026-01-15' }),
      rule({ id: 'salary', amount: 480_000, movement_type: 'income', start_date: '2026-01-05' }),
      rule({ id: 'move', amount: 999, movement_type: 'transfer', start_date: '2026-01-10' }),
      rule({ id: 'sub-usd', amount: 50, movement_type: 'expense', currency_code: 'USD', start_date: '2026-01-20' }),
    ]
    // Next calendar month window
    const totals = aggregateRecurrenceProjection(rules, '2026-07-01', '2026-07-31')

    expect(totals.expense).toEqual({ ARS: 132_000, USD: 50 })
    expect(totals.income).toEqual({ ARS: 480_000, USD: 0 })
  })

  it('excludes rules whose occurrences fall outside the window', () => {
    const rules: CommittedRecurrenceRule[] = [
      // annual rule: next occurrence 2027-03-01, not in a 2026-07 window
      rule({ id: 'annual', amount: 1_000, movement_type: 'expense', interval_unit: 'year', start_date: '2026-03-01' }),
    ]
    const totals = aggregateRecurrenceProjection(rules, '2026-07-01', '2026-07-31')
    expect(totals.expense).toEqual({ ARS: 0, USD: 0 })
    expect(totals.income).toEqual({ ARS: 0, USD: 0 })
  })
})

describe('topCommittedItems', () => {
  const rows: CommittedItemRow[] = [
    { amount: 100, currency_code: 'ARS', description: 'A', date: '2026-07-01' },
    { amount: 900, currency_code: 'ARS', description: 'B', date: '2026-07-02' },
    { amount: 300, currency_code: 'ARS', description: 'C', date: '2026-07-03' },
    { amount: 50, currency_code: 'USD', description: 'D', date: '2026-07-04' },
  ]

  it('returns the top-N of ONE currency, by amount desc', () => {
    expect(topCommittedItems(rows, 'ARS', 2)).toEqual([
      { description: 'B', date: '2026-07-02', amount: 900 },
      { description: 'C', date: '2026-07-03', amount: 300 },
    ])
  })

  it('filters by currency (never mixes ARS and USD)', () => {
    expect(topCommittedItems(rows, 'USD')).toEqual([
      { description: 'D', date: '2026-07-04', amount: 50 },
    ])
  })

  it('falls back to empty description/date when missing', () => {
    const [item] = topCommittedItems([{ amount: 10, currency_code: 'ARS' }], 'ARS')
    expect(item).toEqual({ description: '', date: '', amount: 10 })
  })
})

describe('sumByCurrency', () => {
  it('sums amounts per currency, never combining ARS and USD', () => {
    const rows: CommittedItemRow[] = [
      { amount: 120_000, currency_code: 'ARS' },
      { amount: '22500.50', currency_code: 'ARS' },
      { amount: 30, currency_code: 'USD' },
    ]
    expect(sumByCurrency(rows)).toEqual({ ARS: 142_500.5, USD: 30 })
  })

  it('ignores unknown currencies and returns zeros for empty input', () => {
    expect(sumByCurrency([{ amount: 5, currency_code: 'EUR' }])).toEqual({ ARS: 0, USD: 0 })
    expect(sumByCurrency([])).toEqual({ ARS: 0, USD: 0 })
  })
})

describe('aggregateCardDebt overdue split (parity with cards "A pagar")', () => {
  // The committed outlook computes `debt` (all closed/overdue unpaid) and
  // `overdue` (the due_date<today subset) by running aggregateCardDebt over the
  // full set and over the overdue-only subset — the same pending−reimbursement
  // math the Tarjetas module uses. This guards that the subset sums correctly.
  const tx = (over: Partial<CardDebtRow>): CardDebtRow => ({
    type: 'expense',
    amount: 0,
    currency_code: 'ARS',
    status: 'pending',
    received_at: null,
    cancelled_at: null,
    card_period_id: 'p1',
    ...over,
  })

  it('overdue subset is a strict subset of the full to-pay sum', () => {
    const txs: CardDebtRow[] = [
      tx({ amount: 419_840, card_period_id: 'closed' }),
      tx({ amount: 12_000, card_period_id: 'overdue' }),
      tx({ type: 'reimbursement', amount: 2_000, status: null, received_at: '2026-06-01', card_period_id: 'closed' }),
    ]
    const overdueIds = new Set(['overdue'])
    const toPay = aggregateCardDebt(txs)
    const overdue = aggregateCardDebt(txs.filter((t) => overdueIds.has(t.card_period_id!)))
    expect(toPay.ARS).toBe(429_840) // 419_840 + 12_000 − 2_000
    expect(overdue.ARS).toBe(12_000)
  })
})
