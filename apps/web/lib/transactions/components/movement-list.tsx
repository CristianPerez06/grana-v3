'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { MovementPerspective } from '@grana/money-logic'
import { Button } from '@/components/ui/button'
import type { FinancialMovement } from '../movements'
import { MovementRow } from './movement-row'

/** Date arithmetic on an ISO day string (no timezone "today" — `todayISO` is provided). */
const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Why the list is empty + the relevant action callbacks. Absent ⇒ 'none'. */
export type MovementEmptyState = {
  variant: 'none' | 'search' | 'filter'
  /** Click handler for the "register first movement" CTA — typically opens the create drawer. */
  onAdd?: () => void
  /** Callback that clears the search ('search') or the filters ('filter'). */
  onClear?: () => void
  /** The active search term, for the 'search' message. */
  query?: string
  /**
   * Optional overrides for the 'none' variant copy. Set by the page when it
   * resolves between welcome (first time ever) and month-vacío (history
   * elsewhere). When absent, the component falls back to the generic 'none'
   * strings.
   */
  title?: string
  body?: string
  cta?: string
}

type Props = {
  movements: FinancialMovement[]
  perspective: MovementPerspective
  /** Financial "today" (from getTodayAR) — used for the Hoy/Ayer group labels. */
  todayISO: string
  /** Show the account in each row's subtitle (only when the user has multiple accounts). */
  showAccount?: boolean
  recurrenceLinkedIds?: Set<string>
  /** Per-movement running balance snapshots (account view, no filters); null hides them. */
  runningBalances?: Map<string, Record<'ARS' | 'USD', number>> | null
  /** Per-movement installment chip labels (e.g. "Cuota 2 de 6"), keyed by id. */
  installmentChips?: Map<string, string>
  /** Render the installment chip on a separate line below the subtitle (card statement layout). */
  installmentChipBelow?: boolean
  /** Group rows under date headers (Hoy / Ayer / weekday). Off for single-period views like card statements. */
  groupByDate?: boolean
  /** Empty-state reason + actions. Absent ⇒ generic "no movements". */
  emptyState?: MovementEmptyState
}

export const MovementList = ({
  movements,
  perspective,
  todayISO,
  showAccount = false,
  recurrenceLinkedIds,
  runningBalances = null,
  installmentChips,
  installmentChipBelow = false,
  groupByDate = true,
  emptyState,
}: Props) => {
  const t = useTranslations('transactions')
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  if (movements.length === 0) {
    const variant = emptyState?.variant ?? 'none'
    const containerClass = 'rounded-lg border border-dashed border-border p-12 text-center'
    const clearClass = 'mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline'

    const renderClearAction = (label: string) => {
      if (!emptyState?.onClear) return null
      return (
        <div>
          <button type="button" onClick={emptyState.onClear} className={clearClass}>
            {label}
          </button>
        </div>
      )
    }

    if (variant === 'search') {
      return (
        <div className={containerClass}>
          <p className="text-sm font-medium text-foreground">{t('empty.search_title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('empty.search_description', { query: emptyState?.query ?? '' })}
          </p>
          {renderClearAction(t('empty.clear_search'))}
        </div>
      )
    }

    if (variant === 'filter') {
      return (
        <div className={containerClass}>
          <p className="text-sm font-medium text-foreground">{t('empty.filter_title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('empty.filter_description')}</p>
          {renderClearAction(t('empty.clear_filters'))}
        </div>
      )
    }

    const noneTitle = emptyState?.title ?? t('empty.title')
    const noneBody = emptyState?.body ?? t('list.global_empty_description')
    const noneCta = emptyState?.cta ?? t('empty.cta')
    return (
      <div className={containerClass}>
        <p className="text-sm font-medium text-foreground">{noneTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{noneBody}</p>
        {emptyState?.onAdd && (
          <div className="mt-4 flex justify-center">
            <Button size="sm" className="w-auto" onClick={emptyState.onAdd}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              {noneCta}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const yesterdayISO = addDaysISO(todayISO, -1)
  const formatGroupDate = (dateStr: string) => {
    if (dateStr === todayISO) return t('list.today')
    if (dateStr === yesterdayISO) return t('list.yesterday')
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(localeCode, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const backParam =
    perspective.kind === 'account' ? `account:${perspective.accountId}` : 'transactions'

  const renderRow = (movement: FinancialMovement, rowIndex: number) => {
    const row = (
      <MovementRow
        movement={movement}
        perspective={perspective}
        showAccount={showAccount}
        isRecurrent={recurrenceLinkedIds?.has(movement.id) ?? false}
        runningBalanceSnapshot={runningBalances?.get(movement.id) ?? null}
        installmentChip={installmentChips?.get(movement.id) ?? null}
        installmentChipBelow={installmentChipBelow}
      />
    )
    const wrapperCls = rowIndex === 0 ? '' : 'border-t border-border-soft'
    if (!movement.detail_href) {
      return (
        <div key={movement.id} className={wrapperCls}>
          {row}
        </div>
      )
    }
    return (
      <Link
        key={movement.id}
        href={`${movement.detail_href}?from=${backParam}`}
        className={wrapperCls}
      >
        {row}
      </Link>
    )
  }

  if (!groupByDate) {
    return <div className="flex flex-col">{movements.map(renderRow)}</div>
  }

  const grouped = new Map<string, FinancialMovement[]>()
  for (const movement of movements) {
    const existing = grouped.get(movement.date) ?? []
    existing.push(movement)
    grouped.set(movement.date, existing)
  }

  return (
    <div className="flex flex-col">
      {Array.from(grouped.entries()).map(([date, dayMovements], dayIndex) => (
        <section
          key={date}
          className={dayIndex === 0 ? '' : 'border-t border-border-soft pt-3 mt-3'}
        >
          <p className="px-4 pb-2 text-[12px] font-extrabold capitalize text-muted-foreground">
            {formatGroupDate(date)}
          </p>
          <div className="flex flex-col">{dayMovements.map(renderRow)}</div>
        </section>
      ))}
    </div>
  )
}
