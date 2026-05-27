import { Money } from '@grana/validation'
import type { BalanceCurrency } from './balance'

// Pure reimbursement (reintegro / cashback) logic, shared web + mobile.
// A reimbursement is a movement of its own type, linked to the origin expense,
// pending until `received_at` is set. The central rule: a PENDING reimbursement
// never enters any calculation; only a RECEIVED (and not cancelled) one does.
// See openspec/changes/add-reimbursements/design.md.

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

function isBalanceCurrency(currency: string): currency is BalanceCurrency {
  return currency === 'ARS' || currency === 'USD'
}

/** Reimbursement state, as needed by the pure aggregations. */
export type ReimbursementStateRow = {
  currency_code: string
  amount: number | string
  reimbursement_target?: 'account' | 'statement' | null
  /** NULL = pending. */
  received_at?: string | null
  /** Set = cancelled. */
  cancelled_at?: string | null
}

function isReceived(row: { received_at?: string | null; cancelled_at?: string | null }): boolean {
  return row.received_at != null && row.cancelled_at == null
}

/**
 * Sum of RECEIVED, non-cancelled "en resumen" (statement) reimbursements, per
 * currency. The caller subtracts this from the period's charges to get the net
 * payable (`total a pagar = Σ consumos − Σ reintegros statement recibidos`).
 * Pending and cancelled statement reimbursements do NOT reduce the period.
 */
export function sumReceivedStatementReimbursements(
  rows: ReimbursementStateRow[],
): Record<BalanceCurrency, number> {
  const acc = { ARS: Money.from(0), USD: Money.from(0) }

  for (const row of rows) {
    if (!isBalanceCurrency(row.currency_code)) continue
    if (row.reimbursement_target !== 'statement') continue
    if (!isReceived(row)) continue
    acc[row.currency_code] = Money.add(acc[row.currency_code], Money.from(row.amount))
  }

  return { ARS: Money.toNumber(acc.ARS), USD: Money.toNumber(acc.USD) }
}

// ─── Net per category ──────────────────────────────────────────────────────────

/** Gross spend, received reimbursements, expected (pending) and net per currency. */
export type CategoryNet = { bruto: number; recibido: number; esperado: number; neto: number }

/**
 * One row feeding the category net. For reimbursements the caller resolves the
 * DERIVED category (from the linked expense) and passes it as `categoryId`,
 * because the reimbursement does not store its own category.
 */
export type CategoryAggRow = {
  categoryId: string
  kind: 'expense' | 'reimbursement'
  currency_code: string
  amount: number | string
  /** Only for kind='reimbursement'. */
  received_at?: string | null
  cancelled_at?: string | null
}

/**
 * Net spend per category and currency:
 *   bruto    = Σ expenses
 *   recibido = Σ received (not cancelled) reimbursements with that derived category
 *   esperado = Σ pending reimbursements (shown apart, never netted)
 *   neto     = bruto − recibido
 * Reimbursements never count as generic income. Cancelled ones are ignored.
 */
export function computeCategoryNet(
  rows: CategoryAggRow[],
): Map<string, Record<BalanceCurrency, CategoryNet>> {
  type Buckets = Record<BalanceCurrency, { bruto: ReturnType<typeof Money.from>; recibido: ReturnType<typeof Money.from>; esperado: ReturnType<typeof Money.from> }>
  const acc = new Map<string, Buckets>()

  const ensure = (id: string): Buckets => {
    if (!acc.has(id)) {
      acc.set(id, {
        ARS: { bruto: Money.from(0), recibido: Money.from(0), esperado: Money.from(0) },
        USD: { bruto: Money.from(0), recibido: Money.from(0), esperado: Money.from(0) },
      })
    }
    return acc.get(id)!
  }

  for (const row of rows) {
    if (!isBalanceCurrency(row.currency_code)) continue
    const bucket = ensure(row.categoryId)[row.currency_code]
    const amount = Money.from(row.amount)

    if (row.kind === 'expense') {
      bucket.bruto = Money.add(bucket.bruto, amount)
    } else {
      // reimbursement
      if (row.cancelled_at != null) continue // cancelled: ignored
      if (isReceived(row)) {
        bucket.recibido = Money.add(bucket.recibido, amount)
      } else {
        bucket.esperado = Money.add(bucket.esperado, amount)
      }
    }
  }

  const result = new Map<string, Record<BalanceCurrency, CategoryNet>>()
  for (const [id, buckets] of acc.entries()) {
    const perCurrency = emptyByCurrencyNet()
    for (const c of CURRENCIES) {
      const bruto = Money.toNumber(buckets[c].bruto)
      const recibido = Money.toNumber(buckets[c].recibido)
      const esperado = Money.toNumber(buckets[c].esperado)
      perCurrency[c] = {
        bruto,
        recibido,
        esperado,
        neto: Money.toNumber(Money.subtract(buckets[c].bruto, buckets[c].recibido)),
      }
    }
    result.set(id, perCurrency)
  }
  return result
}

function emptyByCurrencyNet(): Record<BalanceCurrency, CategoryNet> {
  return {
    ARS: { bruto: 0, recibido: 0, esperado: 0, neto: 0 },
    USD: { bruto: 0, recibido: 0, esperado: 0, neto: 0 },
  }
}

// ─── Suggested amount (% + cap) — UI carry helper, not persisted ────────────────

/**
 * Suggested reimbursement amount from a percentage of the expense, optionally
 * capped. UI-only carry helper: the percentage and cap are NOT persisted; only
 * the resulting (possibly user-edited) amount is. E.g. $100.000 at 20% capped
 * at $15.000 → $15.000.
 */
export function suggestReimbursementAmount(
  expenseAmount: number | string,
  percent: number,
  cap?: number | string | null,
): number {
  // expense * percent / 100, rounding to cents only at the end (divide rounds).
  const raw = Money.divide(Money.multiply(Money.from(expenseAmount), percent), 100)
  if (cap == null) return Money.toNumber(raw)
  const capMoney = Money.from(cap)
  return Money.toNumber(Money.compare(raw, capMoney) <= 0 ? raw : capMoney)
}
