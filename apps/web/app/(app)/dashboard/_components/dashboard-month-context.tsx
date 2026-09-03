'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

// Shared selected-month state for the dashboard. The header's date LINE owns
// the interaction — it is the lens, and it opens the month sheet; "Balance del
// mes" and "En qué se fue" subscribe and refetch when the selection moves off
// the current month. "Para gastar" and
// "Dónde está" are today-based and never read this context. Client-only state:
// not in the URL, not persisted — remounting the dashboard opens on the
// current month (same rule the per-card navigator had).

export type DashboardMonth = { year: number; month: number }

type DashboardMonthContextValue = {
  /** Month selected in the header navigator. */
  selected: DashboardMonth
  /** Current month per the financial timezone (server-derived). */
  current: DashboardMonth
  isCurrent: boolean
  /**
   * Jump to any month. Out-of-range months are ignored rather than clamped: the
   * sheet only offers reachable ones, so a call outside the range is a bug and
   * silently landing on a different month would hide it.
   */
  goToMonth: (month: DashboardMonth) => void
}

const MONTHS_BACK_LIMIT = 12

const DashboardMonthContext = createContext<DashboardMonthContextValue | null>(null)

const diffMonths = (a: DashboardMonth, b: DashboardMonth) =>
  (a.year - b.year) * 12 + (a.month - b.month)

export const DashboardMonthProvider = ({
  children,
  currentYear,
  currentMonth,
}: {
  children: ReactNode
  /** Current month derived server-side from `getTodayAR()`. */
  currentYear: number
  currentMonth: number
}) => {
  const current: DashboardMonth = { year: currentYear, month: currentMonth }
  const [selected, setSelected] = useState<DashboardMonth>(current)

  const monthsBack = diffMonths(current, selected)

  const value: DashboardMonthContextValue = {
    selected,
    current,
    isCurrent: monthsBack === 0,
    goToMonth: (month) => {
      const back = diffMonths(current, month)
      if (back < 0 || back > MONTHS_BACK_LIMIT) return
      setSelected(month)
    },
  }

  return (
    <DashboardMonthContext.Provider value={value}>{children}</DashboardMonthContext.Provider>
  )
}

export const useDashboardMonth = () => {
  const ctx = useContext(DashboardMonthContext)
  if (!ctx) throw new Error('useDashboardMonth must be used within DashboardMonthProvider')
  return ctx
}
