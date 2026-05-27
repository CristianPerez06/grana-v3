import { Money, type MoneyType } from '@grana/validation'

export type BalanceCurrency = 'ARS' | 'USD'
type BalanceBuckets = Record<BalanceCurrency, MoneyType>

export type BalanceTransactionRow = {
  account_id: string | null
  transfer_destination_account_id: string | null
  currency_code: string
  amount: number | string
  type: 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange' | 'reimbursement'
  /** Destination leg of an exchange (currency conversion). Only set for type='exchange'. */
  destination_amount?: number | string | null
  destination_currency?: string | null
  /** Reimbursement subtype. Only set for type='reimbursement'. */
  reimbursement_target?: 'account' | 'statement' | null
  /** Reimbursement confirmation instant. NULL = pending (never affects a balance). */
  received_at?: string | null
  /** Reimbursement cancellation instant. Set = cancelled (never affects a balance). */
  cancelled_at?: string | null
}

function emptyBuckets(): BalanceBuckets {
  return {
    ARS: Money.from(0),
    USD: Money.from(0),
  }
}

function isBalanceCurrency(currency: string): currency is BalanceCurrency {
  return currency === 'ARS' || currency === 'USD'
}

/** Exhaustiveness guard: a new transaction_type must be handled everywhere. */
function assertNever(x: never): never {
  throw new Error(`Unhandled transaction type: ${String(x)}`)
}

/**
 * Whether a reimbursement credits a cash/bank account balance. Only a RECEIVED
 * "a cuenta" reimbursement does (it behaves like income). Pending (`received_at`
 * null), cancelled, or "en resumen" (statement) reimbursements never affect an
 * account balance: the statement subtype reduces a card period total instead
 * (see reimbursements.ts), and pending/cancelled are not contable facts yet.
 */
function reimbursementCreditsAccount(row: BalanceTransactionRow): boolean {
  return (
    row.type === 'reimbursement' &&
    row.reimbursement_target === 'account' &&
    row.received_at != null &&
    row.cancelled_at == null
  )
}

/**
 * Sum a flat list of transaction rows by account and currency.
 *
 * Pure function: the caller fetches the rows (typically excluding off-ledger
 * credit-card transactions via `.is('status', null)`) and passes the relevant
 * account ids. Returns a map of accountId -> { ARS, USD } in `number` form
 * (already collapsed from Money).
 */
export function calculateTransactionSums(
  rows: BalanceTransactionRow[],
  accountIds: string[],
): Map<string, Record<BalanceCurrency, number>> {
  const accountIdSet = new Set(accountIds)
  const result = new Map<string, BalanceBuckets>()

  const ensure = (id: string) => {
    if (!result.has(id)) result.set(id, emptyBuckets())
    return result.get(id)!
  }

  for (const row of rows) {
    if (!isBalanceCurrency(row.currency_code) || !row.account_id) continue

    const currency = row.currency_code
    const amount = Money.from(row.amount)

    if (row.type === 'income') {
      ensure(row.account_id)[currency] = Money.add(ensure(row.account_id)[currency], amount)
    } else if (row.type === 'expense') {
      ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
    } else if (row.type === 'transfer') {
      if (accountIdSet.has(row.account_id)) {
        ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
      }
      if (
        row.transfer_destination_account_id &&
        accountIdSet.has(row.transfer_destination_account_id)
      ) {
        ensure(row.transfer_destination_account_id)[currency] = Money.add(
          ensure(row.transfer_destination_account_id)[currency],
          amount,
        )
      }
    } else if (row.type === 'exchange') {
      // Currency conversion: subtract `amount` in `currency_code` from the source
      // account, add `destination_amount` in `destination_currency` to the dest
      // account (which may be the same account, a different currency bucket).
      if (accountIdSet.has(row.account_id)) {
        ensure(row.account_id)[currency] = Money.subtract(ensure(row.account_id)[currency], amount)
      }
      if (
        row.transfer_destination_account_id &&
        accountIdSet.has(row.transfer_destination_account_id) &&
        row.destination_currency &&
        isBalanceCurrency(row.destination_currency) &&
        row.destination_amount != null
      ) {
        const destCurrency = row.destination_currency
        ensure(row.transfer_destination_account_id)[destCurrency] = Money.add(
          ensure(row.transfer_destination_account_id)[destCurrency],
          Money.from(row.destination_amount),
        )
      }
    } else if (row.type === 'adjustment') {
      ensure(row.account_id)[currency] = Money.add(ensure(row.account_id)[currency], amount)
    } else if (row.type === 'reimbursement') {
      // Only a received "a cuenta" reimbursement credits its account, like income.
      if (reimbursementCreditsAccount(row)) {
        ensure(row.account_id)[currency] = Money.add(ensure(row.account_id)[currency], amount)
      }
    } else {
      assertNever(row.type)
    }
  }

  return new Map(
    [...result.entries()].map(([accountId, balances]) => [
      accountId,
      {
        ARS: Money.toNumber(balances.ARS),
        USD: Money.toNumber(balances.USD),
      },
    ]),
  )
}

export type RunningBalanceRow = BalanceTransactionRow & { id: string }

/**
 * Running balance (saldo corriente) for one account, per currency.
 *
 * Pure: given the account's rows in calculation order (`date ASC, created_at
 * ASC, id ASC`) and the per-currency `initial_balance`, returns a map of
 * transaction id -> the account balance (per currency) AFTER that movement.
 *
 * Same per-account effect as `calculateTransactionSums`, applied incrementally.
 * The caller fetches only this account's rows (its `account_id` or
 * `transfer_destination_account_id`) excluding off-ledger card rows, so credit
 * card spend never reaches here. Balances may go negative — never clamped.
 */
export function computeRunningBalances(
  rows: RunningBalanceRow[],
  accountId: string,
  initial: Record<BalanceCurrency, number>,
): Map<string, Record<BalanceCurrency, number>> {
  const acc: BalanceBuckets = {
    ARS: Money.from(initial.ARS ?? 0),
    USD: Money.from(initial.USD ?? 0),
  }
  const snapshots = new Map<string, Record<BalanceCurrency, number>>()

  for (const row of rows) {
    const amount = Money.from(row.amount)
    const currency = isBalanceCurrency(row.currency_code) ? row.currency_code : null

    if (currency) {
      if (row.account_id === accountId) {
        if (row.type === 'income') {
          acc[currency] = Money.add(acc[currency], amount)
        } else if (row.type === 'expense') {
          acc[currency] = Money.subtract(acc[currency], amount)
        } else if (row.type === 'transfer' || row.type === 'exchange') {
          acc[currency] = Money.subtract(acc[currency], amount)
        } else if (row.type === 'adjustment') {
          // adjustment amount keeps its sign in the DB (may be negative)
          acc[currency] = Money.add(acc[currency], amount)
        } else if (row.type === 'reimbursement') {
          // Only a received "a cuenta" reimbursement affects this account's balance.
          if (reimbursementCreditsAccount(row)) {
            acc[currency] = Money.add(acc[currency], amount)
          }
        } else {
          assertNever(row.type)
        }
      }
    }

    if (row.transfer_destination_account_id === accountId) {
      if (row.type === 'transfer' && currency) {
        acc[currency] = Money.add(acc[currency], amount)
      } else if (
        row.type === 'exchange' &&
        row.destination_currency &&
        isBalanceCurrency(row.destination_currency) &&
        row.destination_amount != null
      ) {
        const destCurrency = row.destination_currency
        acc[destCurrency] = Money.add(acc[destCurrency], Money.from(row.destination_amount))
      }
    }

    snapshots.set(row.id, {
      ARS: Money.toNumber(acc.ARS),
      USD: Money.toNumber(acc.USD),
    })
  }

  return snapshots
}

export type PeriodTotals = { in: number; out: number; committed: number }
export type PeriodSummary = Record<BalanceCurrency, PeriodTotals>

/** A credit-card installment/charge that accrues in the period (its leg only). */
export type CommittedInstallmentRow = {
  currency_code: string
  amount: number | string
}

/**
 * Period summary per currency: what came in, what went out of available funds,
 * and what is committed to cards. Intended for the DASHBOARD period summary —
 * the movement list itself does not render it (the dashboard owns the period
 * overview; decided 2026-05-26). Kept here as the shared, pure home for it.
 *
 * `in`/`out` use the SAME rule as the dashboard's `buildMonthBalanceSeries`, so
 * the numbers match by construction: only owned (cash/bank) accounts count;
 * income (and positive adjustments) add to `in`; expense (and negative
 * adjustments) add to `out`; transfer and exchange are skipped (neither is an
 * income nor an expense). Card spend never reaches `ownedRows` (its account is
 * a card, off-ledger), so `out` excludes it automatically.
 *
 * `committed` is fed separately by the caller with the card installments that
 * accrue in the period (a purchase in N installments contributes only the
 * current month's installment, not its total — decided 2026-05-26).
 */
export function summarizePeriod(
  ownedRows: BalanceTransactionRow[],
  ownedAccountIds: string[],
  committedInstallments: CommittedInstallmentRow[],
): PeriodSummary {
  const ins = emptyBuckets()
  const outs = emptyBuckets()
  const committed = emptyBuckets()
  const owned = new Set(ownedAccountIds)
  const zero = Money.from(0)

  for (const row of ownedRows) {
    if (!isBalanceCurrency(row.currency_code) || !row.account_id) continue
    if (!owned.has(row.account_id)) continue

    const currency = row.currency_code
    const amount = Money.from(row.amount)

    if (row.type === 'income') {
      ins[currency] = Money.add(ins[currency], amount)
    } else if (row.type === 'expense') {
      outs[currency] = Money.add(outs[currency], amount)
    } else if (row.type === 'adjustment') {
      if (Money.compare(amount, zero) >= 0) {
        ins[currency] = Money.add(ins[currency], amount)
      } else {
        // amount is negative → subtracting it adds its absolute value to "out"
        outs[currency] = Money.subtract(outs[currency], amount)
      }
    }
    // transfer, exchange: intentionally skipped (neither income nor expense)
  }

  for (const row of committedInstallments) {
    if (!isBalanceCurrency(row.currency_code)) continue
    committed[row.currency_code] = Money.add(committed[row.currency_code], Money.from(row.amount))
  }

  return {
    ARS: {
      in: Money.toNumber(ins.ARS),
      out: Money.toNumber(outs.ARS),
      committed: Money.toNumber(committed.ARS),
    },
    USD: {
      in: Money.toNumber(ins.USD),
      out: Money.toNumber(outs.USD),
      committed: Money.toNumber(committed.USD),
    },
  }
}
