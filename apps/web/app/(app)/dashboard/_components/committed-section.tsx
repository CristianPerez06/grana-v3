'use client'

import Link from 'next/link'
import { AlertTriangle, CreditCard, Receipt } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { deriveCommittedSplit, type CommittedOutlook } from '@grana/dashboard'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CommittedBody, type CommittedDetailGroup } from './committed-body'
import { CommittedBodySkeleton } from './committed-body-skeleton'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'
import { useCommittedMonth } from './use-committed-month'

type Props = {
  /** The current month, server-rendered. Null when that read failed. */
  initialData: CommittedOutlook | null
}

/**
 * "Compromisos del próximo mes" — the committed total with its Tarjetas /
 * Gastos fijos split, and the two details behind a body that swaps in place.
 *
 * The split percentages are derived from the total (`deriveCommittedSplit`), and
 * an empty month renders no bar at all rather than one built from invented
 * proportions. Cards are grouped BY CARD, not by consumo: the user asks "how
 * much is coming from Visa", not "which twenty charges are pending".
 *
 * The heading has THREE states, one per navigator position, because the same
 * number answers a different question in each: a forecast on the current month,
 * what was ahead of you at a past month's close while that window is still
 * running, and what had to be paid once it ended. All three read `lens` and
 * `windowElapsed` off the query result — never a clock of their own.
 *
 * NOTHING in this card changes its height. Row 2's two cards share a height and
 * "Cuánto gastaste" has no content to fill extra space with, so every pixel this
 * card grows shows up as a hole in its neighbour. Hence the two-faced body
 * (`committed-body.tsx`), and hence the overdue notice being ONE line inside the
 * total block: it is a footnote to that total — it says outright that it is not
 * part of it — not a block competing with it.
 */
export const CommittedSection = ({ initialData }: Props) => {
  const t = useTranslations('dashboard.committed')
  const format = useFormatter()
  const { data, isLoading, isError } = useCommittedMonth(initialData)

  // Every label below is named from the read's own window and cut — never from a
  // clock of this component's. `monthAt` gives the bare month name for the
  // sentences that embed one; `monthLabel` the capitalized "Mes de AAAA".
  const monthAt = (iso: string) => {
    const [y, m] = iso.split('-').map(Number)
    return format.dateTime(new Date(y!, m! - 1, 1), { month: 'long' })
  }
  const monthLabel = data
    ? (() => {
        const label = `${monthAt(data.window.start)} de ${data.window.start.slice(0, 4)}`
        return label.charAt(0).toUpperCase() + label.slice(1)
      })()
    : ''

  // Three headings, three claims, and the middle one is the reason this is not
  // one string with a month in it. "Lo que tenías por delante" asserted what the
  // user KNEW at the cut, and a past window cannot support that: it is a
  // reconstructed record, so a rule created after the cut feeds it. Verified on
  // real data — one account read 77% of that figure from rules born the day
  // after. Naming the window ("Compromisos de septiembre") states the same
  // number without claiming foresight, and the subtitle carries the vantage
  // point, which is what actually distinguishes this position.
  const isAhead = data != null && data.lens === 'snapshot' && !data.windowElapsed
  const title = !data
    ? t('title_next_month')
    : data.lens === 'live'
      ? t('title_next_month')
      : data.windowElapsed
        ? t('title_past')
        : t('title_ahead', { month: monthAt(data.window.start) })
  const subtitle = isAhead ? t('subtitle_ahead', { month: monthAt(data.snapshotDate) }) : monthLabel

  // The chrome (title, month, link) does not depend on the read, so it paints
  // from the first frame in all three states and the card does not assemble in
  // jumps when navigating to an uncached month.
  const header = (
    <CardHeader className="flex-row items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold tracking-tight text-text">{title}</h2>
        <p className="text-[12.5px] font-semibold text-text-soft">{subtitle}</p>
      </div>
      <Link
        href="/cards"
        className="shrink-0 whitespace-nowrap rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('view_all')} ›
      </Link>
    </CardHeader>
  )

  if (isLoading || !data) {
    return (
      // Same floor the Suspense fallback carries (`committed-skeleton.tsx`), so
      // navigating to an uncached month cannot shrink the card mid-flight and
      // leave a hole in "Cuánto gastaste" beside it.
      <Card className="flex min-h-[15rem] flex-col">
        {header}
        <CardContent className="flex flex-1 flex-col gap-3">
          {isError ? (
            <p className="py-6 text-center text-[13.5px] font-semibold text-text-soft">
              {t('error')}
            </p>
          ) : (
            <CommittedBodySkeleton />
          )}
        </CardContent>
      </Card>
    )
  }

  const split = deriveCommittedSplit(data.ARS.debt, data.ARS.recurringExpense)
  const usdSplit = deriveCommittedSplit(data.USD.debt, data.USD.recurringExpense)

  const cards = data.ARS.cards
  const recurring = data.ARS.topRecurring
  const hasOverdue = data.ARS.overdue !== 0 || data.USD.overdue !== 0
  // Overdue money alone is enough to have something to say: the empty state
  // means "nothing to pay", and a late statement is very much something to pay.
  const isEmpty = !split.hasBar && !usdSplit.hasBar && !hasOverdue

  const nextClose = cards.find((card) => card.nextClose != null)?.nextClose ?? null
  const cardsSub =
    nextClose != null
      ? t('cards_group_sub_close', {
          count: cards.length,
          date: format.dateTime(new Date(`${nextClose}T00:00:00`), {
            day: '2-digit',
            month: '2-digit',
          }),
        })
      : t('cards_group_sub', { count: cards.length })

  const groups: CommittedDetailGroup[] = [
    {
      key: 'cards',
      icon: <CreditCard size={18} strokeWidth={2} aria-hidden />,
      iconClassName: 'bg-slate-soft text-slate',
      label: t('cards_group'),
      sub: cardsSub,
      ars: data.ARS.debt,
      usd: data.USD.debt,
      rows: cards.map((card) => ({ id: card.id, label: card.label, amount: card.amount })),
      emptyMessage: t('cards_empty'),
    },
    {
      key: 'recurring',
      icon: <Receipt size={18} strokeWidth={2} aria-hidden />,
      iconClassName: 'bg-plum-soft text-plum-deep',
      label: t('recurring_group'),
      // Under `snapshot` the group counts `confirmed` instances too (that is what
      // keeps a past window from shrinking as the user resolves it), so calling
      // them "pendientes" stopped being true. Only the lens knows.
      sub:
        data.lens === 'live'
          ? t('recurring_group_sub', { count: recurring.length })
          : t('recurring_group_sub_snapshot', { count: recurring.length }),
      ars: data.ARS.recurringExpense,
      usd: data.USD.recurringExpense,
      rows: recurring.map((item, index) => ({
        id: `${item.description}-${index}`,
        label: item.description,
        amount: item.amount,
      })),
      emptyMessage: t('recurring_empty'),
      link: { href: '/transactions/recurring', label: t('view_fixed') },
    },
  ]

  // Total + stacked bar + the overdue footnote. Lives on the body's front face.
  const summary = (
    <div className="rounded-2xl border border-border bg-surface-sunken p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('committed_label')}
      </p>
      <p className="mt-1 text-[31px] font-extrabold leading-none tracking-[-0.045em] text-text">
        <MaskedAmountDisplay amount={split.total} currency="ARS" dimSymbol />
      </p>
      {usdSplit.total !== 0 && (
        <p className="mt-1 text-[12px] font-semibold text-text-soft">
          <MaskedAmount amount={usdSplit.total} currency="USD" showCentsOverride />
        </p>
      )}

      {split.hasBar && (
        <>
          <div aria-hidden className="mt-3 flex h-[9px] overflow-hidden rounded-[5px] bg-border-soft">
            <span className="h-full bg-slate" style={{ width: `${split.cardsPct}%` }} />
            <span className="h-full bg-plum" style={{ width: `${split.recurringPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold text-text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px] bg-slate" />
              {t('cards_group')} {Math.round(split.cardsPct)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-[2px] bg-plum" />
              {t('recurring_group')} {Math.round(split.recurringPct)}%
            </span>
          </div>
        </>
      )}

      {hasOverdue && (
        // ONE line, guaranteed: no `flex-wrap`, every fixed part `shrink-0`, and
        // the trailing words truncate. A second row here costs ~20px of card
        // height, which comes straight out of the neighbouring card as a hole.
        <p className="mt-2.5 flex items-center gap-x-1.5 text-[12px] font-bold text-terracotta">
          <AlertTriangle size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />
          <span className="shrink-0">{t('overdue_prefix')}</span>
          <span className="shrink-0 font-extrabold">
            <MaskedAmount amount={data.ARS.overdue} currency="ARS" />
          </span>
          {data.USD.overdue !== 0 && (
            <span className="shrink-0 font-extrabold">
              + <MaskedAmount amount={data.USD.overdue} currency="USD" showCentsOverride />
            </span>
          )}
          <span className="truncate">{t('overdue_suffix')}</span>
        </p>
      )}
    </div>
  )

  return (
    <Card className="flex flex-col">
      {/* One row at every width: the link belongs beside the title, not stacked
          under it. The title block shrinks; the link never wraps. */}
      {header}

      <CardContent className="flex flex-1 flex-col">
        {isEmpty ? (
          <p className="py-6 text-center text-[13.5px] font-semibold text-text-soft">{t('empty')}</p>
        ) : (
          <CommittedBody summary={summary} groups={groups} />
        )}
      </CardContent>
    </Card>
  )
}
