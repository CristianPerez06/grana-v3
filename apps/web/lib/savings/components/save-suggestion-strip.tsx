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
  pickLatestIncome,
  shouldOfferSuggestion,
} from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
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

  const [guidanceQuery, sumsQuery, arsIncomeQuery, usdIncomeQuery] = useQueries({
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
      // El último ingreso de CADA moneda, y no solo el de pesos. La consulta
      // siempre recibió la moneda por parámetro; el que nunca se la pasaba era
      // este componente, y por eso un ingreso en dólares no despertaba nunca la
      // tira. Era la única superficie del módulo donde el dólar no existía, y
      // justo la del gesto principal.
      //
      // The amount the user JUST got paid, not the month's total: the strip
      // appears right after registering an income, so "the last one of the
      // period" is in practice "the one you just loaded" — without needing an
      // event to tell it, which is what would make it fragile.
      {
        queryKey: ['savings', 'latest-income', 'ARS', todayISO],
        queryFn: () => getLatestIncome(createClient(), 'ARS', todayISO),
        staleTime: 60_000,
      },
      {
        queryKey: ['savings', 'latest-income', 'USD', todayISO],
        queryFn: () => getLatestIncome(createClient(), 'USD', todayISO),
        staleTime: 60_000,
      },
    ],
  })

  const guidance = guidanceQuery.data

  // UNA tira, la del ingreso MÁS RECIENTE — nunca dos. La tira promete «acabás
  // de cobrar esto, ¿guardás una parte?», así que la moneda es la de lo último
  // que se cargó; dos tiras apiladas serían dos decisiones sobre la card que el
  // usuario vino a leer, y elegir siempre pesos sería decidir por él.
  //
  // Se comparan los `created_at` (ISO, así que el orden lexicográfico ES el
  // cronológico), no las fechas contables: lo que persigue la tira es el acto de
  // cargar, no qué día se cobró.
  const latest = pickLatestIncome(arsIncomeQuery.data ?? null, usdIncomeQuery.data ?? null)
  const currency = latest?.currency ?? null
  const latestIncome = latest?.income ?? null

  const offerable = shouldOfferSuggestion({
    seenAt: guidance?.seen_at ?? null,
    dismissedAt: guidance?.dismissed_at ?? null,
    currentMonth,
    latestIncomeAt: latestIncome?.createdAt ?? null,
  })

  // El historial es POR MONEDA, igual que todo lo demás del módulo: el hábito
  // que la tira deriva es lo guardado sobre el ingreso del que salió, y hacerlo
  // cruzado —un porcentaje de pesos dictando un monto en dólares— sería mezclar
  // dos monedas que no se mezclan.
  const historyQuery = useQuery({
    queryKey: ['savings', 'history', currency ?? 'none'],
    queryFn: () => getReserveHistory(createClient(), currency!),
    enabled: currency != null,
    staleTime: 60_000,
  })

  const available = sumsQuery.data?.find((s) => s.currencyCode === currency)?.available ?? 0
  const lastSave = lastSaveOf(historyQuery.data?.entries ?? [])

  // The percentage the user established comes from the income of the month they
  // last saved in — which is almost never the month being viewed, since the
  // suggestion's whole point is to carry a habit ACROSS months. So that month's
  // series is its own read, fetched only when there is a previous save and it
  // lives in a different month. Without it the derivation falls back to 10%,
  // which is what a first-time user gets anyway.
  const lastSaveDate = lastSave?.date ?? null

  const priorIncomeQuery = useQuery({
    queryKey: ['savings', 'latest-income', currency ?? 'none', lastSaveDate ?? 'none'],
    queryFn: () => getLatestIncome(createClient(), currency!, lastSave!.date),
    enabled: currency != null && lastSaveDate != null,
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

  if (!isCurrentMonth || !offerable || !suggestion || currency == null) return null

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
        currency_code: currency,
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

  // El monto ya viene formateado al copy, así que el texto no sabe de monedas:
  // «Podés apartar US$ 900,00» y «Podés apartar $ 90.000,00» son la misma frase.
  //
  // Y va en UN solo lugar: el TEXTO. Estaba también en el botón —«Guardar
  // US$ 10.000,00»— y el mismo número dos veces a dos renglones de distancia se
  // lee como dos datos, no como uno repetido. La propuesta es la frase —cuánto,
  // de dónde sale y qué le pasa a la plata—; el botón es la respuesta a esa
  // frase, y con el número adentro pasaba a ser él la propuesta.
  const amount = currency === 'USD' ? formatUSD(suggestion.amount) : formatARS(suggestion.amount)

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
          three equally weighted choices, and only one of them is the point.

          Y las tres entran en UNA línea, también en un teléfono de 320. Entran
          porque ninguna de las tres depende de un número: el botón dice
          «Guardar» —el monto vive en el texto, una sola vez— y las dos salidas
          son cortas. Antes «Suficiente por este mes» se salía de la pantalla,
          cortada por el borde, sin scroll y sin ninguna señal.

          Partirlas en dos filas se probó y se descartó: la tira crece hacia
          abajo, y cuanto más alta más se parece a algo que hay que resolver
          antes de mirar el saldo, que es justo lo que promete no ser. */}
      <div className="flex shrink-0 items-center gap-4">
        <Button onClick={save} disabled={pending} className="whitespace-nowrap">
          {t('cta')}
        </Button>
        {/* «Ahora no» y «Este mes no»: el mismo giro con distinto alcance, y esa
            simetría dice la escala sin explicarla — una posterga hasta el
            próximo ingreso, la otra hasta el mes que viene. */}
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
