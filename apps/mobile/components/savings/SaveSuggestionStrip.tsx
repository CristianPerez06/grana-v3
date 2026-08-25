import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deriveSuggestion,
  getAvailableSums,
  getLatestIncome,
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
  const [busy, setBusy] = useState(false)

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const currentMonth = formatDateISO(getTodayAR()).slice(0, 7)
  const todayISO = formatDateISO(getTodayAR())

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
        queryKey: ['savings', 'latest-income', todayISO] as const,
        queryFn: () => getLatestIncome(supabase, 'ARS', todayISO),
      },
    ],
  })

  const guidance = guidanceQuery.data
  const latestIncome = incomeQuery.data ?? null
  const offerable = shouldOfferSuggestion({
    seenAt: guidance?.seen_at ?? null,
    dismissedAt: guidance?.dismissed_at ?? null,
    currentMonth,
    latestIncomeAt: latestIncome?.createdAt ?? null,
  })

  const available = sumsQuery.data?.find((s) => s.currencyCode === 'ARS')?.available ?? 0
  const lastSave = lastSaveOf(historyQuery.data?.entries ?? [])

  // The percentage comes from the income of the month the user LAST saved in,
  // which is almost never the month on screen — carrying the habit across months
  // is the whole point. That month's series is its own read, fetched only when
  // it is a different month; without it the derivation falls back to 10%.
  const lastSaveDate = lastSave?.date ?? null

  const priorIncomeQuery = useQuery({
    queryKey: ['savings', 'latest-income', lastSaveDate ?? 'none'] as const,
    queryFn: () => getLatestIncome(supabase, 'ARS', lastSave!.date),
    enabled: lastSaveDate != null,
    
  })

  // El porcentaje sale de la MISMA relación que la propuesta: lo guardado sobre
  // el ingreso del que salió. Derivarlo contra el total del mes daría un número
  // distinto del que el usuario aceptó.
  const incomeAtLastSave = priorIncomeQuery.data?.amount ?? null

  const suggestion = deriveSuggestion({
    latestIncome: latestIncome?.amount ?? 0,
    lastSave,
    incomeAtLastSave,
    available,
  })

  // A suggestion to act is about now: offering it while the user browses May
  // would be asking them to save in the past.
  if (monthKey !== currentMonth || !offerable || !suggestion) return null

  // Hiding is a DATA write, not component state. A `hidden` flag would live for
  // as long as the dashboard stays mounted, so after "Ahora no" the strip would
  // never come back for the next income of the same session — the per-income rule
  // would be right in the database and unreachable on screen.
  const hideNow = (field: 'seen_at' | 'dismissed_at') => {
    const now = new Date().toISOString()
    queryClient.setQueryData(['savings', 'guidance', GUIDANCE_ID], {
      seen_at: guidance?.seen_at ?? null,
      dismissed_at: guidance?.dismissed_at ?? null,
      completed_at: guidance?.completed_at ?? null,
      [field]: now,
    })
  }

  const close = async (untilNextMonth: boolean) => {
    hideNow(untilNextMonth ? 'dismissed_at' : 'seen_at')
    await markGuidance(GUIDANCE_ID, untilNextMonth ? 'dismissed' : 'seen')
    void queryClient.invalidateQueries({ queryKey: ['savings', 'guidance', GUIDANCE_ID] })
  }

  const save = async () => {
    setBusy(true)
    hideNow('seen_at')
    try {
      const result = await reserveAvailability({
        amount: suggestion.amount,
        currency_code: 'ARS',
        date: getTodayAR(),
      })
      if (!result.ok) {
        // El guardado puede fallar: entre que la tira se dibujó y el usuario
        // tocó, un gasto pudo bajar el disponible. Sin esto la tira desaparecía,
        // no guardaba nada y no decía nada. Traer el estado del servidor deshace
        // el ocultado optimista y la tira vuelve para reintentar.
        void queryClient.invalidateQueries({ queryKey: ['savings'] })
        return
      }
      // `seen`, never `completed`: completing would kill a recurring suggestion
      // for good, and with the next income it should come back.
      await markGuidance(GUIDANCE_ID, 'seen')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['savings'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    } finally {
      setBusy(false)
    }
  }

  const amount = formatARS(suggestion.amount)

  return (
    // Two rows: the copy, then every action on one line. A taller strip on a
    // phone pushes the card the user actually came for below the fold.
    <View className="rounded-2xl border border-emerald-soft bg-emerald-bg px-4 py-3.5">
      <Text className="text-[15px] font-extrabold text-text">
        {t('savings.suggestion.title')}
      </Text>
      {/* "Podés apartar", not "te conviene guardar": a proposal about behavior,
          not financial advice. */}
      <Text className="mt-0.5 text-[13px] leading-snug text-text-muted">
        {t('savings.suggestion.body', { amount })}
      </Text>
      {/* Three ways out, none permanent: "Ahora no" defers to the next income and
          "Suficiente por este mes" drops to a monthly cadence — the slowest the
          strip can go, which is why nothing needs to kill it for good. The two
          are plain text, not buttons: three buttons read as three equally
          weighted choices and only one of them is the point. */}
      <View className="mt-3 flex-row items-center gap-3">
        <View className="flex-1">
          <Button
            title={t('savings.suggestion.cta', { amount })}
            onPress={save}
            loading={busy}
            disabled={busy}
          />
        </View>
        <Pressable onPress={() => close(false)} disabled={busy} accessibilityRole="button">
          <Text className="py-2 text-[13.5px] font-bold text-text-muted">
            {t('savings.suggestion.later')}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => close(true)}
        disabled={busy}
        accessibilityRole="button"
        className="items-center"
      >
        <Text className="pt-2 text-[13px] font-semibold text-text-soft">
          {t('savings.suggestion.enough_this_month')}
        </Text>
      </Pressable>
    </View>
  )
}
