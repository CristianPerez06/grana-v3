'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deriveSuggestion,
  getAvailableSums,
  getReserveHistory,
  lastSaveOf,
  shouldOfferSuggestion,
} from '@grana/savings'
import { getMonthBalanceSeries } from '@grana/dashboard'
import { formatARS } from '@grana/i18n-messages'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { GUIDANCE_IDS } from '@/lib/guidance/catalog'
import { getGuidanceStatus, markGuidance } from '@/app/_actions/guidance'
import { reserveAvailability } from '@/app/_actions/savings'

const GUIDANCE_ID = GUIDANCE_IDS.SAVINGS_SUGGEST_AFTER_INCOME

/**
 * "¿Guardás una parte?" — the light strip that turns getting paid into the
 * moment to set money aside.
 *
 * Without it fase 1 still works, but it loses its best gesture: getting paid is
 * when a person is willing to decide, and the dashboard row alone makes the act
 * feel manual.
 *
 * It is a SUGGESTION, not a task. It never blocks or interrupts the alta — the
 * movement is already saved by the time this can appear — it carries no badge or
 * pending count, and it shows at most once per calendar month.
 *
 * Conditions, all of them derived and none of them stored:
 * · the month has real income (a `reimbursement` does not count — money coming
 *   back is not money arriving),
 * · there is something available to set aside,
 * · the strip was not already offered this month,
 * · the user has not dismissed it for good.
 */
export const SaveSuggestionStrip = ({ year, month }: { year: number; month: number }) => {
  const t = useTranslations('savings.suggestion')
  const queryClient = useQueryClient()
  const [hidden, setHidden] = useState(false)
  const [pending, startTransition] = useTransition()

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const currentMonth = formatDateISO(getTodayAR()).slice(0, 7)

  const [guidanceQuery, sumsQuery, historyQuery, seriesQuery] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'guidance', GUIDANCE_ID],
        queryFn: () => getGuidanceStatus(GUIDANCE_ID),
        staleTime: 60_000,
      },
      {
        queryKey: ['savings', 'sums'],
        queryFn: () => getAvailableSums(createClient()),
        staleTime: 60_000,
      },
      {
        queryKey: ['savings', 'history', 'ARS'],
        queryFn: () => getReserveHistory(createClient(), 'ARS'),
        staleTime: 60_000,
      },
      {
        // Same key the balance card uses, so this shares its cache instead of
        // fetching the month a second time.
        queryKey: ['dashboard', 'balance-series', year, month],
        queryFn: () => getMonthBalanceSeries(createClient(), year, month),
        staleTime: 60_000,
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
  const history = historyQuery.data ?? []
  const lastSave = lastSaveOf(history)

  // The percentage the user established comes from the income of the month they
  // last saved in — which is almost never the month being viewed, since the
  // suggestion's whole point is to carry a habit ACROSS months. So that month's
  // series is its own read, fetched only when there is a previous save and it
  // lives in a different month. Without it the derivation falls back to 10%,
  // which is what a first-time user gets anyway.
  const lastSaveMonth = lastSave?.date.slice(0, 7) ?? null
  const [lastSaveYear, lastSaveMonthNumber] = (lastSaveMonth ?? '0-0').split('-').map(Number)
  const needsPastSeries = lastSaveMonth != null && lastSaveMonth !== monthKey

  const pastSeriesQuery = useQuery({
    queryKey: ['dashboard', 'balance-series', lastSaveYear, lastSaveMonthNumber],
    queryFn: () => getMonthBalanceSeries(createClient(), lastSaveYear, lastSaveMonthNumber),
    enabled: needsPastSeries,
    staleTime: 60_000,
  })

  const incomeAtLastSave = needsPastSeries
    ? (pastSeriesQuery.data?.ARS.totalIncome ?? null)
    : (seriesQuery.data?.ARS.totalIncome ?? null)

  const suggestion = deriveSuggestion({
    monthIncome: seriesQuery.data?.ARS.totalIncome ?? 0,
    lastSave,
    incomeAtLastSave,
    available,
  })

  // Only in the current month: a suggestion to act is about now, and offering it
  // while the user browses May would be asking them to save in the past.
  const isCurrentMonth = monthKey === currentMonth

  if (hidden || !isCurrentMonth || !offerable || !suggestion) return null

  const close = (permanent: boolean) => {
    setHidden(true)
    startTransition(async () => {
      await markGuidance(GUIDANCE_ID, permanent ? 'dismissed' : 'seen')
      void queryClient.invalidateQueries({ queryKey: ['savings', 'guidance', GUIDANCE_ID] })
    })
  }

  const save = () => {
    startTransition(async () => {
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
    })
  }

  return (
    <section className="relative flex flex-col gap-3 rounded-2xl border border-emerald/25 bg-emerald-bg p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1 pr-7 sm:pr-0">
        <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-text">{t('title')}</h3>
        {/* "Podés apartar", not "te conviene guardar": a proposal about behavior,
            not a piece of financial advice. The amount is SUGGESTED, never the
            figure Grana says you should set aside. */}
        <p className="mt-0.5 text-[13px] leading-snug text-text-muted">
          {t('body', { amount: formatARS(suggestion.amount) })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button onClick={save} disabled={pending}>
          {t('cta', { amount: formatARS(suggestion.amount) })}
        </Button>
        <Button variant="ghost" onClick={() => close(false)} disabled={pending}>
          {t('later')}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => close(true)}
        disabled={pending}
        aria-label={t('never')}
        title={t('never')}
        className="absolute right-3 top-3 rounded p-1 text-[13px] font-bold leading-none text-text-soft transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:static sm:ml-1 sm:self-start"
      >
        ✕
      </button>
    </section>
  )
}
