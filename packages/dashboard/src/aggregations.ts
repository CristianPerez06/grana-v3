import { Money } from '@grana/validation'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type {
  DashboardHero,
  HeroAccountBalance,
  MonthBalanceDay,
  MonthBalanceSeries,
} from './types'

export type HeroAccountRow = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  color_key: string | null
  icon_key: string | null
  institution: { brand_color: string | null; icon_type: string | null } | null
  currencies: Array<{
    currency_code: string
    initial_balance: number | string | null
  }>
}

export function aggregateHero(
  accounts: HeroAccountRow[],
  txSums: Map<string, { ARS: number; USD: number }>,
): DashboardHero {
  let totalArs = Money.from(0)
  let totalUsd = Money.from(0)
  const breakdown: HeroAccountBalance[] = []

  for (const acc of accounts) {
    const sums = txSums.get(acc.id) ?? { ARS: 0, USD: 0 }
    let accArs = Money.from(0)
    let accUsd = Money.from(0)
    for (const c of acc.currencies) {
      if (c.currency_code === 'ARS') {
        accArs = Money.add(
          accArs,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.ARS)),
        )
      } else if (c.currency_code === 'USD') {
        accUsd = Money.add(
          accUsd,
          Money.add(Money.from(c.initial_balance ?? 0), Money.from(sums.USD)),
        )
      }
    }
    totalArs = Money.add(totalArs, accArs)
    totalUsd = Money.add(totalUsd, accUsd)
    breakdown.push({
      id: acc.id,
      name: acc.name,
      ars: Money.toNumber(accArs),
      usd: Money.toNumber(accUsd),
      avatar: resolveAccountAvatar(
        {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          color_key: acc.color_key,
          icon_key: acc.icon_key,
        },
        acc.institution,
      ),
    })
  }

  // ARS is the primary currency (bimoneda): order the breakdown by ARS balance
  // desc, then USD desc, then name for a deterministic top-N on the desktop Hero.
  breakdown.sort(
    (a, b) => b.ars - a.ars || b.usd - a.usd || a.name.localeCompare(b.name),
  )

  return {
    ars: Money.toNumber(totalArs),
    usd: Money.toNumber(totalUsd),
    accounts: breakdown,
  }
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
