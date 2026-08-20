'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

type Props = {
  year: number
  month: number
  onPrev?: () => void
  onNext?: () => void
  /**
   * Squeezed variant: below `sm` the month drops to its first three letters and
   * the pill stops reserving a wide label. For the dashboard header, where the
   * selector shares its row with the greeting and there is no room for
   * "Septiembre 2026". From `sm` up it is the normal pill again.
   */
  responsive?: boolean
}

const buttonClass = cn(
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-text-muted transition-colors',
  'hover:bg-border-soft hover:text-text',
)

const disabledClass = 'opacity-30 cursor-not-allowed pointer-events-none'

// Header month selector ("monthsel" in the design handoff): a white bordered
// pill containing the two arrows and a bold capitalized label.
export const MonthNavigator = ({ year, month, onPrev, onNext, responsive = false }: Props) => {
  const name = MONTH_NAMES_ES[month - 1]!
  const label = `${name} ${year}`
  const shortLabel = `${name.slice(0, 3)} ${year}`

  return (
    <div className="flex shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-card p-1">
      {onPrev ? (
        <button type="button" onClick={onPrev} aria-label="Mes anterior" className={buttonClass}>
          <ChevronLeft size={16} />
        </button>
      ) : (
        <span aria-hidden className={cn(buttonClass, disabledClass)}>
          <ChevronLeft size={16} />
        </span>
      )}
      <span
        className={cn(
          'flex-1 whitespace-nowrap text-center text-sm font-bold text-text',
          responsive ? 'px-1 sm:min-w-[6.5rem] sm:px-0' : 'min-w-[6.5rem]',
        )}
      >
        {responsive ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
      {onNext ? (
        <button type="button" onClick={onNext} aria-label="Mes siguiente" className={buttonClass}>
          <ChevronRight size={16} />
        </button>
      ) : (
        <span aria-hidden className={cn(buttonClass, disabledClass)}>
          <ChevronRight size={16} />
        </span>
      )}
    </div>
  )
}
