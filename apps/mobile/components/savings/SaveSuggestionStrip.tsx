import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deriveSuggestion,
  getAvailableSums,
  getLatestIncomeAmount,
  getReserveHistory,
  lastSaveOf,
  shouldOfferSuggestion,
} from '@grana/savings'
import { formatARS } from '@grana/i18n-messages'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { useT } from '../../lib/locale-context'
import { supabase } from '../../lib/supabase'
import {
  MOBILE_GUIDANCE_IDS,
  getGuidanceStatus,
  markGuidance,
} from '../../lib/guidance/client'
import { reserveAvailability } from '../../lib/savings/mutations'
import { Button } from '../ui/Button'

const GUIDANCE_ID = MOBILE_GUIDANCE_IDS.SAVINGS_SUGGEST_AFTER_INCOME

/**
 * Native mirror of the web `save-suggestion-strip.tsx`.
 *
 * Getting paid is when a person is willing to decide, and on a phone that is
 * where most of it happens. It is a SUGGESTION, not a task: it never blocks the
 * alta — the movement is saved long before this can appear — carries no badge or
 * pending count, and shows at most once per calendar month.
 *
 * All four conditions are derived, none stored: real income this month (a
 * reimbursement is money coming back, not money arriving, and `totalIncome`
 * already excludes it), something available to set aside, not offered this
 * month, and not dismissed for good.
 */
export const SaveSuggestionStrip = ({ year, month }: { year: number; month: number }) => {
  const t = useT()
  const queryClient = useQueryClient()
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const currentMonth = formatDateISO(getTodayAR()).slice(0, 7)
  const todayISO = formatDateISO(getTodayAR())
  const monthStart = `${monthKey}-01`

  const [guidanceQuery, sumsQuery, historyQuery, incomeQuery] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'guidance', GUIDANCE_ID] as const,
        queryFn: () => getGuidanceStatus(GUIDANCE_ID),
      },
      {
        queryKey: ['savings', 'sums'] as const,
        queryFn: () => getAvailableSums(supabase),
      },
      {
        queryKey: ['savings', 'history', 'ARS'] as const,
        queryFn: () => getReserveHistory(supabase, 'ARS'),
      },
      {
        // The amount the user JUST got paid, not the month's total: the strip
        // appears right after registering an income, so "the last one of the
        // period" is in practice "the one you just loaded" — without needing an
        // event to tell it, which is what would make it fragile.
        queryKey: ['savings', 'latest-income', monthKey] as const,
        queryFn: () => getLatestIncomeAmount(supabase, 'ARS', monthStart, todayISO),
      },
    ],
  })

  const guidance = guidanceQuery.data
  const offerable = shouldOfferSuggestion({
    seenAt: guidance?.seen_at ?? null,
    dismissedAt: guidance?.dismissed_at ?? null,
    currentMonth,
  })

  const available = sumsQuery.data?.find((s) => s.currencyCode === 'ARS')?.available ?? 0
  const lastSave = lastSaveOf(historyQuery.data ?? [])

  // The percentage comes from the income of the month the user LAST saved in,
  // which is almost never the month on screen — carrying the habit across months
  // is the whole point. That month's series is its own read, fetched only when
  // it is a different month; without it the derivation falls back to 10%.
  const lastSaveMonth = lastSave?.date.slice(0, 7) ?? null

  const priorIncomeQuery = useQuery({
    queryKey: ['savings', 'latest-income', lastSaveMonth ?? 'none'] as const,
    queryFn: () =>
      getLatestIncomeAmount(supabase, 'ARS', `${lastSaveMonth}-01`, lastSave!.date),
    enabled: lastSaveMonth != null,
    
  })

  // El porcentaje sale de la MISMA relación que la propuesta: lo guardado sobre
  // el ingreso del que salió. Derivarlo contra el total del mes daría un número
  // distinto del que el usuario aceptó.
  const incomeAtLastSave = priorIncomeQuery.data ?? null

  const suggestion = deriveSuggestion({
    latestIncome: incomeQuery.data ?? 0,
    lastSave,
    incomeAtLastSave,
    available,
  })

  // A suggestion to act is about now: offering it while the user browses May
  // would be asking them to save in the past.
  if (hidden || monthKey !== currentMonth || !offerable || !suggestion) return null

  const close = async (permanent: boolean) => {
    setHidden(true)
    await markGuidance(GUIDANCE_ID, permanent ? 'dismissed' : 'seen')
    void queryClient.invalidateQueries({ queryKey: ['savings', 'guidance', GUIDANCE_ID] })
  }

  const save = async () => {
    setBusy(true)
    try {
      const result = await reserveAvailability({
        amount: suggestion.amount,
        currency_code: 'ARS',
        date: getTodayAR(),
      })
      // `seen`, never `completed`: completing would kill a recurring suggestion
      // for good, and next month it should come back.
      await markGuidance(GUIDANCE_ID, 'seen')
      setHidden(true)
      if (result.ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['savings'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ])
      }
    } finally {
      setBusy(false)
    }
  }

  const amount = formatARS(suggestion.amount)

  return (
    <View className="rounded-2xl border border-emerald-soft bg-emerald-bg p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[15px] font-extrabold text-text">
            {t('savings.suggestion.title')}
          </Text>
          {/* "Podés apartar", not "te conviene guardar": a proposal about
              behavior, not financial advice. */}
          <Text className="mt-0.5 text-[13px] leading-snug text-text-muted">
            {t('savings.suggestion.body', { amount })}
          </Text>
        </View>
        <Pressable
          onPress={() => close(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('savings.suggestion.never')}
          hitSlop={10}
          className="p-1"
        >
          <Text className="text-[13px] font-bold text-text-soft">✕</Text>
        </Pressable>
      </View>
      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <Button
            title={t('savings.suggestion.cta', { amount })}
            onPress={save}
            loading={busy}
            disabled={busy}
          />
        </View>
        <Pressable
          onPress={() => close(false)}
          disabled={busy}
          accessibilityRole="button"
          className="items-center justify-center rounded-xl px-4"
        >
          <Text className="text-[14px] font-bold text-text-muted">
            {t('savings.suggestion.later')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
