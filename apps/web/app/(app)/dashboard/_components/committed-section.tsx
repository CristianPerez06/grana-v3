import { ArrowUpRight, CreditCard, Repeat } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CommittedCurrency, CommittedOutlook } from '@grana/dashboard'
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

// One outflow mini-tile: icon + label (+ hint) + ARS amount, with the USD amount
// folded in right below when there's USD activity (bimoneda lives inside each
// tile, no separate strip). No bar/chart — the card communicates with tiles.
const Tile = ({
  icon,
  iconClassName,
  label,
  hint,
  amount,
  usdAmount,
}: {
  icon: React.ReactNode
  iconClassName: string
  label: string
  hint?: string
  amount: number
  usdAmount: number
}) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
    <span
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-white',
        iconClassName,
      )}
      aria-hidden
    >
      {icon}
    </span>
    <span className="text-[12px] font-bold leading-tight text-text-muted">
      {label}
      {hint && <span className="font-medium text-text-soft"> {hint}</span>}
    </span>
    <span className="text-[19px] font-extrabold tracking-tight text-text">
      <MaskedAmount amount={amount} currency="ARS" />
    </span>
    {usdAmount > 0 && (
      <span className="text-[12px] font-bold tracking-tight text-text-soft">
        <span className="text-emerald-deep">USD</span>{' '}
        <MaskedAmount amount={usdAmount} currency="USD" showCentsOverride />
      </span>
    )}
  </div>
)

// "Comprometido" — COMPROMISO lens: card debt (a present stock) + next-month
// recurring outflows shown as two tiles. When there is recurring income, a green
// "Ya entra" tile and a net closing band ("arrancás con +X a favor") appear; the
// income never sums into the committed total. Static "from today": it does NOT
// follow the month navigator. Server-rendered; amounts mask via client leaves.
export const CommittedSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.committed')
  const ars = data.ARS
  const usd = data.USD
  const totalArs = committedTotal(ars)
  const hasIncome = ars.recurringIncome > 0
  const net = ars.recurringIncome - totalArs
  const surplus = net >= 0

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
        {/* Total comprometido = lo que sale (deuda + gastos recurrentes). Label a
            la izquierda y monto a la derecha, alineados sobre la misma baseline. */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-text-soft">
            {t('total_label')}
          </p>
          <p className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-extrabold leading-none tracking-tight text-text">
            <MaskedAmountDisplay amount={totalArs} currency="ARS" />
          </p>
        </div>

        {/* "YA SALE" sub-label only when there is income to contrast it with. */}
        {hasIncome && (
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-terracotta">
            {t('outflow_label')}
          </p>
        )}

        {/* Two outflow tiles — stack on narrow viewports so the amounts fit. */}
        <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', hasIncome ? 'mt-2' : 'mt-5')}>
          <Tile
            icon={<CreditCard size={16} strokeWidth={2.25} aria-hidden />}
            iconClassName="bg-navy"
            label={t('debt')}
            amount={ars.debt}
            usdAmount={usd.debt}
          />
          <Tile
            icon={<Repeat size={16} strokeWidth={2.25} aria-hidden />}
            iconClassName="bg-terracotta"
            label={t('recurring_expense')}
            hint={t('next_month')}
            amount={ars.recurringExpense}
            usdAmount={usd.recurringExpense}
          />
        </div>

        {/* "Ya entra" — recurring income tile + net closing band (context only). */}
        {hasIncome && (
          <>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald/40 bg-emerald-soft p-4">
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
              <span className="shrink-0 text-[17px] font-extrabold tracking-tight text-emerald-deep">
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
