'use client'

import { useState, type ReactNode } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { useTranslations } from 'next-intl'
import { Calendar } from 'lucide-react'
import { Popover } from '@/components/ui/popover'
import { formatDateISO, parseISODate, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * Single date selection that opens the **full month** in one click — no native
 * `<input type="date">` two-step. Built on the `Popover` primitive (anchored,
 * collision-flip, Esc/outside-click dismissal, `modal` for use inside a Drawer)
 * + `react-day-picker` for the month grid.
 *
 * Value contract: ISO `YYYY-MM-DD` in and out (the app's accounting-date string).
 * Conversion to/from `Date` happens only at this boundary, in local time, so the
 * day the user taps is exactly the day emitted (no UTC drift). "Today" comes from
 * the financial timezone (`getTodayAR()`), never the browser clock.
 *
 * Two trigger looks via `variant`:
 *  - `field` (default): input-like box with an optional label above.
 *  - `row`: pass your own `trigger` (e.g. the movement form's `FieldRow`).
 */
export type DatePickerProps = {
  value: string
  onChange: (iso: string) => void
  /** ISO lower bound; days before it are disabled. */
  min?: string
  /** ISO upper bound; days after it are disabled. */
  max?: string
  disabled?: boolean
  /** Propagated to the Popover — set true when rendered inside a Drawer. */
  modal?: boolean
  align?: 'start' | 'center' | 'end'
  /** Custom trigger (must forward ref). When set, `variant`/`label` are ignored. */
  trigger?: ReactNode
  /** Label rendered above the built-in field trigger. */
  label?: string
  /** Placeholder shown by the built-in field trigger when empty. */
  placeholder?: string
  id?: string
  /** Extra classes for the built-in field trigger button. */
  className?: string
  /** Render the value as `dd/mm/aa` instead of `29 jun 2026` — for tight inline boxes. */
  compact?: boolean
  /** When set, renders a footer action inside the popover that clears the value
   *  (e.g. "Sin fecha de fin"). `clearLabel` is required for it to render. */
  onClear?: () => void
  clearLabel?: string
}

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const compactFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  modal = false,
  align = 'start',
  trigger,
  label,
  placeholder,
  id,
  className,
  compact = false,
  onClear,
  clearLabel,
}: DatePickerProps) {
  const t = useTranslations('common')
  const [open, setOpen] = useState(false)

  const selected = parseISODate(value)
  const today = parseISODate(todayISO())!

  const select = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  const disabledMatcher = [
    ...(min ? [{ before: parseISODate(min)! }] : []),
    ...(max ? [{ after: parseISODate(max)! }] : []),
  ]

  // Bound the year dropdown: explicit min/max win, else a generous window so
  // navigating a few years out stays one click away.
  const startMonth = parseISODate(min) ?? new Date(today.getFullYear() - 6, 0)
  const endMonth = parseISODate(max) ?? new Date(today.getFullYear() + 6, 11)

  const fieldTrigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-label={label ?? t('pick_date')}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-left text-sm tabular-nums text-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring enabled:hover:border-text-soft/40 disabled:cursor-default disabled:opacity-60',
        className,
      )}
    >
      <span className={cn('truncate whitespace-nowrap', !selected && 'text-text-muted')}>
        {selected ? (compact ? compactFmt : dateFmt).format(selected) : (placeholder ?? t('pick_date'))}
      </span>
      <Calendar className="size-4 shrink-0 text-text-soft" aria-hidden />
    </button>
  )

  const content = (
    <div className="grana-datepicker p-1">
      <DayPicker
        mode="single"
        locale={es}
        weekStartsOn={1}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={endMonth}
        today={today}
        defaultMonth={selected ?? today}
        selected={selected}
        onSelect={(d) => d && select(formatDateISO(d))}
        disabled={disabledMatcher}
        showOutsideDays
      />
      <button
        type="button"
        onClick={() => select(todayISO())}
        className="mt-1 w-full rounded-[10px] px-2.5 py-2 text-sm font-semibold text-text transition-colors hover:bg-page"
      >
        {t('today')}
      </button>
      {onClear && clearLabel && (
        <button
          type="button"
          onClick={() => {
            onClear()
            setOpen(false)
          }}
          className="w-full rounded-[10px] px-2.5 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-page"
        >
          {clearLabel}
        </button>
      )}
    </div>
  )

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(o) => !disabled && setOpen(o)}
      modal={modal}
      align={align}
      minWidthPx={300}
      maxWidthPx={320}
      trigger={trigger ?? fieldTrigger}
      className="grana-datepicker-popover"
    >
      {content}
    </Popover>
  )
}
