'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// Shared selected-month state for the Compartido home. The header's navigator
// owns the interaction; "Gasto del hogar" and "Últimos movimientos" subscribe
// and refetch when the selection moves off the current month. "Qué se deben
// hoy" and "Lo que se viene" are today-anchored and never read this context
// (they stay RSC). Client-only state: not in the URL, not persisted —
// remounting the home opens on the current month. Mirrors the dashboard's
// DashboardMonthProvider (see dashboard-month-context.tsx).

export type SharedMonth = { year: number; month: number }

type SharedMonthContextValue = {
  /** Month selected in the header navigator. */
  selected: SharedMonth
  /** `YYYY-MM` form of `selected` — what the shared queries take. */
  ym: string
  /** Current month per the financial timezone (server-derived). */
  current: SharedMonth
  isCurrent: boolean
  /** Undefined when the boundary is reached (navigator disables the arrow). */
  goPrev?: () => void
  goNext?: () => void
}

const MONTHS_BACK_LIMIT = 12

const SharedMonthContext = createContext<SharedMonthContextValue | null>(null)

const diffMonths = (a: SharedMonth, b: SharedMonth) =>
  (a.year - b.year) * 12 + (a.month - b.month)

const addMonth = ({ year, month }: SharedMonth, delta: number): SharedMonth => {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

const toYm = ({ year, month }: SharedMonth): string => `${year}-${String(month).padStart(2, '0')}`

export const SharedMonthProvider = ({
  children,
  currentYear,
  currentMonth,
}: {
  children: ReactNode
  /** Current month derived server-side from `getTodayAR()`. */
  currentYear: number
  currentMonth: number
}) => {
  const current: SharedMonth = { year: currentYear, month: currentMonth }
  const [selected, setSelected] = useState<SharedMonth>(current)

  const monthsBack = diffMonths(current, selected)
  const canGoBack = monthsBack < MONTHS_BACK_LIMIT
  const canGoForward = monthsBack > 0

  const value: SharedMonthContextValue = {
    selected,
    ym: toYm(selected),
    current,
    isCurrent: monthsBack === 0,
    goPrev: canGoBack ? () => setSelected((s) => addMonth(s, -1)) : undefined,
    goNext: canGoForward ? () => setSelected((s) => addMonth(s, +1)) : undefined,
  }

  return <SharedMonthContext.Provider value={value}>{children}</SharedMonthContext.Provider>
}

export const useSharedMonth = () => {
  const ctx = useContext(SharedMonthContext)
  if (!ctx) throw new Error('useSharedMonth must be used within SharedMonthProvider')
  return ctx
}
