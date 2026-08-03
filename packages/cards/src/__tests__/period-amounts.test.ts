import { describe, it, expect } from 'vitest'
import { computePeriodAmounts, type PeriodAmountRow } from '../period-amounts'

const consumo = (
  amount: number,
  status: 'pending' | 'paid',
  currency = 'ARS',
): PeriodAmountRow => ({ type: 'expense', amount, currency_code: currency, status })

const reimbursement = (amount: number, currency = 'ARS'): PeriodAmountRow => ({
  type: 'reimbursement',
  amount,
  currency_code: currency,
  // A statement reimbursement carries no consumo status.
  status: null,
})

describe('computePeriodAmounts — open (unpaid) statement', () => {
  it('subtracts a received reimbursement from the PENDING total', () => {
    const rows = [consumo(10_000, 'pending'), reimbursement(3_155.55)]
    const a = computePeriodAmounts(rows, false)
    expect(a.pendingAmountARS).toBe(6_844.45)
    expect(a.paidAmountARS).toBe(0)
  })

  it('sums consumos with no reimbursement', () => {
    const rows = [consumo(10_000, 'pending'), consumo(5_000, 'pending')]
    const a = computePeriodAmounts(rows, false)
    expect(a.pendingAmountARS).toBe(15_000)
  })
})

describe('computePeriodAmounts — paid statement', () => {
  // Regression: the reintegro appeared in the movements list of a paid statement
  // but was never deducted from its total (the real-case bug).
  it('subtracts a received reimbursement from the PAID total', () => {
    // The 7 consumos from the real case sum to 128_841.06.
    const rows: PeriodAmountRow[] = [
      consumo(1_527.76, 'paid'),
      consumo(25_980.3, 'paid'),
      consumo(9_950, 'paid'),
      consumo(14_037.1, 'paid'),
      consumo(7_950, 'paid'),
      consumo(11_460, 'paid'),
      consumo(57_935.9, 'paid'),
      reimbursement(3_155.55),
    ]
    const a = computePeriodAmounts(rows, true)
    expect(a.paidAmountARS).toBe(125_685.51)
    // The pending bucket is not shown for a paid statement and stays at 0.
    expect(a.pendingAmountARS).toBe(0)
  })

  it('leaves the paid total untouched when there is no reimbursement', () => {
    const rows = [consumo(20_000, 'paid'), consumo(5_000, 'paid')]
    const a = computePeriodAmounts(rows, true)
    expect(a.paidAmountARS).toBe(25_000)
  })
})

describe('computePeriodAmounts — per-currency separation (Bimoneda)', () => {
  it('nets ARS and USD reimbursements independently', () => {
    const rows: PeriodAmountRow[] = [
      consumo(10_000, 'paid', 'ARS'),
      consumo(200, 'paid', 'USD'),
      reimbursement(1_000, 'ARS'),
      reimbursement(50, 'USD'),
    ]
    const a = computePeriodAmounts(rows, true)
    expect(a.paidAmountARS).toBe(9_000)
    expect(a.paidAmountUSD).toBe(150)
  })
})
