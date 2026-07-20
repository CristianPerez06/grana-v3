'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getSharedExpenses } from '@/lib/shared/queries'
import type { SharedExpenseItem } from '@/lib/shared/types'
import { translateCategoryLabel, translateSubcategoryLabel } from '@/lib/categories/display'
import { Card } from '@/components/ui/card'
import { fmtMoney } from '../../_components/money'
import { useSharedMonth } from './shared-month-context'
import { monthLabel } from './format'
import { RecentSkeleton } from './recent-skeleton'

type Props = {
  /** Current-month shared expenses, server-rendered by the container. */
  initialData: SharedExpenseItem[]
  /** Today's accounting date `YYYY-MM-DD` (month-invariant). */
  todayISO: string
  /** Current user id (month-invariant). */
  userId: string
}

// "Últimos movimientos" — the shared movement log for the month selected in the
// header navigator, grouped by date (Hoy / Ayer / día) like the canonical
// MovementList. The current month is server-rendered (seeded); other months
// fetch client-side with an in-card skeleton, so the page never navigates.
export const RecentSection = ({ initialData, todayISO, userId }: Props) => {
  const t = useTranslations('shared')
  const tRoot = useTranslations()
  const tError = useTranslations('error')
  const { selected, ym, isCurrent } = useSharedMonth()

  const { data: expenses, isPending, isError, refetch } = useQuery({
    queryKey: ['shared', 'expenses', selected.year, selected.month],
    queryFn: () => getSharedExpenses(createClient(), { month: ym }),
    initialData: isCurrent ? initialData : undefined,
    staleTime: 60_000,
  })

  const yesterdayISO = (() => {
    const [y, m, d] = todayISO.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${dt.getFullYear()}-${mm}-${dd}`
  })()
  const currentMonthYm = todayISO.slice(0, 7)
  const formatGroupDate = (dateStr: string): string => {
    if (dateStr === todayISO) return tRoot('transactions.list.today')
    if (dateStr === yesterdayISO) return tRoot('transactions.list.yesterday')
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
        {t('dashboard.recent_title')}
      </h2>
      {isPending ? (
        <RecentSkeleton />
      ) : isError ? (
        <Card className="flex flex-col items-center gap-3 border-dashed p-6 text-center text-sm text-text-muted">
          {tError('generic_title')}
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full bg-border-soft px-4 py-1.5 text-sm font-bold text-text transition-colors hover:bg-border"
          >
            {tError('retry_action')}
          </button>
        </Card>
      ) : expenses.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-sm text-text-muted">
          {t('dashboard.empty')}
        </Card>
      ) : (
        <Card asChild>
          <div className="flex flex-col">
            {groupByDate(expenses).map(([groupDate, groupExpenses], groupIndex) => (
              <section
                key={groupDate}
                className={groupIndex === 0 ? '' : 'border-t border-border-soft pt-3 mt-3'}
              >
                <p className="px-4 pb-2 pt-3 text-[12px] font-extrabold capitalize text-text-muted">
                  {formatGroupDate(groupDate)}
                </p>
                <ul className="flex flex-col divide-y divide-border-soft">
                  {groupExpenses.map((e) => {
                    const categoryLabel = translateCategoryLabel(
                      e.categoryName,
                      e.categoryCanonicalName,
                      e.categoryIsSystem,
                      tRoot,
                    )
                    const subcategoryLabel = translateSubcategoryLabel(
                      e.subcategoryName,
                      e.subcategoryCanonicalName,
                      e.subcategoryIsSystem,
                      tRoot,
                    )
                    const primary = e.description || categoryLabel || t('split.shared_label')
                    const taxonomy =
                      categoryLabel && subcategoryLabel
                        ? `${categoryLabel} › ${subcategoryLabel}`
                        : categoryLabel ?? subcategoryLabel
                    const isReimb = e.kind === 'reimbursement'
                    const received = e.reimbursementState === 'received'
                    const color = e.categoryColor ?? '#8A94A3'
                    const amountTone = isReimb
                      ? received
                        ? 'text-income'
                        : 'text-pending'
                      : 'text-expense'
                    const sign = isReimb ? (received ? '+' : '') : '−'
                    const showShare = Math.abs(e.ownShare - e.amount) > 0.005
                    const futureImpact =
                      e.kind === 'expense' &&
                      e.dueDate != null &&
                      e.dueDate.slice(0, 7) > currentMonthYm
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/transactions/${e.id}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-xl text-base"
                              style={{ backgroundColor: `${color}1A` }}
                              aria-hidden
                            >
                              {e.categoryIcon ?? '🧾'}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-extrabold leading-tight text-text">
                                  {primary}
                                </span>
                                {e.reimbursementState && (
                                  <span
                                    className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                                      e.reimbursementState === 'received'
                                        ? 'bg-green-100 text-green-800'
                                        : e.reimbursementState === 'cancelled'
                                          ? 'bg-muted text-muted-foreground line-through'
                                          : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {tRoot(`transactions.reimbursement.state.${e.reimbursementState}`)}
                                  </span>
                                )}
                                {futureImpact && (
                                  <span className="inline-flex shrink-0 items-center rounded-md bg-slate-soft px-1.5 py-0.5 text-[11px] font-medium text-slate">
                                    {t('dashboard.impacts_in', { month: monthLabel(e.dueDate!.slice(0, 7)) })}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 truncate text-xs text-text-muted">
                                {taxonomy ? `${taxonomy} · ` : ''}
                                {e.payerId === userId
                                  ? t('dashboard.paid_by_you')
                                  : t('dashboard.paid_by', { name: e.payerName })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`block text-[14px] font-extrabold tabular-nums ${amountTone}`}>
                              {sign}
                              {fmtMoney(e.amount, e.currencyCode)}
                            </span>
                            {showShare && (
                              <span className="text-[11px] text-text-muted">
                                {t('dashboard.your_share', { amount: fmtMoney(e.ownShare, e.currencyCode) })}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}

// Group the first 8 expenses by date, preserving the desc-by-date order the
// query already returns.
const groupByDate = (expenses: SharedExpenseItem[]): [string, SharedExpenseItem[]][] => {
  const groups = new Map<string, SharedExpenseItem[]>()
  for (const e of expenses.slice(0, 8)) {
    const existing = groups.get(e.date) ?? []
    existing.push(e)
    groups.set(e.date, existing)
  }
  return Array.from(groups.entries())
}
