import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react-native'
import { duplicateRuleIds, type RecurrenceSummary } from '@grana/recurrences'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { Segmented } from '../../../../components/ui/Segmented'
import { SkeletonBlock } from '../../../../components/ui/SkeletonBlock'
import { RecurrenceRuleCard } from '../../../../components/recurrences/RecurrenceRuleCard'
import { getRecurrencesList } from '../../../../lib/recurrences/queries'
import { colors } from '../../../../lib/colors'
import { useT } from '../../../../lib/locale-context'

type Tab = 'active' | 'paused' | 'finished'

/**
 * The three groups come from the DERIVED state, not from `status` and not from
 * `end_date` — the same partition web's hub uses, from the same one definition.
 *
 * This used to be `end_date < today`, which answers a narrower question than the
 * tab claims: a rule that spent its `max_occurrences` has no future either, and
 * it sat among the active ones announcing a next date it would never produce.
 * That is how a plan with a limit of 1 read as «Activa» while it had already
 * stopped reminding (#142).
 */
const isFinished = (rule: RecurrenceSummary): boolean =>
  rule.lifecycle.state === 'finished' || rule.lifecycle.state === 'finished-with-pending'

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
  const [tab, setTab] = useState<Tab>('active')

  const query = useQuery({
    queryKey: ['recurrences', 'list'] as const,
    queryFn: getRecurrencesList,
  })

  const rules = query.data ?? []
  const active = rules.filter((r) => r.lifecycle.state === 'active')
  const paused = rules.filter((r) => r.lifecycle.state === 'paused')
  const finished = rules.filter(isFinished)
  const buckets: Record<Tab, RecurrenceSummary[]> = { active, paused, finished }
  // Active rules that collide with another (same account, currency and type,
  // equal or nearly equal amount) get an informative badge, as on web's hub.
  const duplicateIds = duplicateRuleIds(active)

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
        actions={
          <Pressable
            onPress={() => router.push('/transactions/recurring/new')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('recurrences.create.title')}
            className="h-9 w-9 items-center justify-center rounded-lg"
          >
            <Plus size={20} color={colors.white} />
          </Pressable>
        }
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
                duplicate={duplicateIds.has(rule.id)}
                onPress={() => router.push(`/transactions/recurring/${rule.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
