import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AlertTriangle, CreditCard, Receipt } from 'lucide-react-native'
import { deriveCommittedSplit } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { useCommittedOutlook } from '../../lib/dashboard/queries'
import { CommittedDetail, type CommittedDetailGroup } from './CommittedDetail'
import { CommittedSkeleton } from './CommittedSkeleton'
import { MaskedAmount } from './MaskedAmount'

// Native mirror of the web `committed-section.tsx`: the committed total with its
// Tarjetas / Gastos fijos split and the two details in a zone that REPLACES
// rather than unfolds (see `CommittedDetail`). Cards are grouped BY CARD, not by
// consumo.
//
// Overdue money is a ONE-LINE footnote under the bar: it belongs next to the
// total it explicitly is not part of, and three lines for a one-line fact push
// the whole card down.

const monthLabel = (locale: string): string => {
  const today = new Date()
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const label = next.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const CommittedSection = () => {
  const t = useT()
  const router = useRouter()
  const query = useCommittedOutlook()
  const data = query.data

  if (!data) {
    return query.isError ? (
      <View className="rounded-2xl border border-border bg-card p-4">
        <Text className="text-center text-[12.5px] font-semibold text-text-soft">
          {t('dashboard.committed.error')}
        </Text>
      </View>
    ) : (
      <CommittedSkeleton />
    )
  }

  const split = deriveCommittedSplit(data.ARS.debt, data.ARS.recurringExpense)
  const usdSplit = deriveCommittedSplit(data.USD.debt, data.USD.recurringExpense)
  const cards = data.ARS.cards
  const recurring = data.ARS.topRecurring
  const hasOverdue = data.ARS.overdue !== 0 || data.USD.overdue !== 0
  // Overdue money alone is enough to have something to say: the empty state
  // means "nothing to pay", and a late statement is very much something to pay.
  const isEmpty = !split.hasBar && !usdSplit.hasBar && !hasOverdue

  const nextClose = cards.find((card) => card.nextClose != null)?.nextClose ?? null
  const cardsSub =
    nextClose != null
      ? t('dashboard.committed.cards_group_sub_close', {
          count: cards.length,
          date: nextClose.slice(8, 10) + '/' + nextClose.slice(5, 7),
        })
      : t('dashboard.committed.cards_group_sub', { count: cards.length })

  const groups: CommittedDetailGroup[] = [
    {
      key: 'cards',
      icon: <CreditCard size={17} color={colors.slate} />,
      iconBackground: 'rgba(58,107,138,0.14)',
      label: t('dashboard.committed.cards_group'),
      sub: cardsSub,
      ars: data.ARS.debt,
      usd: data.USD.debt,
      rows: cards.map((card) => ({ id: card.id, label: card.label, amount: card.amount })),
      emptyMessage: t('dashboard.committed.cards_empty'),
    },
    {
      key: 'recurring',
      icon: <Receipt size={17} color={colors.plum} />,
      iconBackground: 'rgba(138,110,152,0.14)',
      label: t('dashboard.committed.recurring_group'),
      sub: t('dashboard.committed.recurring_group_sub', { count: recurring.length }),
      ars: data.ARS.recurringExpense,
      usd: data.USD.recurringExpense,
      rows: recurring.map((item, index) => ({
        id: `${item.description}-${index}`,
        label: item.description,
        amount: item.amount,
      })),
      emptyMessage: t('dashboard.committed.recurring_empty'),
      link: { href: '/transactions/recurring', label: t('dashboard.committed.view_fixed') },
    },
  ]

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-extrabold text-text">
            {t('dashboard.committed.title_next_month')}
          </Text>
          <Text className="text-[11.5px] font-semibold text-text-soft">{monthLabel('es-AR')}</Text>
        </View>
        <Pressable onPress={() => router.push('/cards')} accessibilityRole="button" hitSlop={12}>
          <Text className="text-[12.5px] font-bold text-positive">
            {t('dashboard.committed.view_all')} ›
          </Text>
        </Pressable>
      </View>

      {isEmpty ? (
        <Text className="py-6 text-center text-[12.5px] font-semibold text-text-soft">
          {t('dashboard.committed.empty')}
        </Text>
      ) : (
        <>
          {/* Total + stacked bar */}
          <View className="mt-3 rounded-2xl border border-border bg-page p-3.5">
            <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
              {t('dashboard.committed.committed_label')}
            </Text>
            <MaskedAmount
              amount={split.total}
              currency="ARS"
              className="mt-1 text-[28px] font-extrabold text-text"
            />
            {usdSplit.total !== 0 && (
              <MaskedAmount
                amount={usdSplit.total}
                currency="USD"
                showCentsOverride
                className="mt-1 text-[11.5px] font-semibold text-text-soft"
              />
            )}

            {split.hasBar && (
              <>
                <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-border-soft">
                  <View
                    style={{ width: `${split.cardsPct}%`, backgroundColor: colors.slate }}
                    className="h-full"
                  />
                  <View
                    style={{ width: `${split.recurringPct}%`, backgroundColor: colors.plum }}
                    className="h-full"
                  />
                </View>
                <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                  <View className="flex-row items-center gap-1.5">
                    <View
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: colors.slate }}
                    />
                    <Text className="text-[11px] font-bold text-text-muted">
                      {t('dashboard.committed.cards_group')} {Math.round(split.cardsPct)}%
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: colors.plum }}
                    />
                    <Text className="text-[11px] font-bold text-text-muted">
                      {t('dashboard.committed.recurring_group')} {Math.round(split.recurringPct)}%
                    </Text>
                  </View>
                </View>
              </>
            )}

            {hasOverdue && (
              <View className="mt-2.5 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <AlertTriangle size={13} color={colors.terracotta} />
                <Text
                  className="text-[11.5px] font-bold"
                  style={{ color: colors.terracotta }}
                >
                  {t('dashboard.committed.overdue_prefix')}
                </Text>
                <MaskedAmount
                  amount={data.ARS.overdue}
                  currency="ARS"
                  className="text-[11.5px] font-extrabold"
                  style={{ color: colors.terracotta }}
                />
                {data.USD.overdue !== 0 && (
                  <MaskedAmount
                    amount={data.USD.overdue}
                    currency="USD"
                    showCentsOverride
                    className="text-[11.5px] font-extrabold"
                    style={{ color: colors.terracotta }}
                  />
                )}
                <Text
                  className="text-[11.5px] font-bold"
                  style={{ color: colors.terracotta }}
                >
                  {t('dashboard.committed.overdue_suffix')}
                </Text>
              </View>
            )}
          </View>

          <View className="mt-3">
            <CommittedDetail groups={groups} />
          </View>
        </>
      )}
    </View>
  )
}
