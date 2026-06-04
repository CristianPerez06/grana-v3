'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { buildCategorySlices, type CategorySliceInput } from '@grana/money-logic'
import { UNCATEGORIZED_ID, type MonthCategoryBreakdown } from '@grana/dashboard'
import { getMonthCategoryBreakdownAction } from '@/app/_actions/queries'
import { translateCategoryLabel } from '@/lib/categories/display'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { useDashboardMonth } from './dashboard-month-context'
import { MaskedAmount } from './masked-amount'
import { SpendingDonut, sliceColor } from './spending-donut'
import { SpendingBodySkeleton } from './spending-skeleton'

// The handoff shows 5 named slices; the tail aggregates into "Otros".
const TOP_N = 5

type Props = {
  /** Current-month breakdown, server-rendered by the container. */
  initialData: MonthCategoryBreakdown
}

type Currency = 'ARS' | 'USD'

const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

// "En qué se fue" — month spending by category: SVG donut + legend with
// amounts, ARS/USD segmented toggle (both currencies arrive in one payload, so
// toggling never refetches). Follows the header's shared month selection.
export const SpendingSection = ({ initialData }: Props) => {
  const t = useTranslations('dashboard.spending')
  const tTx = useTranslations('transactions')
  const tRoot = useTranslations()
  const tError = useTranslations('error')

  const { selected, isCurrent } = useDashboardMonth()
  const [currency, setCurrency] = useState<Currency>('ARS')

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'category-breakdown', selected.year, selected.month],
    queryFn: () => getMonthCategoryBreakdownAction(monthKey(selected.year, selected.month)),
    // The current month is server-rendered by the container; other months
    // start empty and show the in-card skeleton while they fetch.
    initialData: isCurrent ? initialData : undefined,
    staleTime: 60_000,
  })

  // Relabel (uncategorized sentinel + system categories) before slicing, same
  // as the Movimientos breakdown, so both screens speak identical labels.
  const breakdown = useMemo(() => {
    if (!data) return null
    const relabel = (inputs: CategorySliceInput[]): CategorySliceInput[] =>
      inputs.map((i) =>
        i.categoryId === UNCATEGORIZED_ID
          ? { ...i, label: tTx('spending.uncategorized') }
          : {
              ...i,
              label:
                translateCategoryLabel(
                  i.label,
                  i.canonicalName ?? null,
                  i.isSystem ?? false,
                  tRoot,
                ) ?? i.label,
            },
      )
    return buildCategorySlices(relabel(data[currency]), {
      topN: TOP_N,
      othersLabel: tTx('spending.others'),
    })
  }, [data, currency, tTx, tRoot])

  // Rows and "Ver desglose" land on /transactions, which opens with the full
  // month breakdown. No query params: the route's filters live in React state
  // by design (see AGENTS.md) and do not hydrate from the URL.
  const breakdownHref = '/transactions'

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-lg font-semibold text-text">{t('title')}</h2>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={breakdownHref}
            className="text-[13px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t('view_all')}
          </Link>
          <Segmented
            value={currency}
            onValueChange={(next) => setCurrency(next as Currency)}
            options={[
              { value: 'ARS', label: 'ARS' },
              { value: 'USD', label: 'USD' },
            ]}
            ariaLabel={t('title')}
            className="w-auto shrink-0"
          />
        </div>
      </CardHeader>

      {/* Swappable region with a stable minimum height (no layout shift). */}
      <CardContent className="flex flex-1 flex-col">
        {isError ? (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-text-muted">{t('error')}</p>
            <Button
              variant="secondary"
              size="sm"
              className="w-auto px-4"
              onPress={() => void refetch()}
            >
              {tError('retry_action')}
            </Button>
          </div>
        ) : isPending || breakdown === null ? (
          <div aria-busy="true" aria-label={t('loading')}>
            <SpendingBodySkeleton />
          </div>
        ) : breakdown.slices.length === 0 ? (
          <div className="flex min-h-[12rem] flex-1 items-center justify-center text-center">
            <p className="text-sm text-text-muted">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid min-h-[12rem] grid-cols-1 items-center justify-items-center gap-6 sm:grid-cols-[150px_1fr] sm:gap-7 sm:justify-items-stretch">
            <SpendingDonut
              slices={breakdown.slices}
              total={breakdown.total}
              currency={currency}
              centerLabel={t('center_label')}
            />
            <ul className="flex w-full flex-col gap-3">
              {breakdown.slices.map((slice, index) => (
                <li key={slice.categoryId ?? `otros-${index}`}>
                  <Link
                    href={breakdownHref}
                    className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: sliceColor(slice, index) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                      {slice.label}
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tracking-tight text-text">
                      <MaskedAmount amount={slice.value} currency={currency} />
                    </span>
                    <span
                      className={cn(
                        'w-[34px] shrink-0 text-right text-xs font-bold text-text-soft',
                      )}
                    >
                      {Math.round(slice.percentage)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
