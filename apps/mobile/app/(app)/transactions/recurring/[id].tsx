import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Pencil, Play, Trash2 } from 'lucide-react-native'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { Drawer } from '../../../../components/ui/Drawer'
import { SkeletonBlock } from '../../../../components/ui/SkeletonBlock'
import { RecurrenceInstancesList } from '../../../../components/recurrences/RecurrenceInstancesList'
import { ResolveAheadActions } from '../../../../components/recurrences/ResolveAheadActions'
import { RecurrenceEditForm } from '../../../../components/recurrences/RecurrenceEditForm'
import {
  amountSign,
  amountToneClass,
  categoryName,
  subcategoryName,
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
//
// Both sides shrink, and the value takes whatever the label leaves. A fixed
// `max-w` on the value does not bound the ROW: a long label keeps its intrinsic
// width, so label + 62% overflowed the card and «Se calcula cuando reanudes la
// regla» was cut off mid-word on the right edge.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-2.5">
      <Text className="shrink text-[13px] font-medium text-text-muted">{label}</Text>
      <Text className="flex-1 text-right text-[14px] font-semibold text-text">{value}</Text>
    </View>
  )
}

/**
 * Recurrence rule detail. Read-only summary + generated-instance history, with
 * edit / pause-resume / delete in the header. Edit opens a `Drawer` with the
 * mutable-field form (amount/frequency/end date/description); pause-resume and
 * delete are direct button-mutations.
 */
export default function RecurrenceDetailScreen() {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const [editOpen, setEditOpen] = useState(false)

  const query = useQuery({
    queryKey: ['recurrences', 'detail', id] as const,
    queryFn: () => getRecurrenceDetail(id),
  })

  const rule = query.data ?? null
  const notFound = query.isError || (query.isSuccess && rule === null)

  // Null for an active rule: there is nothing to announce about one that is
  // simply running. See the comment where it is drawn.
  const stateLabel =
    rule == null || rule.lifecycle.state === 'active'
      ? null
      : rule.lifecycle.state === 'finished-with-pending'
        ? t('recurrences.limit.finished_with_pending', { count: rule.lifecycle.unresolved })
        : t(
            `recurrences.statuses.${
              rule.lifecycle.state === 'finished' ? 'finished' : rule.status
            }`,
          )

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
        onPress={() => setEditOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('recurrences.actions.edit')}
        className="h-9 w-9 items-center justify-center rounded-lg"
      >
        <Pencil size={19} color={colors.white} />
      </Pressable>
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
        backLink={
          from?.startsWith('transaction:')
            ? {
                href: `/transactions/${from.slice('transaction:'.length)}`,
                label: t('recurrences.back_to_movement'),
              }
            : { href: '/transactions/recurring', label: t('recurrences.back_label') }
        }
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
                {/* THE DERIVED STATE, web's twin. `status` says what the user
                    did to the rule, and a rule that spent its limit still says
                    `active` — so this line said nothing while the list grouped
                    the same rule under Finalizada. */}
                {stateLabel == null ? null : ` · ${stateLabel}`}
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
                {/* Shown because it NAMES the rule: with no description the
                    title is the subcategoría, and a ficha listing only the
                    categoría left the name on screen with no visible source.
                    Web's twin. */}
                {rule.movement_type !== 'transfer' && subcategoryName(rule.subcategory, t) ? (
                  <Row
                    label={t('recurrences.labels.subcategory')}
                    value={subcategoryName(rule.subcategory, t) as string}
                  />
                ) : null}
                {rule.next_occurrence ? (
                  <Row
                    label={t('recurrences.labels.next_date')}
                    value={formatShortDate(rule.next_occurrence, locale)}
                  />
                ) : null}
                {/* LAS DOS SALIDAS PARA UN VENCIMIENTO QUE NO LLEGÓ. Sin esto el
                    usuario que paga el alquiler el 3 tiene que esperar al 23 o
                    cargarlo a mano — y cargarlo a mano es peor, porque el 23 la
                    app se lo vuelve a proponer. Mismo commit que web. */}
                {rule.next_occurrence && rule.status === 'active' ? (
                  <View className="pt-2">
                    <ResolveAheadActions
                      recurrenceId={rule.id}
                      dueDate={rule.next_occurrence}
                      ruleAmount={Number(rule.amount)}
                      ruleCurrency={rule.currency_code}
                      movementType={rule.movement_type}
                      ruleAccountId={rule.account_id}
                      transferDestinationAccountId={rule.transfer_destination_account_id}
                      shared={rule.household_id != null}
                    />
                  </View>
                ) : null}
                {rule.end_date ? (
                  <Row
                    label={t('recurrences.labels.end_date')}
                    value={formatShortDate(rule.end_date, locale)}
                  />
                ) : null}

                {/* WHERE THE RULE IS IN ITS PLAN — the web detail's twin. A
                    limit decides when a rule stops reminding and was invisible
                    on every screen: a plan of eleven cuotas recorded as one read
                    «mensual, sin fecha de fin» (#142).

                    Counted in POSITIONS of the calendar, which is what
                    `max_occurrences` caps, never in instance rows. */}
                {rule.lifecycle.progress == null && !rule.end_date ? (
                  <Row
                    label={t('recurrences.limit.end_label')}
                    value={t('recurrences.limit.no_limit')}
                  />
                ) : null}
                {rule.lifecycle.progress != null ? (
                  <>
                    <Row
                      label={t('recurrences.limit.progress_label')}
                      value={t('recurrences.limit.progress', {
                        spent: rule.lifecycle.progress.spent,
                        total: rule.lifecycle.progress.total,
                      })}
                    />
                    {rule.lifecycle.progress.remaining > 0 ? (
                      <Row
                        label={t('recurrences.limit.remaining_label')}
                        value={t('recurrences.limit.remaining', {
                          remaining: rule.lifecycle.progress.remaining,
                        })}
                      />
                    ) : null}
                    {/* A paused rule gets a sentence instead of a date: while
                        the pause is open the final date depends on a day that
                        has not happened, and an estimate shown as a fact is
                        exactly what this avoids. */}
                    {rule.last_expected_occurrence.kind === 'date' ? (
                      <Row
                        label={t('recurrences.limit.last_expected')}
                        value={formatShortDate(rule.last_expected_occurrence.date, locale)}
                      />
                    ) : rule.last_expected_occurrence.kind === 'unknown-while-paused' ? (
                      <Row
                        label={t('recurrences.limit.last_expected')}
                        value={t('recurrences.limit.last_expected_paused')}
                      />
                    ) : null}
                  </>
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

      {rule && (
        <Drawer open={editOpen} onClose={() => setEditOpen(false)} ariaLabel={t('recurrences.edit_title')}>
          <RecurrenceEditForm rule={rule} onClose={() => setEditOpen(false)} />
        </Drawer>
      )}
    </View>
  )
}
