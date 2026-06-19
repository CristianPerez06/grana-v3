import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CommittedCurrency, CommittedOutlook } from '@grana/dashboard'
import { MaskedAmount } from './masked-amount'
import { MaskedAmountDisplay } from './masked-amount-display'

type Props = {
  data: CommittedOutlook
}

const ROW_TONE = {
  debt: 'bg-navy',
  recurringExpense: 'bg-terracotta',
  recurringIncome: 'bg-emerald',
} as const

const Row = ({
  label,
  hint,
  amount,
  tone,
  currency,
}: {
  label: string
  hint?: string
  amount: number
  tone: keyof typeof ROW_TONE
  currency: 'ARS' | 'USD'
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="flex items-center gap-2 text-[13.5px] font-semibold text-text-muted">
      <span aria-hidden className={cn('size-[9px] rounded-full', ROW_TONE[tone])} />
      {label}
      {hint && <span className="text-[12px] font-medium text-text-soft">{hint}</span>}
    </span>
    <span className="text-[14.5px] font-extrabold tracking-tight text-text">
      <MaskedAmount amount={amount} currency={currency} showCentsOverride={currency === 'USD'} />
    </span>
  </div>
)

const committedTotal = (c: CommittedCurrency) => c.debt + c.recurringExpense

const isEmpty = (data: CommittedOutlook) =>
  committedTotal(data.ARS) === 0 &&
  committedTotal(data.USD) === 0 &&
  data.ARS.recurringIncome === 0 &&
  data.USD.recurringIncome === 0

// "Lo que se viene" — COMPROMISO lens: card debt (a present stock) + next-month
// recurring outflows, with recurring income shown as context. Static "from
// today": it does NOT follow the month navigator. Server-rendered; amounts mask
// via the client MaskedAmount leaf.
export const CommittedSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.committed')
  const ars = data.ARS
  const usd = data.USD
  const totalArs = committedTotal(ars)

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
        {/* Total comprometido = lo que sale (deuda + gastos recurrentes) */}
        <p className="text-xs font-extrabold uppercase tracking-wide text-text-soft">
          {t('total_label')}
        </p>
        <p className="mt-1.5 text-[clamp(1.625rem,3.4vw,2.125rem)] font-extrabold leading-none tracking-tight text-text">
          <MaskedAmountDisplay amount={totalArs} currency="ARS" />
        </p>

        <div className="mt-5 flex flex-col gap-3.5">
          <Row label={t('debt')} amount={ars.debt} tone="debt" currency="ARS" />
          <Row
            label={t('recurring_expense')}
            hint={t('next_month')}
            amount={ars.recurringExpense}
            tone="recurringExpense"
            currency="ARS"
          />
        </div>

        {/* Ingresos recurrentes — contexto ("lo que entra"), NO suma al total. */}
        {ars.recurringIncome > 0 && (
          <div className="mt-4 border-t border-border-soft pt-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-soft">
              {t('income_context')}
            </p>
            <Row
              label={t('recurring_income')}
              hint={t('next_month')}
              amount={ars.recurringIncome}
              tone="recurringIncome"
              currency="ARS"
            />
          </div>
        )}

        {/* USD strip — bimoneda por defecto; ceros cuando no hay actividad USD. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-3.5">
          <span className="rounded-full bg-emerald-soft px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-deep">
            USD
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-text">
            <MaskedAmount amount={committedTotal(usd)} currency="USD" showCentsOverride />
          </span>
          <span className="ml-auto text-[12.5px] font-semibold text-text-muted">
            {t('debt')} <MaskedAmount amount={usd.debt} currency="USD" showCentsOverride />
            {' · '}
            {t('recurring_expense')}{' '}
            <MaskedAmount amount={usd.recurringExpense} currency="USD" showCentsOverride />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
