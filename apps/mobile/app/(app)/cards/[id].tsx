import { ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { resolveCardDetailState } from '@grana/cards'
import { getTodayAR, formatDateISO } from '../../../lib/date'
import {
  getActiveInstallments,
  getCardPeriods,
  getCreditCardDetail,
} from '../../../lib/cards/queries'
import { useT } from '../../../lib/locale-context'
import { Spinner } from '../../../components/ui/Spinner'
import { CardDetailHeader } from '../../../components/cards/detail/CardDetailHeader'
import { CardDetailView } from '../../../components/cards/detail/CardDetailView'

/**
 * Native card detail (read-only v1). Fetches the three shared reads and derives
 * the whole screen with `resolveCardDetailState` from `@grana/cards` — the same
 * builder the web route uses — then renders one of its four branches. No writes:
 * no pay, no edit, no register-purchase. The per-period movements pane and the
 * nested routes (/periods, statement detail) are deferred to follow-up changes.
 */
export default function CardDetailScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()

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

  const state =
    query.data && cardDetail && isCredit
      ? resolveCardDetailState({
          cardDetail,
          periods: query.data.periods,
          installments: query.data.installments,
          todayISO: formatDateISO(getTodayAR()),
        })
      : null

  // Header chrome is always mounted (first paint). Name/bank come from the detail
  // row; the pill tone comes from the resolved state (only `active` carries one).
  const headerName = cardDetail?.name ?? null
  const bank = state && state.kind !== 'not-found' ? state.shared.institutionName : null
  const tone = state && state.kind !== 'not-found' ? state.shared.headerTone : null

  const notFound = query.isError || (!!query.data && (!cardDetail || !isCredit || state?.kind === 'not-found'))

  return (
    <View className="flex-1 bg-page">
      <CardDetailHeader name={headerName} bank={bank} tone={tone} />
      <ScrollView contentContainerClassName="gap-5 px-6 py-6">
        {query.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : notFound || !state || state.kind === 'not-found' ? (
          <EmptyInfo title={t('notFound.cards.title')} body={t('notFound.cards.description')} />
        ) : state.kind === 'new-card' ? (
          <EmptyInfo title={t('cards.detail.ready_title')} body={t('cards.detail.ready_description')} />
        ) : state.kind === 'archived-empty' ? (
          <EmptyInfo title={t('cards.detail.archived_no_pending')} />
        ) : (
          <CardDetailView vm={state.vm} />
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
