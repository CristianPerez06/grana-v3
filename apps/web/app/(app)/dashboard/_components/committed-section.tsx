import Link from 'next/link'
import { AlertTriangle, CreditCard, Receipt } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { deriveCommittedSplit, type CommittedOutlook } from '@grana/dashboard'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CommittedGroup } from './committed-group'
import { CommittedRow } from './committed-row'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'

type Props = {
  data: CommittedOutlook
  /** Label of the month the commitments belong to (e.g. "Septiembre 2026"). */
  monthLabel: string
}

/**
 * "Compromisos del próximo mes" — the committed total with its Tarjetas /
 * Gastos fijos split, and the two details as collapsible groups.
 *
 * The split percentages are derived from the total (`deriveCommittedSplit`), and
 * an empty month renders no bar at all rather than one built from invented
 * proportions. Cards are grouped BY CARD, not by consumo: the user asks "how
 * much is coming from Visa", not "which twenty charges are pending".
 *
 * Both groups collapse fully: with the group closed the header still carries the
 * total and how many items make it up, so the closed state answers the question
 * on its own and opening is for the breakdown.
 *
 * Overdue statements get their OWN line and stay out of the total: what is late
 * and what is merely coming are two different facts, and folding them together
 * would make the month's number unreadable. Hiding the late money instead was
 * not an option either — it is the most urgent thing on the card.
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
            {/* Total + stacked bar */}
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
            </div>

            {/* Vencido — apart from the total, never inside it */}
            {hasOverdue && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-terracotta-soft px-3.5 py-3 text-terracotta">
                <AlertTriangle size={16} strokeWidth={2.5} aria-hidden className="mt-px shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-extrabold">{t('overdue')}</p>
                    <p className="shrink-0 text-[14px] font-extrabold tabular-nums">
                      <MaskedAmountDisplay amount={data.ARS.overdue} currency="ARS" dimSymbol />
                    </p>
                  </div>
                  {data.USD.overdue !== 0 && (
                    <p className="mt-0.5 text-right text-[12px] font-bold">
                      <MaskedAmount amount={data.USD.overdue} currency="USD" showCentsOverride />
                    </p>
                  )}
                  <p className="mt-0.5 text-[11.5px] font-semibold opacity-80">
                    {t('overdue_sub')}
                  </p>
                </div>
              </div>
            )}

            {/* Tarjetas — up to CARDS_COLLAPSED visible, the rest behind the toggle */}
            <CommittedGroup
              icon={<CreditCard size={18} strokeWidth={2} aria-hidden />}
              iconClassName="bg-slate-soft text-slate"
              label={t('cards_group')}
              sub={cardsSub}
              ars={data.ARS.debt}
              usd={data.USD.debt}
            >
              {cards.length === 0 ? (
                <p className="border-t border-border-soft py-3 text-[12.5px] font-semibold text-text-soft">
                  {t('cards_empty')}
                </p>
              ) : (
                cards.map((card) => (
                  <CommittedRow
                    key={card.id}
                    label={card.label}
                    amount={card.amount}
                    currency="ARS"
                  />
                ))
              )}
            </CommittedGroup>

            {/* Gastos fijos — the list scrolls inside its own panel, never the card */}
            <CommittedGroup
              icon={<Receipt size={18} strokeWidth={2} aria-hidden />}
              iconClassName="bg-plum-soft text-plum-deep"
              label={t('recurring_group')}
              sub={t('recurring_group_sub', { count: recurring.length })}
              ars={data.ARS.recurringExpense}
              usd={data.USD.recurringExpense}
            >
              {recurring.length === 0 ? (
                <p className="border-t border-border-soft py-3 text-[12.5px] font-semibold text-text-soft">
                  {t('recurring_empty')}
                </p>
              ) : (
                <>
                  <div className="max-h-[196px] overflow-y-auto">
                    {recurring.map((item, index) => (
                      <CommittedRow
                        key={`${item.description}-${index}`}
                        label={item.description}
                        amount={item.amount}
                        currency="ARS"
                      />
                    ))}
                  </div>
                  <Link
                    href="/transactions/recurring"
                    className="mt-2 inline-block rounded text-[12.5px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t('view_fixed')} ›
                  </Link>
                </>
              )}
            </CommittedGroup>
          </>
        )}
      </CardContent>
    </Card>
  )
}
