import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, CreditCard, Repeat } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CommittedCurrency, CommittedItem, CommittedOutlook } from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'

type Props = {
  data: CommittedOutlook
}

const committedTotal = (c: CommittedCurrency) => c.debt + c.recurringExpense

const isEmpty = (data: CommittedOutlook) =>
  committedTotal(data.ARS) === 0 &&
  committedTotal(data.USD) === 0 &&
  data.ARS.recurringIncome === 0 &&
  data.USD.recurringIncome === 0

/** ISO `YYYY-MM-DD` → `dd/mm` for the compact movement rows. */
const ddmm = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

// One obligation section: icon + label (+ hint) + per-currency subtotal, then its
// top movements by amount, and a link to the full module. USD shows whenever the
// card has any USD activity (bimoneda por defecto), with ceros when the section
// itself has none — consistent with the total.
const Section = ({
  icon,
  iconClassName,
  label,
  hint,
  ars,
  usd,
  showUsd,
  items,
  href,
  linkLabel,
}: {
  icon: React.ReactNode
  iconClassName: string
  label: string
  hint: string
  ars: number
  usd: number
  showUsd: boolean
  items: CommittedItem[]
  href: string
  linkLabel: string
}) => (
  <div className="mt-4">
    <div className="flex items-start gap-2.5 border-b border-border-soft pb-2.5">
      <span
        className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg text-white', iconClassName)}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 pt-0.5 text-[13px] font-bold leading-tight text-text">
        {label}
        <span className="font-medium text-text-soft"> · {hint}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-extrabold tracking-tight tabular-nums text-text">
          <MaskedAmount amount={ars} currency="ARS" />
        </span>
        {showUsd && (
          <span className="block text-[11px] font-bold tabular-nums text-text-soft">
            <span className="text-emerald-deep">USD</span>{' '}
            <MaskedAmount amount={usd} currency="USD" showCentsOverride />
          </span>
        )}
      </span>
    </div>

    {items.length > 0 && (
      <ul className="mt-1">
        {items.map((it, i) => (
          <li key={`${it.description}-${it.date}-${i}`} className="flex items-center gap-2.5 py-1.5">
            <span className="w-9 shrink-0 text-[11px] font-bold tabular-nums text-text-soft">
              {ddmm(it.date)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
              {it.description || '—'}
            </span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-text">
              <MaskedAmount amount={it.amount} currency="ARS" />
            </span>
          </li>
        ))}
      </ul>
    )}

    <Link
      href={href}
      className="mt-1 inline-block rounded text-[12px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {linkLabel} →
    </Link>
  </div>
)

// "Comprometido" — COMPROMISO lens ("obligaciones pendientes"): card debt
// ("A pagar" + "En curso") + recurrences pending confirmation, each as a section
// with its top movements. A "Ya entra" band closes the card when there is
// recurring income (context, never summed). Static "from today": it does NOT
// follow the month navigator. Server-rendered; amounts mask via client leaves.
export const CommittedSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.committed')
  const ars = data.ARS
  const usd = data.USD
  const totalArs = committedTotal(ars)
  const totalUsd = committedTotal(usd)
  const showUsd = totalUsd > 0
  const hasIncome = ars.recurringIncome > 0
  const net = ars.recurringIncome - totalArs
  const surplus = net >= 0
  const hasOverdue = ars.overdue > 0

  if (isEmpty(data)) {
    return (
      <Card className="flex min-h-[15rem] flex-col">
        <CardHeader className="gap-0.5">
          <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
          <p className="truncate text-[12.5px] text-text-soft">{t('question')}</p>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-text-muted">{t('empty')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex min-h-[15rem] flex-col">
      <CardHeader className="gap-0.5">
        <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
        <p className="truncate text-[12.5px] text-text-soft">{t('question')}</p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {/* Total a pagar — label izquierda, monto derecha (ARS + USD) en baseline. */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-text-soft">
            {t('total_label')}
          </p>
          <p className="text-right">
            <span className="block text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-none tracking-tight text-text">
              <MaskedAmountDisplay amount={totalArs} currency="ARS" />
            </span>
            {showUsd && (
              <span className="mt-1 block text-[13px] font-bold tabular-nums text-text-muted">
                <span className="text-emerald-deep">USD</span>{' '}
                <MaskedAmount amount={totalUsd} currency="USD" showCentsOverride />
              </span>
            )}
          </p>
        </div>

        {/* Aviso de vencido — sólo cuando hay deuda con vencimiento pasado. */}
        {hasOverdue && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-soft px-3 py-2 text-[12px] font-semibold text-amber-deep">
            <AlertTriangle size={15} strokeWidth={2.25} className="shrink-0" aria-hidden />
            {t.rich('overdue', {
              amount: () => (
                <strong className="font-extrabold">
                  <MaskedAmount amount={ars.overdue} currency="ARS" />
                </strong>
              ),
            })}
          </p>
        )}

        <Section
          icon={<CreditCard size={15} strokeWidth={2.25} aria-hidden />}
          iconClassName="bg-navy"
          label={t('card_label')}
          hint={t('card_hint')}
          ars={ars.debt}
          usd={usd.debt}
          showUsd={showUsd}
          items={ars.topCard}
          href="/cards"
          linkLabel={t('view_cards')}
        />

        <Section
          icon={<Repeat size={15} strokeWidth={2.25} aria-hidden />}
          iconClassName="bg-terracotta"
          label={t('recurring_label')}
          hint={t('recurring_hint')}
          ars={ars.recurringExpense}
          usd={usd.recurringExpense}
          showUsd={showUsd}
          items={ars.topRecurring}
          href="/transactions/recurring"
          linkLabel={t('view_recurring')}
        />

        {/* "Ya entra" — ingreso recurrente del mes próximo + cierre neto (contexto). */}
        {hasIncome && (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald/40 bg-emerald-soft p-3.5">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald text-white"
                aria-hidden
              >
                <ArrowUpRight size={16} strokeWidth={2.5} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-emerald-deep">{t('income_tile_title')}</p>
                <p className="truncate text-[11px] font-medium text-emerald-deep/80">
                  {t('income_tile_sub')}
                </p>
              </div>
              <span className="shrink-0 text-[16px] font-extrabold tracking-tight text-emerald-deep">
                <MaskedAmountDisplay amount={ars.recurringIncome} currency="ARS" signPrefix="+" />
              </span>
            </div>

            <p
              className={cn(
                'mt-3 rounded-2xl px-4 py-3 text-[12.5px] font-semibold leading-snug',
                surplus ? 'bg-emerald-soft text-emerald-deep' : 'bg-page text-expense',
              )}
            >
              {t.rich(surplus ? 'net_surplus' : 'net_deficit', {
                amount: () => (
                  <strong className="font-extrabold">
                    <MaskedAmountDisplay
                      amount={Math.abs(net)}
                      currency="ARS"
                      signPrefix={surplus ? '+' : undefined}
                    />
                  </strong>
                ),
              })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
