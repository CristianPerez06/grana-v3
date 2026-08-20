import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CreditCard, Receipt } from 'lucide-react-native'
import { deriveCommittedSplit } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { useCommittedOutlook } from '../../lib/dashboard/queries'
import { CommittedGroup } from './CommittedGroup'
import { CommittedRow } from './CommittedRow'
import { CommittedSkeleton } from './CommittedSkeleton'
import { MaskedAmount } from './MaskedAmount'

// Native mirror of the web `committed-section.tsx`: the committed total with its
// Tarjetas / Gastos fijos split and the two details as collapsible groups.
// Cards are grouped BY CARD, not by consumo.

/** Max height of the fixed-expenses list before it scrolls inside its panel. */
const RECURRING_MAX_HEIGHT = 160

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
  const isEmpty = !split.hasBar && !usdSplit.hasBar

  const nextClose = cards.find((card) => card.nextClose != null)?.nextClose ?? null
  const cardsSub =
    nextClose != null
      ? t('dashboard.committed.cards_group_sub_close', {
          count: cards.length,
          date: nextClose.slice(8, 10) + '/' + nextClose.slice(5, 7),
        })
      : t('dashboard.committed.cards_group_sub', { count: cards.length })

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
          </View>

          <View className="mt-3 gap-2.5">
            <CommittedGroup
              icon={<CreditCard size={17} color={colors.slate} />}
              iconBackground="rgba(58,107,138,0.14)"
              label={t('dashboard.committed.cards_group')}
              sub={cardsSub}
              ars={data.ARS.debt}
              usd={data.USD.debt}
            >
              {cards.length === 0 ? (
                <Text className="border-t border-border-soft py-2.5 text-[12px] font-semibold text-text-soft">
                  {t('dashboard.committed.cards_empty')}
                </Text>
              ) : (
                cards.map((card) => (
                  <CommittedRow
                    key={card.id}
                    label={card.label}
                    amount={card.amount}
                    currency="ARS"
                  />
                ))
              )}
            </CommittedGroup>

            <CommittedGroup
              icon={<Receipt size={17} color={colors.plum} />}
              iconBackground="rgba(138,110,152,0.14)"
              label={t('dashboard.committed.recurring_group')}
              sub={t('dashboard.committed.recurring_group_sub', { count: recurring.length })}
              ars={data.ARS.recurringExpense}
              usd={data.USD.recurringExpense}
            >
              {recurring.length === 0 ? (
                <Text className="border-t border-border-soft py-2.5 text-[12px] font-semibold text-text-soft">
                  {t('dashboard.committed.recurring_empty')}
                </Text>
              ) : (
                <>
                  {/* Only this list scrolls — never the whole card. */}
                  <ScrollView style={{ maxHeight: RECURRING_MAX_HEIGHT }} nestedScrollEnabled>
                    {recurring.map((item, index) => (
                      <CommittedRow
                        key={`${item.description}-${index}`}
                        label={item.description}
                        amount={item.amount}
                        currency="ARS"
                      />
                    ))}
                  </ScrollView>
                  <Pressable
                    onPress={() => router.push('/transactions/recurring')}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={{ minHeight: 44 }}
                    className="justify-center"
                  >
                    <Text className="text-[12px] font-bold text-positive">
                      {t('dashboard.committed.view_fixed')} ›
                    </Text>
                  </Pressable>
                </>
              )}
            </CommittedGroup>
          </View>
        </>
      )}
    </View>
  )
}
