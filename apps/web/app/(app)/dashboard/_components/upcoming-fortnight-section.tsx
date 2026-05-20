import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Money } from '@grana/validation'
import { MaskedAmount } from './masked-amount'
import type {
  UpcomingFortnight,
  UpcomingItem,
} from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

type Props = {
  data: UpcomingFortnight
}

type TotalsByCurrency = { ARS: number; USD: number }

function sumByCurrency(items: UpcomingItem[]): TotalsByCurrency {
  let ars = Money.from(0)
  let usd = Money.from(0)
  for (const item of items) {
    if (item.currency === 'ARS') ars = Money.add(ars, Money.from(item.amount))
    else if (item.currency === 'USD') usd = Money.add(usd, Money.from(item.amount))
  }
  return { ARS: Money.toNumber(ars), USD: Money.toNumber(usd) }
}

function formatItemDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const Column = ({
  title,
  items,
  direction,
}: {
  title: string
  items: UpcomingItem[]
  direction: 'pay' | 'collect'
}) => {
  const totals = sumByCurrency(items)
  const sign = direction === 'pay' ? '−' : '+'

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted/60">—</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-border-soft"
              >
                <div className="min-w-0">
                  <span className="text-xs font-medium text-text-muted">
                    {formatItemDate(item.date)}
                  </span>
                  <span className="ml-2 truncate text-sm text-text">
                    {item.label}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-sm font-semibold tabular-nums',
                    direction === 'pay' ? 'text-text' : 'text-emerald',
                  )}
                >
                  {sign}
                  <MaskedAmount
                    amount={item.amount}
                    currency={item.currency}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div className="mt-1 border-t border-border-soft pt-2 text-xs text-text-muted">
          {totals.ARS !== 0 && (
            <div className="flex justify-between tabular-nums">
              <span>Total</span>
              <span>
                <MaskedAmount amount={totals.ARS} currency="ARS" />
              </span>
            </div>
          )}
          {totals.USD !== 0 && (
            <div className="flex justify-between tabular-nums">
              <span>{totals.ARS !== 0 ? '' : 'Total'}</span>
              <span>
                <MaskedAmount amount={totals.USD} currency="USD" showCentsOverride />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const UpcomingFortnightSection = async ({ data }: Props) => {
  const t = await getTranslations('dashboard.upcoming')
  const totalPayARS = sumByCurrency(data.toPay).ARS
  const totalPayUSD = sumByCurrency(data.toPay).USD
  const totalCollectARS = sumByCurrency(data.toCollect).ARS
  const totalCollectUSD = sumByCurrency(data.toCollect).USD

  const balanceARS = Money.toNumber(
    Money.subtract(Money.from(totalCollectARS), Money.from(totalPayARS)),
  )
  const balanceUSD = Money.toNumber(
    Money.subtract(Money.from(totalCollectUSD), Money.from(totalPayUSD)),
  )

  const hasAny = data.toPay.length > 0 || data.toCollect.length > 0

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text">{t('title')}</h2>
        <p className="text-xs text-text-muted">{t('subtitle')}</p>
      </header>

      {hasAny ? (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Column
              title={t('to_pay')}
              items={data.toPay}
              direction="pay"
            />
            <Column
              title={t('to_collect')}
              items={data.toCollect}
              direction="collect"
            />
          </div>

          <div className="mt-6 border-t border-border-soft pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t('period_balance')}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {(balanceARS !== 0 || (totalPayARS === 0 && totalCollectARS === 0)) && (
                <span
                  className={cn(
                    'text-xl font-bold tabular-nums',
                    balanceARS > 0
                      ? 'text-emerald'
                      : balanceARS < 0
                        ? 'text-negative'
                        : 'text-text',
                  )}
                >
                  {balanceARS > 0 ? '+ ' : ''}
                  <MaskedAmount amount={balanceARS} currency="ARS" />
                </span>
              )}
              {balanceUSD !== 0 && (
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    balanceUSD > 0
                      ? 'text-emerald'
                      : balanceUSD < 0
                        ? 'text-negative'
                        : 'text-text',
                  )}
                >
                  {balanceUSD > 0 ? '+ ' : ''}
                  <MaskedAmount amount={balanceUSD} currency="USD" showCentsOverride />
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">{t('empty')}</p>
      )}
    </section>
  )
}
