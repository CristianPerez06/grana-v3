'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

type Props = {
  year: number
  month: number
  onPrev?: () => void
  onNext?: () => void
}

const buttonClass = cn(
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors',
  'hover:bg-border-soft hover:text-text',
)

const disabledClass = 'opacity-30 cursor-not-allowed pointer-events-none'

export const MonthNavigator = ({ year, month, onPrev, onNext }: Props) => {
  const label = `${MONTH_NAMES_ES[month - 1]} ${year}`

  return (
    <div className="flex shrink-0 items-center justify-center gap-2">
      {onPrev ? (
        <button type="button" onClick={onPrev} aria-label="Mes anterior" className={buttonClass}>
          <ChevronLeft size={18} />
        </button>
      ) : (
        <span aria-hidden className={cn(buttonClass, disabledClass)}>
          <ChevronLeft size={18} />
        </span>
      )}
      <span className="min-w-[7rem] text-center text-sm font-medium uppercase tracking-wide text-text-muted">
        {label}
      </span>
      {onNext ? (
        <button type="button" onClick={onNext} aria-label="Mes siguiente" className={buttonClass}>
          <ChevronRight size={18} />
        </button>
      ) : (
        <span aria-hidden className={cn(buttonClass, disabledClass)}>
          <ChevronRight size={18} />
        </span>
      )}
    </div>
  )
}
