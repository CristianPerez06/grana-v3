import Link from 'next/link'
import { AlertTriangle, CreditCard, Receipt } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { deriveCommittedSplit, type CommittedOutlook } from '@grana/dashboard'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CommittedDetail, type CommittedDetailGroup } from './committed-detail'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'

type Props = {
  data: CommittedOutlook
  /** Label of the month the commitments belong to (e.g. "Septiembre 2026"). */
  monthLabel: string
}

/**
 * "Compromisos del próximo mes" — the committed total with its Tarjetas /
 * Gastos fijos split, and the two details in a fixed-height zone.
 *
 * The split percentages are derived from the total (`deriveCommittedSplit`), and
 * an empty month renders no bar at all rather than one built from invented
 * proportions. Cards are grouped BY CARD, not by consumo: the user asks "how
 * much is coming from Visa", not "which twenty charges are pending".
 *
 * NOTHING in this card changes its height. Row 2's two cards share a height and
 * "Cuánto gastaste" has no content to fill extra space with, so every pixel this
 * card grows shows up as a hole in its neighbour. Hence the detail zone that
 * replaces instead of unfolding (`committed-detail.tsx`), and hence the overdue
 * notice being ONE line inside the total block: it is a footnote to that total —
 * it says outright that it is not part of it — not a block competing with it.
 */
export const CommittedSection = async ({ data, monthLabel }: Props) => {
  const t = await getTranslations('dashboard.committed')
  const format = await getFormatter()

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
          date: format.dateTime(new Date(`${nextClose}T00:00:00`), { day: '2-digit', month: '2-digit' }),
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
      sub: t('recurring_group_sub', { count: recurring.length }),
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

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text">
            {t('title_next_month')}
          </h2>
          <p className="text-[12.5px] font-semibold text-text-soft">{monthLabel}</p>
        </div>
        <Link
          href="/cards"
          className="rounded text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('view_all')} ›
        </Link>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {isEmpty ? (
          <p className="py-6 text-center text-[13.5px] font-semibold text-text-soft">
            {t('empty')}
          </p>
        ) : (
          <>
            {/* Total + stacked bar + the overdue footnote */}
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
                  <div
                    aria-hidden
                    className="mt-3 flex h-[9px] overflow-hidden rounded-[5px] bg-border-soft"
                  >
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
                <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-bold text-terracotta">
                  <AlertTriangle size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />
                  {t('overdue_prefix')}
                  <span className="font-extrabold">
                    <MaskedAmount amount={data.ARS.overdue} currency="ARS" />
                  </span>
                  {data.USD.overdue !== 0 && (
                    <span className="font-extrabold">
                      + <MaskedAmount amount={data.USD.overdue} currency="USD" showCentsOverride />
                    </span>
                  )}
                  {t('overdue_suffix')}
                </p>
              )}
            </div>

            <CommittedDetail groups={groups} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
