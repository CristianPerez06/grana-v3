import { ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import type { MovementKind } from '@grana/money-logic'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Spinner } from '../../../components/ui/Spinner'
import { MovementDetailView } from '../../../components/transactions/detail/MovementDetailView'
import { getMovementDetail } from '../../../lib/transactions/queries'
import { useT } from '../../../lib/locale-context'

// Section title (navy header) per kind. The hero carries the specific title, so
// the header stays a stable, generic type label — no duplication, visible from
// the first paint (placeholder while the read resolves).
const TITLE_KEY: Record<MovementKind, string> = {
  income: 'transactions.types.income',
  expense: 'transactions.types.expense',
  transfer: 'transactions.types.transfer',
  adjustment: 'transactions.types.adjustment',
  exchange: 'transactions.types.exchange',
  card_payment: 'transactions.card_payment_label',
  installment_purchase: 'transactions.installment_purchase_label',
  reimbursement: 'transactions.reimbursement.label',
}

/**
 * Native movement detail (read-only). Thin consumer of `getMovementDetail`
 * (extracted transaction-graph reads + the shared-info mirror). Renders the tone
 * hero + core tiles via `MovementDetailView`. Edit/delete land in a follow-up.
 * The topbar (PageHeader) is mounted from the first paint; the loading skeleton
 * sits below it, never covering the back affordance.
 */
export default function MovementDetailScreen() {
  const t = useT()
  const router = useRouter()
  const { txId, from } = useLocalSearchParams<{ txId: string; from?: string }>()

  const query = useQuery({
    queryKey: ['transactions', 'detail', txId] as const,
    queryFn: () => getMovementDetail(txId),
  })

  const data = query.data ?? null
  const notFound = query.isError || (query.isSuccess && data === null)

  // Back resolves the origin (`?from=account:<id>` / `card:<id>`); otherwise it
  // pops the stack (feed → detail, or detail → linked detail), falling back to
  // the feed on a cold deep-link with no history.
  const onBack = () => {
    if (from?.startsWith('account:')) {
      router.push(`/accounts/${from.slice('account:'.length)}`)
      return
    }
    if (from?.startsWith('card:')) {
      router.push(`/cards/${from.slice('card:'.length)}`)
      return
    }
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.push('/transactions')
  }

  const title = data ? t(TITLE_KEY[data.movement.kind]) : '—'

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={title}
        backLink={{ href: '/transactions', label: t('common.back') }}
        onBackPress={onBack}
      />
      <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-16">
        {query.isPending ? (
          <View className="items-center py-16">
            <Spinner size="md" />
          </View>
        ) : notFound || !data ? (
          <View className="rounded-2xl border border-border-soft bg-card p-8">
            <Text className="text-center text-base font-bold text-text">
              {t('notFound.transactions.title')}
            </Text>
            <Text className="mt-1.5 text-center text-sm text-text-muted">
              {t('notFound.transactions.description')}
            </Text>
          </View>
        ) : (
          <MovementDetailView data={data} />
        )}
      </ScrollView>
    </View>
  )
}
