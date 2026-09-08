import { createContext, useContext, useState, type ReactNode } from 'react'

// Shared selected-month state for the dashboard — mirror of the web
// DashboardMonthProvider (same contract). The header's MonthNavigator owns the
// interaction; "Balance del mes" and "En qué se fue" subscribe. "Para gastar"
// and "Dónde está" are today-based and never read this context. The provider
// remounts when the tab loses focus (same key mechanism as EyeMaskProvider),
// so returning to the dashboard always opens on the current month.

export type DashboardMonth = { year: number; month: number }

type DashboardMonthContextValue = {
  /** Month selected in the header navigator. */
  selected: DashboardMonth
  /** Current month per the financial timezone. */
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
  /** Current month derived from `getTodayAR()` in the screen shell. */
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
