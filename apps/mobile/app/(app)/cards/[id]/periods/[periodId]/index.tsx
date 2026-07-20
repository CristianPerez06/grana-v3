import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { FinancialMovement } from '@grana/transactions'
import { cardPeriodTransactionToMovement, installmentChip } from '@grana/cards'
import { getCardPeriodDetail } from '../../../../../../lib/cards/queries'
import { getTodayAR, formatDateISO } from '../../../../../../lib/date'
import { useShowCents } from '../../../../../../lib/preferences-context'
import { useT } from '../../../../../../lib/locale-context'
import { PageHeader } from '../../../../../../components/ui/PageHeader'
import { Spinner } from '../../../../../../components/ui/Spinner'
import { MovementList } from '../../../../../../components/movements/MovementList'
import { PeriodStatusPill } from '../../../../../../components/cards/PeriodStatusPill'
import { EditDatesSheet } from '../../../../../../components/cards/EditDatesSheet'

const fmt = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/**
 * Statement (period) detail — thin consumer of `getCardPeriodDetail`. Shows the
 * header (range, due, Editar fechas when unpaid), the amount summary, the period's
 * movements (grouped, navigable) and a Pay CTA for a closed/overdue unpaid
 * statement. Editing dates opens a native sheet over `updatePeriodDates`.
 */
export default function StatementDetailScreen() {
  const t = useT()
  const router = useRouter()
  const showCents = useShowCents()
  const { id, periodId } = useLocalSearchParams<{ id: string; periodId: string }>()
  const [editOpen, setEditOpen] = useState(false)

  const query = useQuery({
    queryKey: ['cards', 'period', periodId] as const,
    queryFn: () => getCardPeriodDetail(periodId),
  })

  const period = query.data ?? null
  const todayISO = formatDateISO(getTodayAR())

  const canPay =
    !!period &&
    !period.has_payment &&
    (period.variant === 'cerrado_esperando_pago' || period.variant === 'vencido')
  const canEditDates = !!period && !period.has_payment

  const goPay = () =>
    router.push({
      pathname: '/(app)/cards/[id]/periods/[periodId]/pay',
      params: { id, periodId },
    })
  const goMovement = (movement: FinancialMovement) =>
    router.push({ pathname: '/(app)/transactions/[txId]', params: { txId: movement.id } })

  const movements = period ? period.transactions.map(cardPeriodTransactionToMovement) : []
  const chips = new Map<string, string>()
  if (period) {
    for (const tx of period.transactions) {
      const chip = installmentChip(tx, (n, total) =>
        t('cards.detail.installment_chip', { n, total }),
      )
      if (chip) chips.set(tx.id, chip)
    }
  }

  const totalARS = period ? (period.has_payment ? period.paidAmountARS : period.pendingAmountARS) : 0
  const totalUSD = period ? (period.has_payment ? period.paidAmountUSD : period.pendingAmountUSD) : 0

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('cards.period.detail_title')}
        backLink={{ href: '/(app)/cards/[id]', label: t('cards.back_label') }}
        onBackPress={() => router.back()}
        actions={
          canEditDates ? (
            <Pressable onPress={() => setEditOpen(true)} hitSlop={8} accessibilityRole="button">
              <Text className="text-sm font-semibold text-white">
                {t('cards.actions.edit_dates')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        {query.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : !period ? (
          <View className="rounded-2xl border border-border-soft bg-card p-8">
            <Text className="text-center text-base font-bold text-text">
              {t('notFound.cards.title')}
            </Text>
          </View>
        ) : (
          <>
            {/* Header: range + status + due */}
            <View className="flex-col gap-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-semibold text-text">
                  {fmt(period.start_date)} – {fmt(period.end_date)}
                </Text>
                <PeriodStatusPill variant={period.variant} />
                {period.is_estimated && (
                  <Text className="text-[11px] text-text-soft">
                    {t('cards.period.estimated_badge')}
                  </Text>
                )}
              </View>
              <Text className="text-sm text-text-muted">
                {t('cards.period.due_prefix')} {fmt(period.due_date)}
              </Text>
            </View>

            {/* Amount summary */}
            <View className="flex-col gap-1 rounded-2xl border border-border bg-card p-4">
              <Text className="text-3xl font-extrabold tracking-tight text-text">
                {formatARS(totalARS, showCents)}
              </Text>
              {totalUSD > 0 && (
                <Text className="text-sm text-text-muted">{formatUSD(totalUSD, showCents)} USD</Text>
              )}
              {period.has_payment && period.paymentDate && (
                <Text className="mt-1 text-xs text-emerald-deep">
                  {t('cards.period.paid_on_prefix')} {fmt(period.paymentDate)}
                </Text>
              )}
            </View>

            {canPay && (
              <Pressable
                onPress={goPay}
                accessibilityRole="button"
                className={`w-full items-center justify-center rounded-xl py-3 ${
                  period.variant === 'vencido' ? 'bg-terracotta' : 'bg-emerald'
                }`}
              >
                <Text className="text-base font-semibold text-white">
                  {t('cards.actions.pay_statement')}
                </Text>
              </Pressable>
            )}

            {/* Movements */}
            <View className="flex-col gap-3">
              <Text className="text-sm font-bold uppercase tracking-wide text-text-muted">
                {t('cards.labels.movements_with_count', { count: movements.length })}
              </Text>
              {movements.length === 0 ? (
                <Text className="py-6 text-center text-sm text-text-muted">
                  {t('cards.period.empty_movements_period')}
                </Text>
              ) : (
                <View className="overflow-hidden rounded-2xl border border-border bg-card">
                  <MovementList
                    movements={movements}
                    perspective={{ kind: 'account', accountId: id }}
                    todayISO={todayISO}
                    installmentChips={chips}
                    groupByDate
                    onPressMovement={goMovement}
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {period && canEditDates && (
        <EditDatesSheet
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          periodId={period.id}
          currentEndDate={period.end_date}
          currentDueDate={period.due_date}
          nextPeriodStart={period.nextPeriodStart}
          nextPeriodIsPaid={period.nextPeriodIsPaid}
        />
      )}
    </View>
  )
}
