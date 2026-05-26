'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { MovementPerspective } from '@grana/money-logic'
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

type Props = {
  movements: FinancialMovement[]
  perspective: MovementPerspective
  /** Financial "today" (from getTodayAR) — used for the Hoy/Ayer group labels. */
  todayISO: string
  /** Show the account in each row's subtitle (expert mode only). */
  showAccount?: boolean
  recurrenceLinkedIds?: Set<string>
  /** Per-movement running balance snapshots (account view, no filters); null hides them. */
  runningBalances?: Map<string, Record<'ARS' | 'USD', number>> | null
}

export const MovementList = ({
  movements,
  perspective,
  todayISO,
  showAccount = false,
  recurrenceLinkedIds,
  runningBalances = null,
}: Props) => {
  const t = useTranslations('transactions')
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium text-foreground">{t('empty.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('list.global_empty_description')}</p>
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

  const grouped = new Map<string, FinancialMovement[]>()
  for (const movement of movements) {
    const existing = grouped.get(movement.date) ?? []
    existing.push(movement)
    grouped.set(movement.date, existing)
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(grouped.entries()).map(([date, dayMovements]) => (
        <section key={date}>
          <p className="mb-2 text-xs font-medium text-muted-foreground capitalize">
            {formatGroupDate(date)}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {dayMovements.map((movement) => {
              const row = (
                <MovementRow
                  movement={movement}
                  perspective={perspective}
                  showAccount={showAccount}
                  isRecurrent={recurrenceLinkedIds?.has(movement.id) ?? false}
                  runningBalanceSnapshot={runningBalances?.get(movement.id) ?? null}
                />
              )

              if (!movement.detail_href) {
                return <div key={movement.id}>{row}</div>
              }

              return (
                <Link key={movement.id} href={`${movement.detail_href}?from=${backParam}`}>
                  {row}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
