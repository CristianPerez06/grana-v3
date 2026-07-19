import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Play, Trash2 } from 'lucide-react-native'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { SkeletonBlock } from '../../../../components/ui/SkeletonBlock'
import { RecurrenceInstancesList } from '../../../../components/recurrences/RecurrenceInstancesList'
import {
  amountSign,
  amountToneClass,
  categoryName,
  frequencyLabel,
  movementLabel,
} from '../../../../components/recurrences/format'
import { fmtMoney, formatShortDate } from '../../../../components/transactions/detail/format'
import { getRecurrenceDetail } from '../../../../lib/recurrences/queries'
import {
  deleteRecurrence,
  pauseRecurrence,
  resumeRecurrence,
} from '../../../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceMutation } from '../../../../lib/recurrences/invalidate'
import { colors } from '../../../../lib/colors'
import { useLocale, useT } from '../../../../lib/locale-context'
import { useShowCents } from '../../../../lib/preferences-context'

// Metadata row inside the summary card.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-[13px] font-medium text-text-muted">{label}</Text>
      <Text className="max-w-[62%] text-right text-[14px] font-semibold text-text">{value}</Text>
    </View>
  )
}

/**
 * Recurrence rule detail. Read-only summary + generated-instance history, with
 * pause/resume and delete in the header (button-mutations — no form). Editing the
 * rule's fields and creating a rule from scratch are a later slice; this screen
 * never opens an edit form.
 */
export default function RecurrenceDetailScreen() {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()

  const query = useQuery({
    queryKey: ['recurrences', 'detail', id] as const,
    queryFn: () => getRecurrenceDetail(id),
  })

  const rule = query.data ?? null
  const notFound = query.isError || (query.isSuccess && rule === null)

  const onBack = () =>
    router.canGoBack() ? router.back() : router.push('/transactions/recurring')

  const togglePause = async () => {
    if (!rule) return
    const result =
      rule.status === 'active'
        ? await pauseRecurrence(rule.id, t)
        : await resumeRecurrence(rule.id, t)
    if (result.ok) {
      invalidateAfterRecurrenceMutation(queryClient)
    } else {
      Alert.alert(result.formError)
    }
  }

  const confirmDelete = () => {
    if (!rule) return
    Alert.alert(t('recurrences.actions.delete'), t('recurrences.confirmations.delete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('recurrences.actions.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteRecurrence(rule.id, t)
          if (result.ok) {
            invalidateAfterRecurrenceMutation(queryClient)
            onBack()
          } else {
            Alert.alert(result.formError)
          }
        },
      },
    ])
  }

  const actions = rule ? (
    <View className="flex-row items-center gap-1">
      <Pressable
        onPress={confirmDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('recurrences.actions.delete')}
        className="h-9 w-9 items-center justify-center rounded-lg"
      >
        <Trash2 size={20} color={colors.white} />
      </Pressable>
      <Pressable
        onPress={togglePause}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          rule.status === 'active' ? t('recurrences.actions.pause') : t('recurrences.actions.resume')
        }
        className="h-9 w-9 items-center justify-center rounded-lg"
      >
        {rule.status === 'active' ? (
          <Pause size={20} color={colors.white} />
        ) : (
          <Play size={20} color={colors.white} />
        )}
      </Pressable>
    </View>
  ) : undefined

  const accountValue = rule
    ? rule.movement_type === 'transfer'
      ? `${rule.account?.name ?? '—'} → ${rule.destination_account?.name ?? '—'}`
      : (rule.account?.name ?? '—')
    : '—'

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('recurrences.title')}
        backLink={{ href: '/transactions/recurring', label: t('recurrences.back_label') }}
        onBackPress={onBack}
        actions={actions}
      />
      <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-16">
        {query.isPending ? (
          <>
            <SkeletonBlock className="h-28 w-full rounded-2xl" />
            <SkeletonBlock className="h-40 w-full rounded-2xl" />
          </>
        ) : notFound || !rule ? (
          <View className="rounded-2xl border border-border-soft bg-card p-8">
            <Text className="text-center text-base font-bold text-text">
              {t('notFound.transactions.title')}
            </Text>
            <Text className="mt-1.5 text-center text-sm text-text-muted">
              {t('notFound.transactions.description')}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary — amount protagonist + metadata rows. */}
            <View className="rounded-2xl border border-border bg-card p-5">
              <Text className={`text-[30px] font-extrabold ${amountToneClass(rule.movement_type)}`}>
                {amountSign(rule.movement_type)}
                {fmtMoney(Number(rule.amount), rule.currency_code, showCents)}
              </Text>
              <Text className="mt-0.5 text-[13px] font-semibold text-text-muted">
                {movementLabel(rule.movement_type, t)} · {frequencyLabel(rule.frequency, t)}
              </Text>

              <View className="mt-3 border-t border-border-soft">
                <Row label={t('recurrences.labels.frequency')} value={frequencyLabel(rule.frequency, t)} />
                <Row
                  label={
                    rule.movement_type === 'transfer'
                      ? t('recurrences.labels.destination')
                      : t('recurrences.labels.account')
                  }
                  value={accountValue}
                />
                {rule.movement_type !== 'transfer' && categoryName(rule.category, t) ? (
                  <Row
                    label={t('recurrences.labels.category')}
                    value={categoryName(rule.category, t) as string}
                  />
                ) : null}
                {rule.next_occurrence ? (
                  <Row
                    label={t('recurrences.labels.next_date')}
                    value={formatShortDate(rule.next_occurrence, locale)}
                  />
                ) : null}
                {rule.end_date ? (
                  <Row
                    label={t('recurrences.labels.end_date')}
                    value={formatShortDate(rule.end_date, locale)}
                  />
                ) : null}
                {rule.description ? (
                  <Row label={t('recurrences.labels.description')} value={rule.description} />
                ) : null}
              </View>
            </View>

            <RecurrenceInstancesList instances={rule.instances} />
          </>
        )}
      </ScrollView>
    </View>
  )
}
