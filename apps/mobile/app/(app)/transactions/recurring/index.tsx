import { useCallback, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import type { RecurrenceSummary } from '@grana/recurrences'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { Segmented } from '../../../../components/ui/Segmented'
import { SkeletonBlock } from '../../../../components/ui/SkeletonBlock'
import { RecurrenceRuleCard } from '../../../../components/recurrences/RecurrenceRuleCard'
import { getRecurrencesList } from '../../../../lib/recurrences/queries'
import { generateDueInstances } from '../../../../lib/recurrences/mutators'
import { useT } from '../../../../lib/locale-context'

type Tab = 'active' | 'paused' | 'finished'

// A rule is "finished" when it has a past end_date, regardless of its DB status
// (active/paused) — the same partition web's recurring page uses. Otherwise it
// falls into its status bucket.
const isFinished = (rule: RecurrenceSummary, today: string): boolean =>
  !!rule.end_date && rule.end_date < today

/**
 * Recurrences hub. Thin consumer of `@grana/recurrences`: lists the user's rules
 * partitioned into active / paused / finished tabs, and lazily materializes due
 * instances on focus (fire-and-forget; the read never blocks on it). Rules are
 * created from the movement form's "repetir" toggle — this screen manages them.
 * Creating a rule from scratch is a later slice.
 */
export default function RecurringHubScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('active')

  const query = useQuery({
    queryKey: ['recurrences', 'list'] as const,
    queryFn: getRecurrencesList,
  })

  // Lazy materialization on focus: fire-and-forget, refresh only when something
  // was created. Idempotent (one pending per rule), so re-focus is safe.
  useFocusEffect(
    useCallback(() => {
      let active = true
      generateDueInstances()
        .then(({ created }) => {
          if (active && created > 0) {
            void queryClient.invalidateQueries({ queryKey: ['recurrences'] })
          }
        })
        .catch(() => {})
      return () => {
        active = false
      }
    }, [queryClient]),
  )

  const today = formatDateISO(getTodayAR())
  const rules = query.data ?? []
  const active = rules.filter((r) => r.status === 'active' && !isFinished(r, today))
  const paused = rules.filter((r) => r.status === 'paused' && !isFinished(r, today))
  const finished = rules.filter((r) => isFinished(r, today))
  const buckets: Record<Tab, RecurrenceSummary[]> = { active, paused, finished }

  const options = [
    { value: 'active', label: `${t('recurrences.statuses.active')} (${active.length})` },
    { value: 'paused', label: `${t('recurrences.statuses.paused')} (${paused.length})` },
    { value: 'finished', label: `${t('recurrences.statuses.finished')} (${finished.length})` },
  ]

  const shown = buckets[tab]
  const emptyKey =
    tab === 'active'
      ? 'recurrences.empty_active'
      : tab === 'paused'
        ? 'recurrences.empty_paused'
        : 'recurrences.empty_finished'

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('recurrences.title')}
        backLink={{ href: '/transactions', label: t('recurrences.back_label') }}
        onBackPress={() => (router.canGoBack() ? router.back() : router.push('/transactions'))}
      />
      <ScrollView contentContainerClassName="gap-4 px-6 py-6 pb-16">
        <Segmented
          value={tab}
          options={options}
          onValueChange={(v) => setTab(v as Tab)}
          ariaLabel={t('recurrences.title')}
        />

        {query.isPending ? (
          <View className="gap-2 rounded-2xl border border-border bg-card p-3">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </View>
        ) : query.isError ? (
          <View className="rounded-[20px] border border-dashed border-border p-8">
            <Text className="text-center text-sm text-text-muted">
              {t('recurrences.errors.generic')}
            </Text>
          </View>
        ) : shown.length === 0 ? (
          <View className="rounded-[20px] border border-dashed border-border p-8">
            <Text className="text-center text-sm text-text-muted">{t(emptyKey)}</Text>
          </View>
        ) : (
          <View className="overflow-hidden rounded-2xl border border-border bg-card p-1">
            {shown.map((rule) => (
              <RecurrenceRuleCard
                key={rule.id}
                rule={rule}
                tab={tab}
                onPress={() => router.push(`/transactions/recurring/${rule.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
