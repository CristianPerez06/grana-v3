import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FinancialMovement } from '@grana/transactions'
import { resolveCardDetailState } from '@grana/cards'
import { getTodayAR, formatDateISO } from '../../../../lib/date'
import {
  getActiveInstallments,
  getCardPeriods,
  getCreditCardDetail,
} from '../../../../lib/cards/queries'
import { reactivateCard } from '../../../../lib/cards/mutations'
import { useT } from '../../../../lib/locale-context'
import { Button } from '../../../../components/ui/Button'
import { CardDetailHeader } from '../../../../components/cards/detail/CardDetailHeader'
import { CardDetailView } from '../../../../components/cards/detail/CardDetailView'
import { CardDetailSkeleton } from '../../../../components/cards/detail/CardDetailSkeleton'

/**
 * Native card detail — the write hub. Fetches the three shared reads and derives
 * the whole screen with `resolveCardDetailState` from `@grana/cards` (the same
 * builder the web route uses), then renders one of its four branches. Beyond the
 * read overview it exposes the write entry points: Editar in the header, the Pay
 * CTA on the "a pagar" hero, the periods list, navigable movement rows, the
 * register-first-purchase CTA (new-card) and reactivate (archived-empty).
 */
export default function CardDetailScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [reactivating, setReactivating] = useState(false)

  const query = useQuery({
    queryKey: ['cards', 'detail', id] as const,
    queryFn: async () => {
      const [cardDetail, periods, installments] = await Promise.all([
        getCreditCardDetail(id),
        getCardPeriods(id),
        getActiveInstallments(id),
      ])
      return { cardDetail, periods, installments }
    },
  })

  const cardDetail = query.data?.cardDetail ?? null
  const isCredit = cardDetail?.type === 'credit'
  const todayISO = formatDateISO(getTodayAR())

  const state =
    query.data && cardDetail && isCredit
      ? resolveCardDetailState({
          cardDetail,
          periods: query.data.periods,
          installments: query.data.installments,
          todayISO,
        })
      : null

  const headerName = cardDetail?.name ?? null
  const bank = state && state.kind !== 'not-found' ? state.shared.institutionName : null
  const tone = state && state.kind !== 'not-found' ? state.shared.headerTone : null

  const notFound =
    query.isError ||
    (!!query.data && (!cardDetail || !isCredit || state?.kind === 'not-found'))
  const canEdit = !!state && state.kind !== 'not-found'

  const goEdit = () => router.push({ pathname: '/(app)/cards/[id]/edit', params: { id } })
  const goPeriods = () => router.push({ pathname: '/(app)/cards/[id]/periods', params: { id } })
  const goPay = (periodId: string) =>
    router.push({
      pathname: '/(app)/cards/[id]/periods/[periodId]/pay',
      params: { id, periodId },
    })
  const goMovement = (movement: FinancialMovement) =>
    router.push({ pathname: '/(app)/transactions/[txId]', params: { txId: movement.id } })
  const registerFirstPurchase = () =>
    router.push({ pathname: '/(app)/transactions/new', params: { presetAccount: id } })

  const handleReactivate = async () => {
    setReactivating(true)
    const result = await reactivateCard(queryClient, id)
    setReactivating(false)
    if (!result.ok) Alert.alert(t(result.errorKey))
  }

  return (
    <View className="flex-1 bg-page">
      <CardDetailHeader
        name={headerName}
        bank={bank}
        tone={tone}
        onEdit={canEdit ? goEdit : undefined}
      />
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        {query.isPending ? (
          <CardDetailSkeleton />
        ) : notFound || !state || state.kind === 'not-found' ? (
          <EmptyInfo title={t('notFound.cards.title')} body={t('notFound.cards.description')} />
        ) : state.kind === 'new-card' ? (
          <View className="flex-col gap-5">
            <EmptyInfo
              title={t('cards.detail.ready_title')}
              body={t('cards.detail.ready_description')}
            />
            <Button onPress={registerFirstPurchase}>
              {t('cards.actions.register_first_purchase')}
            </Button>
          </View>
        ) : state.kind === 'archived-empty' ? (
          <View className="flex-col gap-5">
            <EmptyInfo title={t('cards.detail.archived_no_pending')} />
            <Button onPress={handleReactivate} loading={reactivating} variant="secondary">
              {t('cards.actions.reactivate')}
            </Button>
          </View>
        ) : (
          <CardDetailView
            vm={state.vm}
            todayISO={todayISO}
            onPayApagar={state.vm.apagar ? () => goPay(state.vm.apagar!.id) : undefined}
            onOpenPeriods={goPeriods}
            onPressMovement={goMovement}
          />
        )}
      </ScrollView>
    </View>
  )
}

const EmptyInfo = ({ title, body }: { title: string; body?: string }) => (
  <View className="rounded-2xl border border-border-soft bg-card p-8">
    <Text className="text-center text-base font-bold text-text">{title}</Text>
    {body && <Text className="mt-1.5 text-center text-sm text-text-muted">{body}</Text>}
  </View>
)
