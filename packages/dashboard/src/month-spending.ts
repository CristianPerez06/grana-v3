// "Cuánto gastaste" — the month's OWN spending, split by settlement state.
//
// The card reads on ONE lens and one unit: **your expenses**. Every amount here
// is your share of a shared movement, never the full ticket. The cash lens —
// pesos moving through your accounts, full amounts — is the balance card's job
// ("Se fue"), and mixing the two is what produced the bug this replaces: the old
// `Te queda por pagar` subtracted a full amount (`totalExpense`) from a
// your-share amount, understating the card debt by the partner's share of every
// shared expense you fronted.
//
// The split is by WHERE the money stands, and each side breaks down by WHO:
//
//   Gastaste  =  Ya se pagó  +  Por pagar
//
//   Ya se pagó → the money already left SOME account
//                · pusiste vos     — it left yours
//                · lo puso el otro — it left your partner's (you owe them)
//   Por pagar  → still riding on a credit card
//                · en tus tarjetas    — comes in YOUR statement
//                · se lo debés al otro — it is on THEIR card
//
// A shared expense your partner paid is settled with the merchant but not with
// you: that is why "Ya se pagó" is impersonal. It says the expense is paid, not
// that you paid it.
//
// RN-safe: no DOM/Node deps.

import { Money, type MoneyType } from '@grana/validation'
import type { OutlookCurrency } from './spending'

export type MonthSpendingSplit = {
  /** Total own spending accrued in the month. */
  gastaste: number
  yaSePago: {
    total: number
    /** Left one of YOUR cash/bank accounts. */
    pusisteVos: number
    /** Left your partner's account — settled with the merchant, owed to them. */
    pusoElOtro: number
  }
  porPagar: {
    total: number
    /** Riding on one of YOUR credit cards. */
    enTusTarjetas: number
    /** Riding on your partner's card — you owe them, no statement of yours. */
    leDebesAlOtro: number
  }
}

export type MonthSpendingByCurrency = Record<OutlookCurrency, MonthSpendingSplit>

/**
 * One movement of the month, with the user's OWN portion already resolved
 * (`amount`), ready to be placed in a bucket.
 */
export type MonthSpendingRow = {
  kind: 'expense' | 'reimbursement'
  /** The user's own portion, positive. */
  amount: number
  currency_code: string
  /** Cash/bank account for a paid expense, credit account for a card one. */
  account_id: string | null
  /** Non-null when the movement rides on a credit card statement. */
  card_period_id: string | null
  /** Reimbursements only: 'account' credits an account, 'statement' a card. */
  reimbursement_target?: string | null
}

type Buckets = {
  pusisteVos: MoneyType
  pusoElOtro: MoneyType
  enTusTarjetas: MoneyType
  leDebesAlOtro: MoneyType
}

const emptyBuckets = (): Buckets => ({
  pusisteVos: Money.from(0),
  pusoElOtro: Money.from(0),
  enTusTarjetas: Money.from(0),
  leDebesAlOtro: Money.from(0),
})

const isOutlookCurrency = (c: string): c is OutlookCurrency => c === 'ARS' || c === 'USD'

/**
 * Which of the four buckets a movement belongs to.
 *
 * On a card → it is still to be paid, and whose card decides who you owe. Off a
 * card → it is already settled with the merchant, and whose account decides
 * whether you are square.
 *
 * A movement whose account is unknown is skipped rather than guessed: putting it
 * in the wrong bucket would move money between "already settled" and "you still
 * owe it", which is the one thing this card must not get wrong.
 */
const bucketOf = (row: MonthSpendingRow, myAccountIds: Set<string>): keyof Buckets | null => {
  if (row.account_id == null) return null
  const mine = myAccountIds.has(row.account_id)

  if (row.card_period_id != null) return mine ? 'enTusTarjetas' : 'leDebesAlOtro'
  return mine ? 'pusisteVos' : 'pusoElOtro'
}

/**
 * Aggregate the month's own spending into the four buckets, per currency.
 *
 * A received reimbursement SUBTRACTS from the bucket it landed in: credited to an
 * account it undoes something already settled, credited to a statement it lowers
 * what the card will charge. Netting it anywhere else would break
 * `yaSePago + porPagar === gastaste`.
 *
 * Buckets are floored at zero: a reimbursement larger than the month's spend in
 * its bucket is a credit, not negative spending, and a negative amount in a tile
 * labelled "ya se pagó" reads as nonsense.
 */
export function aggregateMonthSpending(
  rows: MonthSpendingRow[],
  myAccountIds: string[],
): MonthSpendingByCurrency {
  const mine = new Set(myAccountIds)
  const acc: Record<OutlookCurrency, Buckets> = { ARS: emptyBuckets(), USD: emptyBuckets() }

  for (const row of rows) {
    if (!isOutlookCurrency(row.currency_code)) continue
    const bucket = bucketOf(row, mine)
    if (bucket === null) continue

    const amount = Money.from(row.amount)
    const target = acc[row.currency_code]
    target[bucket] =
      row.kind === 'expense'
        ? Money.add(target[bucket], amount)
        : Money.subtract(target[bucket], amount)
  }

  const build = (currency: OutlookCurrency): MonthSpendingSplit => {
    const b = acc[currency]
    const floor = (m: MoneyType) => Math.max(Money.toNumber(m), 0)

    const pusisteVos = floor(b.pusisteVos)
    const pusoElOtro = floor(b.pusoElOtro)
    const enTusTarjetas = floor(b.enTusTarjetas)
    const leDebesAlOtro = floor(b.leDebesAlOtro)

    const yaSePago = Money.toNumber(Money.add(Money.from(pusisteVos), Money.from(pusoElOtro)))
    const porPagar = Money.toNumber(
      Money.add(Money.from(enTusTarjetas), Money.from(leDebesAlOtro)),
    )

    return {
      gastaste: Money.toNumber(Money.add(Money.from(yaSePago), Money.from(porPagar))),
      yaSePago: { total: yaSePago, pusisteVos, pusoElOtro },
      porPagar: { total: porPagar, enTusTarjetas, leDebesAlOtro },
    }
  }

  return { ARS: build('ARS'), USD: build('USD') }
}
