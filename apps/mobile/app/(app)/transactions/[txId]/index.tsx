import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react-native'
import type { MovementKind } from '@grana/money-logic'
import type { SeededRecurrenceInfo } from '@grana/transactions-mutations'
import type { SeededRecurrenceResolution } from '@grana/recurrences'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { MovementDetailView } from '../../../../components/transactions/detail/MovementDetailView'
import { MovementDetailSkeleton } from '../../../../components/transactions/detail/MovementDetailSkeleton'
import { getMovementDetail } from '../../../../lib/transactions/queries'
import {
  deleteMovement,
  resolveSeededRecurrenceAndDelete,
} from '../../../../lib/transactions/mutators'
import { invalidateAfterMovementMutation } from '../../../../lib/transactions/invalidate'
import { invalidateAfterRecurrenceMutation } from '../../../../lib/recurrences/invalidate'
import { colors } from '../../../../lib/colors'
import { useT } from '../../../../lib/locale-context'

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
 * Native movement detail. Thin consumer of `getMovementDetail` (extracted
 * transaction-graph reads + the shared-info mirror). Renders the tone hero +
 * core tiles via `MovementDetailView`, plus the edit/delete affordances gated by
 * `canManage`/`canEdit`/`canDelete` (mirror of web's detail). The topbar
 * (PageHeader) is mounted from the first paint; the loading skeleton sits below
 * it, never covering the back affordance or the actions.
 */
export default function MovementDetailScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { txId, from } = useLocalSearchParams<{ txId: string; from?: string }>()
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''

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

  // Edit/delete gating — mirror of web's `global-transaction-detail.tsx`. Only
  // the owner (payer) manages; a paid consumption and an installment child are
  // locked; delete additionally excludes any parent (madre).
  const tx = data?.transaction ?? null
  const actionAccountId = tx
    ? (tx.account_id ?? data?.installmentSiblings?.[0]?.account_id ?? null)
    : null
  const isInstallmentChild = tx ? !tx.is_parent && tx.parent_id != null : false
  // A `paid` card consumption stays EDITABLE (category/description; the amount
  // and date are locked by `getEditableFields` and rejected by the mutator).
  // Deleting it stays blocked. Mirror of web's detail.
  const canEdit = !!data?.canManage && actionAccountId != null && !isInstallmentChild
  const canDelete =
    !!data?.canManage && actionAccountId != null && !tx?.parent_id && tx?.status !== 'paid'

  const onEdit = () => router.push(`/transactions/${txId}/edit${fromQuery}`)

  const confirmDelete = () => {
    if (!data) return
    const warning =
      data.movement.kind === 'card_payment'
        ? t('transactions.detail.actions.delete_warning_card_payment')
        : data.transaction.is_parent
          ? t('transactions.detail.actions.delete_warning_parent')
          : t('transactions.detail.actions.delete_warning_default')
    Alert.alert(t('transactions.detail.actions.delete'), warning, [
      { text: t('transactions.detail.actions.cancel'), style: 'cancel' },
      {
        text: t('transactions.detail.actions.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteMovement(txId, t)
          if (result.ok) {
            finishDeleted()
          } else if ('seededRecurrence' in result) {
            askSeededRecurrence(result.seededRecurrence)
          } else {
            Alert.alert(result.formError)
          }
        },
      },
    ])
  }

  const finishDeleted = () => {
    invalidateAfterMovementMutation(queryClient)
    invalidateAfterRecurrenceMutation(queryClient)
    router.push('/transactions')
  }

  // The movement created a recurrence rule, so the DB refuses to delete it until
  // the rule is resolved (FK RESTRICT). Same two choices as web, asked with the
  // native Alert instead of a dialog.
  const askSeededRecurrence = (rule: SeededRecurrenceInfo) => {
    const body = rule.description
      ? t('transactions.seeded_recurrence.body', { rule: rule.description })
      : t('transactions.seeded_recurrence.body_untitled')

    const resolve = async (resolution: SeededRecurrenceResolution) => {
      const result = await resolveSeededRecurrenceAndDelete(txId, rule.id, resolution, t)
      if (result.ok) finishDeleted()
      else Alert.alert(result.formError)
    }

    Alert.alert(t('transactions.seeded_recurrence.title'), body, [
      { text: t('transactions.seeded_recurrence.cancel'), style: 'cancel' },
      {
        text: t('transactions.seeded_recurrence.unlink'),
        onPress: () => void resolve('unlink'),
      },
      {
        text: t('transactions.seeded_recurrence.delete_rule'),
        style: 'destructive',
        onPress: () => void resolve('delete_rule'),
      },
    ])
  }

  const title = data ? t(TITLE_KEY[data.movement.kind]) : '—'

  const actions =
    canEdit || canDelete ? (
      <View className="flex-row items-center gap-1">
        {canDelete && (
          <Pressable
            onPress={confirmDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.detail.actions.delete')}
            className="h-9 w-9 items-center justify-center rounded-lg"
          >
            <Trash2 size={20} color={colors.white} />
          </Pressable>
        )}
        {canEdit && (
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('transactions.detail.actions.edit')}
            className="h-9 w-9 items-center justify-center rounded-lg"
          >
            <Pencil size={20} color={colors.white} />
          </Pressable>
        )}
      </View>
    ) : undefined

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={title}
        backLink={{ href: '/transactions', label: t('common.back') }}
        onBackPress={onBack}
        actions={actions}
      />
      <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-16">
        {query.isPending ? (
          <MovementDetailSkeleton />
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
