import { describe, expect, it } from 'vitest'
import {
  calculateTransactionSums,
  computeRunningBalances,
  computeCategoryNet,
  sumReceivedStatementReimbursements,
  suggestReimbursementAmount,
  type BalanceTransactionRow,
  type RunningBalanceRow,
  type CategoryAggRow,
  type ReimbursementStateRow,
} from '@grana/money-logic'

const RECEIVED = '2026-05-20T12:00:00Z'
const CANCELLED = '2026-05-21T12:00:00Z'

function txRow(o: Partial<BalanceTransactionRow>): BalanceTransactionRow {
  return {
    account_id: 'caja',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    amount: '0',
    type: 'income',
    ...o,
  }
}

describe('reimbursement in calculateTransactionSums', () => {
  it('a pending "a cuenta" reimbursement does NOT add to the account', () => {
    const rows: BalanceTransactionRow[] = [
      txRow({ type: 'reimbursement', reimbursement_target: 'account', amount: '20000', received_at: null }),
    ]
    expect(calculateTransactionSums(rows, ['caja']).get('caja')?.ARS ?? 0).toBe(0)
  })

  it('a received "a cuenta" reimbursement adds to the account like income', () => {
    const rows: BalanceTransactionRow[] = [
      txRow({ type: 'reimbursement', reimbursement_target: 'account', amount: '20000', received_at: RECEIVED }),
    ]
    expect(calculateTransactionSums(rows, ['caja']).get('caja')?.ARS).toBe(20000)
  })

  it('a cancelled reimbursement never adds, even if it has received_at null', () => {
    const rows: BalanceTransactionRow[] = [
      txRow({ type: 'reimbursement', reimbursement_target: 'account', amount: '20000', received_at: null, cancelled_at: CANCELLED }),
    ]
    expect(calculateTransactionSums(rows, ['caja']).get('caja')?.ARS ?? 0).toBe(0)
  })

  it('a received "en resumen" reimbursement does NOT affect an account balance', () => {
    const rows: BalanceTransactionRow[] = [
      txRow({ account_id: 'visa', type: 'reimbursement', reimbursement_target: 'statement', amount: '20000', received_at: RECEIVED }),
    ]
    expect(calculateTransactionSums(rows, ['visa']).get('visa')?.ARS ?? 0).toBe(0)
  })
})

describe('reimbursement in computeRunningBalances', () => {
  function rb(o: Partial<RunningBalanceRow>): RunningBalanceRow {
    return { id: 'x', ...txRow(o) }
  }

  it('only a received "a cuenta" reimbursement moves the running balance', () => {
    const rows: RunningBalanceRow[] = [
      rb({ id: '1', type: 'income', amount: '1000' }),
      rb({ id: '2', type: 'reimbursement', reimbursement_target: 'account', amount: '500', received_at: null }),
      rb({ id: '3', type: 'reimbursement', reimbursement_target: 'account', amount: '500', received_at: RECEIVED }),
    ]
    const snaps = computeRunningBalances(rows, 'caja', { ARS: 0, USD: 0 })
    expect(snaps.get('1')?.ARS).toBe(1000) // income
    expect(snaps.get('2')?.ARS).toBe(1000) // pending reimbursement: unchanged
    expect(snaps.get('3')?.ARS).toBe(1500) // received reimbursement: +500
  })
})

describe('sumReceivedStatementReimbursements', () => {
  it('sums only received, non-cancelled statement reimbursements, per currency', () => {
    const rows: ReimbursementStateRow[] = [
      { currency_code: 'ARS', amount: '20000', reimbursement_target: 'statement', received_at: RECEIVED },
      { currency_code: 'ARS', amount: '5000', reimbursement_target: 'statement', received_at: null }, // pending
      { currency_code: 'ARS', amount: '9999', reimbursement_target: 'statement', received_at: RECEIVED, cancelled_at: CANCELLED }, // cancelled
      { currency_code: 'ARS', amount: '1000', reimbursement_target: 'account', received_at: RECEIVED }, // wrong subtype
      { currency_code: 'USD', amount: '15', reimbursement_target: 'statement', received_at: RECEIVED },
    ]
    const result = sumReceivedStatementReimbursements(rows)
    expect(result.ARS).toBe(20000)
    expect(result.USD).toBe(15)
  })
})

describe('computeCategoryNet', () => {
  it('bruto, recibido, esperado and neto per category', () => {
    const rows: CategoryAggRow[] = [
      { categoryId: 'super', kind: 'expense', currency_code: 'ARS', amount: '100000' },
      { categoryId: 'super', kind: 'reimbursement', currency_code: 'ARS', amount: '20000', received_at: RECEIVED },
      { categoryId: 'super', kind: 'reimbursement', currency_code: 'ARS', amount: '10000', received_at: null }, // esperado
      { categoryId: 'super', kind: 'reimbursement', currency_code: 'ARS', amount: '7777', received_at: null, cancelled_at: CANCELLED }, // ignored
    ]
    const net = computeCategoryNet(rows).get('super')!.ARS
    expect(net.bruto).toBe(100000)
    expect(net.recibido).toBe(20000)
    expect(net.esperado).toBe(10000)
    expect(net.neto).toBe(80000)
  })
})

describe('suggestReimbursementAmount', () => {
  it('computes a percentage of the expense', () => {
    expect(suggestReimbursementAmount('100000', 20)).toBe(20000)
  })

  it('applies the cap when the percentage exceeds it', () => {
    expect(suggestReimbursementAmount('100000', 20, '15000')).toBe(15000)
  })

  it('keeps cents precise for fractional percentages', () => {
    expect(suggestReimbursementAmount('100000', 12.5)).toBe(12500)
  })
})
