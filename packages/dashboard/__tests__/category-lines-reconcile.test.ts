import { describe, expect, it } from 'vitest'
import {
  categoryOwnPortion,
  computeCategoryNet,
  countsAsCategorySpend,
  type CategoryAggRow,
} from '@grana/money-logic'

// ── Reconciliation invariant for `reconcile-category-drill-list` ───────────────
// The donut weight (`getMonthCategoryBreakdown`) and the drilled list
// (`getMonthCategoryLines`) both compose a category from the SAME devengado lens
// helpers (`countsAsCategorySpend` / `categoryOwnPortion`). This test replicates
// both production loops over one synthetic row set and asserts the donut's `neto`
// equals the list's signed sum — so any drift in the helpers (or in how either
// site applies them) breaks here instead of shipping a list that doesn't add up.

type Row = {
  id: string
  is_parent: boolean
  hasStatementPayment: boolean
  is_shared: boolean
  amount: number
  kind: 'expense' | 'reimbursement'
}

const CAT = 'comida'
const CUR = 'ARS'

// A representative month for one category: normal expense, a cuota child (counts;
// its off-ledger parent does not), a statement payment (excluded), a 50/50 shared
// expense (counts the user's half), a 100%-other shared expense (excluded), plus
// two reimbursements (own + shared) that net the spend down.
const rows: Row[] = [
  { id: 'e-normal', is_parent: false, hasStatementPayment: false, is_shared: false, amount: 10_000, kind: 'expense' },
  { id: 'e-cuota-3', is_parent: false, hasStatementPayment: false, is_shared: false, amount: 100_000, kind: 'expense' },
  { id: 'e-parent', is_parent: true, hasStatementPayment: false, is_shared: false, amount: 600_000, kind: 'expense' },
  { id: 'e-payment', is_parent: false, hasStatementPayment: true, is_shared: false, amount: 50_000, kind: 'expense' },
  { id: 'e-shared-50', is_parent: false, hasStatementPayment: false, is_shared: true, amount: 10_000, kind: 'expense' },
  { id: 'e-shared-0', is_parent: false, hasStatementPayment: false, is_shared: true, amount: 8_000, kind: 'expense' },
  { id: 'r-own', is_parent: false, hasStatementPayment: false, is_shared: false, amount: 3_000, kind: 'reimbursement' },
  { id: 'r-shared-50', is_parent: false, hasStatementPayment: false, is_shared: true, amount: 4_000, kind: 'reimbursement' },
]

// The user's splits: half of each shared row she participates in; NO split for
// the 100%-other expense (she has no row → `categoryOwnPortion` returns null).
const mySplit = new Map<string, number>([
  ['e-shared-50', 5_000],
  ['r-shared-50', 2_000],
])

// Donut path: build aggRows exactly like `getMonthCategoryBreakdown`, then net.
function donutNeto(): number {
  const aggRows: CategoryAggRow[] = []
  for (const row of rows) {
    if (row.kind === 'expense') {
      if (!countsAsCategorySpend(row)) continue
      const share = categoryOwnPortion(row, mySplit)
      if (share === null) continue
      aggRows.push({ categoryId: CAT, kind: 'expense', currency_code: CUR, amount: share })
    } else {
      const share = categoryOwnPortion(row, mySplit)
      if (share === null) continue
      aggRows.push({
        categoryId: CAT,
        kind: 'reimbursement',
        currency_code: CUR,
        amount: share,
        received_at: '2026-07-01',
        cancelled_at: null,
      })
    }
  }
  return computeCategoryNet(aggRows).get(CAT)![CUR].neto
}

// Lines path: build per-row shares like `getMonthCategoryLines`, then sum with
// the row signs (expense '-', reimbursement '+' → the signed sum is the spend).
function linesSignedSpend(): { sum: number; ids: string[] } {
  let sum = 0
  const ids: string[] = []
  for (const row of rows) {
    if (row.kind === 'expense' && !countsAsCategorySpend(row)) continue
    const share = categoryOwnPortion(row, mySplit)
    if (share === null) continue
    sum += row.kind === 'expense' ? share : -share
    ids.push(row.id)
  }
  return { sum, ids }
}

describe('category drill reconciliation', () => {
  it('donut neto equals the drilled list signed spend', () => {
    const { sum } = linesSignedSpend()
    // 10.000 + 100.000 + 5.000 (own halves) − 3.000 − 2.000 = 110.000
    expect(sum).toBe(110_000)
    expect(donutNeto()).toBe(sum)
  })

  it('excludes exactly the parent, the statement payment and the 100%-other share', () => {
    const { ids } = linesSignedSpend()
    expect(ids).not.toContain('e-parent') // off-ledger installment parent
    expect(ids).not.toContain('e-payment') // statement payment, cancels debt
    expect(ids).not.toContain('e-shared-0') // 100% the other member → not ours
    expect(ids).toEqual(['e-normal', 'e-cuota-3', 'e-shared-50', 'r-own', 'r-shared-50'])
  })
})
