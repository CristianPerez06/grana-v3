import { sumMoneyValues, subtractMoneyValues } from '@grana/money-logic'

// Pure derivation of a card statement's per-currency pending/paid totals from its
// transactions. Extracted from the detail read layer so the accounting rule lives
// in one testable place instead of being hand-duplicated by `getCardPeriods` and
// `getCardPeriodDetail`. No I/O: same input → same output.

/**
 * Minimal transaction shape needed to total a statement. Consumos carry a
 * `status` of 'pending' | 'paid'; a statement reimbursement carries
 * `type='reimbursement'` and `status=null`.
 */
export type PeriodAmountRow = {
  type: string
  amount: number | string
  currency_code: string
  status: string | null
}

export type PeriodAmounts = {
  pendingAmountARS: number
  pendingAmountUSD: number
  paidAmountARS: number
  paidAmountUSD: number
}

/**
 * Derive a statement's pending/paid totals per currency.
 *
 * A received "en resumen" reimbursement (`reimbursement_target='statement'`) is a
 * credit that reduces the statement total (`total = Σ consumos − Σ reintegros
 * recibidos`). Because a period's consumos are homogeneous in status — all
 * 'pending' while the statement is open, all 'paid' once it is paid — the
 * reimbursement reduces whichever total the statement actually shows: the PAID
 * total when the period is paid, the PENDING total otherwise.
 *
 * Subtracting the reimbursement only from the pending total (the previous
 * behavior) left a PAID statement overstated by the reimbursement amount — the
 * reintegro appeared in the movements list but never came off the total. That was
 * the bug this module fixes.
 *
 * `rows` must already exclude pending/cancelled reimbursements: only a received,
 * non-cancelled one belongs in the statement. Callers filter them out for the
 * transaction list anyway, so the same filtered list is passed here.
 */
export function computePeriodAmounts(
  rows: PeriodAmountRow[],
  hasPayment: boolean,
): PeriodAmounts {
  const isReimbursement = (r: PeriodAmountRow) => r.type === 'reimbursement'
  const sumWhere = (
    predicate: (r: PeriodAmountRow) => boolean,
    currency: string,
  ): number =>
    sumMoneyValues(
      rows.filter((r) => r.currency_code === currency && predicate(r)).map((r) => r.amount),
    )

  const reimbARS = sumWhere(isReimbursement, 'ARS')
  const reimbUSD = sumWhere(isReimbursement, 'USD')

  const pendingConsumosARS = sumWhere((r) => r.status === 'pending' && !isReimbursement(r), 'ARS')
  const pendingConsumosUSD = sumWhere((r) => r.status === 'pending' && !isReimbursement(r), 'USD')
  const paidConsumosARS = sumWhere((r) => r.status === 'paid' && !isReimbursement(r), 'ARS')
  const paidConsumosUSD = sumWhere((r) => r.status === 'paid' && !isReimbursement(r), 'USD')

  return {
    pendingAmountARS: hasPayment
      ? pendingConsumosARS
      : subtractMoneyValues(pendingConsumosARS, reimbARS),
    pendingAmountUSD: hasPayment
      ? pendingConsumosUSD
      : subtractMoneyValues(pendingConsumosUSD, reimbUSD),
    paidAmountARS: hasPayment
      ? subtractMoneyValues(paidConsumosARS, reimbARS)
      : paidConsumosARS,
    paidAmountUSD: hasPayment
      ? subtractMoneyValues(paidConsumosUSD, reimbUSD)
      : paidConsumosUSD,
  }
}
