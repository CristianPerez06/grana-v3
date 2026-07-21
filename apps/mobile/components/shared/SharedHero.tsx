import { useMemo } from 'react'
import { Text, View } from 'react-native'
import type { BalanceCurrency } from '@grana/money-logic'
import type { SharedExpenseItem } from '../../lib/shared/queries'
import { useT } from '../../lib/locale-context'
import { fmtMoney } from './money'
import { CAT_FALLBACK } from './ui'

type Props = {
  items: SharedExpenseItem[]
  monthLabel: string
}

const sumBy = (
  items: SharedExpenseItem[],
  currency: BalanceCurrency,
  kind: 'expense' | 'reimbursement',
) => items.filter((i) => i.currencyCode === currency && i.kind === kind).reduce((a, i) => a + i.amount, 0)

const ownNet = (items: SharedExpenseItem[], currency: BalanceCurrency) =>
  items
    .filter((i) => i.currencyCode === currency)
    .reduce((a, i) => a + (i.kind === 'expense' ? i.ownShare : -i.ownShare), 0)

type Cat = { key: string; label: string; amount: number; color: string; pct: number }

function categories(items: SharedExpenseItem[], fallbackLabel: string): Cat[] {
  const byCat = new Map<string, Cat>()
  let total = 0
  for (const i of items) {
    if (i.currencyCode !== 'ARS' || i.kind !== 'expense') continue
    total += i.amount
    const key = i.categoryId ?? '∅'
    const prev = byCat.get(key)
    if (prev) prev.amount += i.amount
    else
      byCat.set(key, {
        key,
        label: i.categoryName ?? fallbackLabel,
        amount: i.amount,
        color: i.categoryColor ?? CAT_FALLBACK[byCat.size % CAT_FALLBACK.length],
        pct: 0,
      })
  }
  const rows = [...byCat.values()].sort((a, b) => b.amount - a.amount)
  for (const r of rows) r.pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
  return rows
}

// The Hogar spending hero: net household spend of the selected month (DEVENGADO)
// as the protagonist, bimoneda (USD subordinate), the user's own net share, and
// the category breakdown (stacked bar + legend). Navigable via the month nav.
// Mirror of web's hero-section. Debt lives in its own DebtSection (today).
export function SharedHero({ items, monthLabel }: Props) {
  const t = useT()

  const d = useMemo(() => {
    const grossARS = sumBy(items, 'ARS', 'expense')
    const reimbARS = sumBy(items, 'ARS', 'reimbursement')
    const grossUSD = sumBy(items, 'USD', 'expense')
    const reimbUSD = sumBy(items, 'USD', 'reimbursement')
    return {
      netARS: grossARS - reimbARS,
      ownNetARS: ownNet(items, 'ARS'),
      netUSD: grossUSD - reimbUSD,
      hasUSD: grossUSD > 0.01 || reimbUSD > 0.01,
      cats: categories(items, t('shared.split.shared_label')),
    }
  }, [items, t])

  return (
    <View className="overflow-hidden rounded-3xl bg-navy p-5">
      <Text className="text-[10px] font-bold uppercase tracking-wider text-navy-muted">
        {t('shared.dashboard.household_spend_net', { month: monthLabel })}
      </Text>
      <Text className="mt-1.5 text-3xl font-extrabold text-white">{fmtMoney(d.netARS, 'ARS')}</Text>
      <Text className="mt-1.5 text-xs font-medium text-navy-muted">
        {t('shared.dashboard.your_net_share', { amount: fmtMoney(d.ownNetARS, 'ARS') })}
      </Text>
      {d.hasUSD && (
        <View className="mt-2 flex-row items-center gap-2">
          <View className="rounded-full bg-white/10 px-2 py-0.5">
            <Text className="text-[10px] font-bold text-white">USD</Text>
          </View>
          <Text className="text-xs font-bold text-white">{fmtMoney(d.netUSD, 'USD')}</Text>
          <Text className="text-[11px] text-navy-muted">{t('shared.dashboard.in_the_month')}</Text>
        </View>
      )}

      {d.cats.length > 0 && (
        <View className="mt-4 border-t border-white/10 pt-4">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-navy-muted">
            {t('shared.dashboard.spent_on')}
          </Text>
          <View className="mt-3 h-2.5 flex-row overflow-hidden rounded-md bg-white/10">
            {d.cats.map((c) => (
              <View key={c.key} style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
            ))}
          </View>
          <View className="mt-3 flex-col gap-1.5">
            {d.cats.map((c) => (
              <View key={c.key} className="flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                <Text className="flex-1 text-[13px] font-bold text-white" numberOfLines={1}>
                  {c.label}
                </Text>
                <Text className="text-[13px] font-extrabold text-white">
                  {fmtMoney(c.amount, 'ARS')}
                </Text>
                <Text className="w-8 text-right text-[11px] font-semibold text-navy-muted">
                  {c.pct}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
