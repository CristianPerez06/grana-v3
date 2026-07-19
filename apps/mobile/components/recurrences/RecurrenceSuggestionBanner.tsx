import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getTopRecurrenceSuggestion } from '../../lib/recurrences/queries'
import {
  acceptRecurrenceSuggestion,
  dismissRecurrenceSuggestion,
} from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceMutation } from '../../lib/recurrences/invalidate'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { categoryName, movementLabel } from './format'

// Feed banner surfacing the strongest on-the-fly recurrence suggestion. Accept
// creates the rule; dismiss hides the pattern (idempotent by fingerprint). Renders
// nothing when there is no suggestion. Thin consumer of `@grana/recurrences`.
export function RecurrenceSuggestionBanner() {
  const t = useT()
  const showCents = useShowCents()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const query = useQuery({
    queryKey: ['recurrences', 'suggestion'] as const,
    queryFn: getTopRecurrenceSuggestion,
    staleTime: 30 * 60 * 1000,
  })

  const suggestion = query.data ?? null
  if (!suggestion) return null

  const amount =
    suggestion.currency_code === 'ARS'
      ? formatARS(suggestion.amount, showCents)
      : formatUSD(suggestion.amount, showCents)

  const title =
    suggestion.description ||
    categoryName(suggestion.category, t) ||
    movementLabel(suggestion.movement_type, t)

  const onAccept = async () => {
    setBusy(true)
    const result = await acceptRecurrenceSuggestion(
      {
        movement_type: suggestion.movement_type,
        account_id: suggestion.account_id,
        transfer_destination_account_id: suggestion.destination_account_id,
        category_id: suggestion.category_id,
        currency_code: suggestion.currency_code,
        amount: suggestion.amount,
        frequency: suggestion.frequency,
        start_date: suggestion.start_date,
        description: suggestion.description,
        fingerprint: suggestion.fingerprint,
      },
      t,
    )
    setBusy(false)
    if (result.ok) invalidateAfterRecurrenceMutation(queryClient)
  }

  const onDismiss = async () => {
    setBusy(true)
    const result = await dismissRecurrenceSuggestion(
      { fingerprint: suggestion.fingerprint },
      t,
    )
    setBusy(false)
    if (result.ok) invalidateAfterRecurrenceMutation(queryClient)
  }

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View>
        <Text className="text-[15px] font-extrabold text-text">
          {t('recurrences.suggestion.title')}
        </Text>
        <Text className="mt-0.5 text-[13px] text-text-muted">
          {t('recurrences.suggestion.basis', { count: suggestion.occurrence_count })}
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text numberOfLines={1} className="flex-shrink pr-3 text-[14px] font-semibold text-text">
          {title}
        </Text>
        <Text className="text-[15px] font-extrabold text-text">{amount}</Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={onAccept}
          disabled={busy}
          className="flex-1 items-center rounded-xl bg-navy py-3 active:opacity-90 disabled:opacity-60"
        >
          <Text className="text-sm font-bold text-white">
            {busy ? t('recurrences.suggestion.processing') : t('recurrences.suggestion.create_rule')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          disabled={busy}
          className="items-center justify-center rounded-xl border border-border px-4 py-3 active:bg-page disabled:opacity-60"
        >
          <Text className="text-sm font-semibold text-text-muted">
            {t('recurrences.suggestion.dismiss')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
