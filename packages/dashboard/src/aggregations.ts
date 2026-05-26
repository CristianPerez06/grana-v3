import { Money } from '@grana/validation'
import type {
  DashboardHero,
  MonthBalanceDay,
  MonthBalanceSeries,
  UpcomingDirection,
  UpcomingFortnight,
  UpcomingItem,
} from './types'

export type HeroAccountRow = {
  id: string
  currencies: Array<{
    currency_code: string
    initial_balance: number | string | null
  }>
}

export function aggregateHero(
  accounts: HeroAccountRow[],
  txSums: Map<string, { ARS: number; USD: number }>,
): DashboardHero {
  let ars = Money.from(0)
  let usd = Money.from(0)
  for (const acc of accounts) {
    const sums = txSums.get(acc.id) ?? { ARS: 0, USD: 0 }
    for (const c of acc.currencies) {
      if (c.currency_code === 'ARS') {
        ars = Money.add(
          ars,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.ARS)),
        )
      } else if (c.currency_code === 'USD') {
        usd = Money.add(
          usd,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.USD)),
        )
      }
    }
  }
  return { ars: Money.toNumber(ars), usd: Money.toNumber(usd) }
}

export type UpcomingCardPeriodInput = {
  id: string
  account_id: string
  due_date: string
  account: { id: string; name: string } | null
}

export type UpcomingPeriodTxInput = {
  card_period_id: string | null
  currency_code: string
  amount: number | string
}

export type UpcomingRecurrenceInstanceInput = {
  id: string
  scheduled_date: string
  amount: number | string
  currency_code: 'ARS' | 'USD'
  recurrence: {
    id: string
    movement_type: 'income' | 'expense' | 'transfer'
    description: string | null
    account: { id: string; name: string } | null
  }
}

export function buildUpcomingFortnight(
  candidatePeriods: UpcomingCardPeriodInput[],
  paidPeriodIds: Set<string>,
  periodTxs: UpcomingPeriodTxInput[],
  recurrenceInstances: UpcomingRecurrenceInstanceInput[],
): UpcomingFortnight {
  const cardItems = buildUpcomingCardItems(candidatePeriods, paidPeriodIds, periodTxs)
  const recurrenceItems = buildUpcomingRecurrenceItems(recurrenceInstances)
  const all = [...cardItems, ...recurrenceItems]
  all.sort((a, b) => a.date.localeCompare(b.date))
  return {
    toPay: all.filter((i) => i.direction === 'pay'),
    toCollect: all.filter((i) => i.direction === 'collect'),
  }
}

function buildUpcomingCardItems(
  candidatePeriods: UpcomingCardPeriodInput[],
  paidPeriodIds: Set<string>,
  periodTxs: UpcomingPeriodTxInput[],
): UpcomingItem[] {
  const unpaidPeriods = candidatePeriods.filter((p) => !paidPeriodIds.has(p.id))
  if (unpaidPeriods.length === 0) return []

  type AmountByPeriod = { ARS: Money; USD: Money }
  const amounts = new Map<string, AmountByPeriod>()
  const ensure = (id: string): AmountByPeriod => {
    let entry = amounts.get(id)
    if (!entry) {
      entry = { ARS: Money.from(0), USD: Money.from(0) }
      amounts.set(id, entry)
    }
    return entry
  }

  const unpaidIdSet = new Set(unpaidPeriods.map((p) => p.id))
  for (const tx of periodTxs) {
    if (!tx.card_period_id || !unpaidIdSet.has(tx.card_period_id)) continue
    const entry = ensure(tx.card_period_id)
    const amt = Money.from(tx.amount)
    if (tx.currency_code === 'ARS') entry.ARS = Money.add(entry.ARS, amt)
    else if (tx.currency_code === 'USD') entry.USD = Money.add(entry.USD, amt)
  }

  const items: UpcomingItem[] = []
  for (const p of unpaidPeriods) {
    const amt = amounts.get(p.id) ?? { ARS: Money.from(0), USD: Money.from(0) }
    const accountId = p.account?.id ?? p.account_id
    const accountName = p.account?.name ?? 'Tarjeta'

    if (!Money.isZero(amt.ARS)) {
      items.push({
        id: `${p.id}_ARS`,
        kind: 'card_period',
        direction: 'pay',
        date: p.due_date,
        label: accountName,
        amount: Money.toNumber(amt.ARS),
        currency: 'ARS',
        target: { kind: 'card_period', accountId, periodId: p.id },
      })
    }
    if (!Money.isZero(amt.USD)) {
      items.push({
        id: `${p.id}_USD`,
        kind: 'card_period',
        direction: 'pay',
        date: p.due_date,
        label: accountName,
        amount: Money.toNumber(amt.USD),
        currency: 'USD',
        target: { kind: 'card_period', accountId, periodId: p.id },
      })
    }
  }
  return items
}

function buildUpcomingRecurrenceItems(
  instances: UpcomingRecurrenceInstanceInput[],
): UpcomingItem[] {
  const items: UpcomingItem[] = []
  for (const inst of instances) {
    const r = inst.recurrence
    const direction: UpcomingDirection =
      r.movement_type === 'income' ? 'collect' : 'pay'
    const fallbackLabel =
      direction === 'collect' ? 'Ingreso recurrente' : 'Gasto recurrente'
    items.push({
      id: inst.id,
      kind: 'recurrence_instance',
      direction,
      date: inst.scheduled_date,
      label: r.description ?? r.account?.name ?? fallbackLabel,
      amount: Money.toNumber(Money.from(inst.amount)),
      currency: inst.currency_code,
      target: { kind: 'recurrence_instance', recurrenceInstanceId: inst.id },
    })
  }
  return items
}

export type MonthBalanceTxInput = {
  date: string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  amount: number | string
  account_id: string | null
}

export function buildMonthBalanceSeries(
  year: number,
  month: number,
  txs: MonthBalanceTxInput[],
  ownedAccountIds: string[],
): MonthBalanceSeries {
  const lastDay = new Date(year, month, 0).getDate()
  if (ownedAccountIds.length === 0) {
    return emptyMonthSeries(year, month, lastDay)
  }

  const dailyIncome = Array.from({ length: lastDay + 1 }, () => Money.from(0))
  const dailyExpense = Array.from({ length: lastDay + 1 }, () => Money.from(0))
  const accIdSet = new Set(ownedAccountIds)

  for (const tx of txs) {
    const day = parseISODay(tx.date)
    if (day < 1 || day > lastDay) continue
    const amount = Money.from(tx.amount)
    const ownsAccount = tx.account_id != null && accIdSet.has(tx.account_id)
    if (!ownsAccount) continue

    if (tx.type === 'income') {
      dailyIncome[day] = Money.add(dailyIncome[day], amount)
    } else if (tx.type === 'expense') {
      dailyExpense[day] = Money.add(dailyExpense[day], amount)
    } else if (tx.type === 'adjustment') {
      if (Money.compare(amount, Money.from(0)) >= 0) {
        dailyIncome[day] = Money.add(dailyIncome[day], amount)
      } else {
        dailyExpense[day] = Money.subtract(dailyExpense[day], amount)
      }
    }
    // type='transfer' intentionally skipped (cash↔cash transfers don't change
    // the user's net worth).
  }

  const days: MonthBalanceDay[] = []
  let acc = Money.from(0)
  let totalIncome = Money.from(0)
  let totalExpense = Money.from(0)

  for (let d = 1; d <= lastDay; d++) {
    acc = Money.add(acc, Money.subtract(dailyIncome[d], dailyExpense[d]))
    totalIncome = Money.add(totalIncome, dailyIncome[d])
    totalExpense = Money.add(totalExpense, dailyExpense[d])
    days.push({
      day: d,
      accumulatedBalance: Money.toNumber(acc),
      dailyIncome: Money.toNumber(dailyIncome[d]),
      dailyExpense: Money.toNumber(dailyExpense[d]),
    })
  }

  return {
    year,
    month,
    days,
    totalIncome: Money.toNumber(totalIncome),
    totalExpense: Money.toNumber(totalExpense),
    finalBalance: Money.toNumber(acc),
  }
}

function emptyMonthSeries(
  year: number,
  month: number,
  totalDays: number,
): MonthBalanceSeries {
  return {
    year,
    month,
    days: Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      accumulatedBalance: 0,
      dailyIncome: 0,
      dailyExpense: 0,
    })),
    totalIncome: 0,
    totalExpense: 0,
    finalBalance: 0,
  }
}

function parseISODay(iso: string): number {
  return Number(iso.split('-')[2])
}

// `calculateTransactionSums` y su tipo viven en @grana/money-logic (fuente
// única, reutilizable por web y mobile). Se re-exportan acá para no romper a
// los consumidores que los importan vía `@grana/dashboard`.
export { calculateTransactionSums, type BalanceTransactionRow } from '@grana/money-logic'
