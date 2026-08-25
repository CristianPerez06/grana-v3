'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
  const [pending, startTransition] = useTransition()

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const currentMonth = formatDateISO(getTodayAR()).slice(0, 7)
  const todayISO = formatDateISO(getTodayAR())

  const [guidanceQuery, sumsQuery, historyQuery, incomeQuery] = useQueries({
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
        // The amount the user JUST got paid, not the month's total: the strip
        // appears right after registering an income, so "the last one of the
        // period" is in practice "the one you just loaded" — without needing an
        // event to tell it, which is what would make it fragile.
        queryKey: ['savings', 'latest-income', todayISO],
        queryFn: () => getLatestIncome(createClient(), 'ARS', todayISO),
        staleTime: 60_000,
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

  // The percentage the user established comes from the income of the month they
  // last saved in — which is almost never the month being viewed, since the
  // suggestion's whole point is to carry a habit ACROSS months. So that month's
  // series is its own read, fetched only when there is a previous save and it
  // lives in a different month. Without it the derivation falls back to 10%,
  // which is what a first-time user gets anyway.
  const lastSaveDate = lastSave?.date ?? null

  const priorIncomeQuery = useQuery({
    queryKey: ['savings', 'latest-income', lastSaveDate ?? 'none'] ,
    queryFn: () => getLatestIncome(createClient(), 'ARS', lastSave!.date),
    enabled: lastSaveDate != null,
    staleTime: 60_000,
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

  // Only in the current month: a suggestion to act is about now, and offering it
  // while the user browses May would be asking them to save in the past.
  const isCurrentMonth = monthKey === currentMonth

  if (!isCurrentMonth || !offerable || !suggestion) return null

  // Hiding is a DATA write, not component state. A `hidden` flag would live for
  // as long as the dashboard stays mounted, so after "Ahora no" the strip would
  // never come back for the next income of the same session — the per-income rule
  // would be correct in the database and unreachable on screen. Writing the
  // optimistic value into the guidance cache hides it just as fast AND keeps the
  // rule in charge of when it returns.
  const hideNow = (field: 'seen_at' | 'dismissed_at') => {
    queryClient.setQueryData(['savings', 'guidance', GUIDANCE_ID], {
      seen_at: guidance?.seen_at ?? null,
      dismissed_at: guidance?.dismissed_at ?? null,
      completed_at: guidance?.completed_at ?? null,
      [field]: new Date().toISOString(),
    })
  }

  const close = (untilNextMonth: boolean) => {
    hideNow(untilNextMonth ? 'dismissed_at' : 'seen_at')
    startTransition(async () => {
      await markGuidance(GUIDANCE_ID, untilNextMonth ? 'dismissed' : 'seen')
      void queryClient.invalidateQueries({ queryKey: ['savings', 'guidance', GUIDANCE_ID] })
    })
  }

  const save = () => {
    hideNow('seen_at')
    startTransition(async () => {
      const result = await reserveAvailability({
        amount: suggestion.amount,
        currency_code: 'ARS',
        date: getTodayAR(),
      })
      if (!result.ok) {
        // El guardado puede fallar: entre que la tira se dibujó y el usuario
        // tocó, un gasto pudo bajar el disponible por debajo del monto sugerido.
        // Sin esto la tira desaparecía, no guardaba nada y no decía nada — la
        // peor de las tres cosas juntas. Devolver el estado del servidor deshace
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
    })
  }

  const amount = formatARS(suggestion.amount)

  return (
    // Two rows at most, and one on a wide screen: the copy on the left, every
    // action on a single line to its right. The strip is a suggestion sitting
    // above the card the user came to read — the taller it gets, the more it
    // behaves like something that has to be dealt with first.
    <section className="flex flex-col gap-3 rounded-2xl border border-emerald/25 bg-emerald-bg px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-text">{t('title')}</h3>
        {/* "Podés apartar", not "te conviene guardar": a proposal about behavior,
            not a piece of financial advice. The amount is SUGGESTED, never the
            figure Grana says you should set aside. */}
        <p className="mt-0.5 text-[13px] leading-snug text-text-muted">
          {t('body', { amount })}
        </p>
      </div>
      {/* Three ways out, and none of them is permanent. "Ahora no" defers to the
          next income; "Suficiente por este mes" drops the strip to a monthly
          cadence — the slowest it can go, so there is nothing left to kill for
          good. A one-tap permanent off would get pressed by accident and the
          feature would silently disappear for that user forever.
          The two of them are links, not buttons: three buttons in a row read as
          three equally weighted choices, and only one of them is the point. */}
      <div className="flex shrink-0 items-center gap-4">
        <Button onClick={save} disabled={pending} className="whitespace-nowrap">
          {t('cta', { amount })}
        </Button>
        <button
          type="button"
          onClick={() => close(false)}
          disabled={pending}
          className="whitespace-nowrap rounded text-[13.5px] font-semibold text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('later')}
        </button>
        <button
          type="button"
          onClick={() => close(true)}
          disabled={pending}
          className="whitespace-nowrap rounded text-[13.5px] font-semibold text-text-soft transition-colors hover:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('enough_this_month')}
        </button>
      </div>
    </section>
  )
}
