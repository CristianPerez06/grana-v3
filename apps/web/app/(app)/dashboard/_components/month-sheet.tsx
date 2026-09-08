'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { MonthSheetProps } from '@grana/ui-contracts'
import { Drawer } from '@/components/ui/drawer'
import { Popover } from '@/components/ui/popover'
import { useIsMobile } from '@/lib/use-is-mobile'
import { cn } from '@/lib/utils'

type Props = MonthSheetProps & {
  /** The date line. Radix anchors the desktop popover to it. */
  trigger: ReactNode
}

/**
 * The surface the header's date line opens to choose which month the dashboard
 * is read from. Two presentations, because a month grid is a picker and a
 * picker belongs next to what it changes:
 *
 * - **`md` and up** — a popover anchored under the date line. Radix handles the
 *   collision flip, outside-click and Esc.
 * - **Below `md`** — the `Drawer`, which at that width already presents itself
 *   as a bottom sheet, mirroring native.
 *
 * The first version used `Drawer` at every width, and on desktop that meant a
 * full-height side panel for twenty-six small buttons — the weight of a form
 * for the weight of a date picker.
 *
 * Dismissing never changes the selection: only `onSelect` does, and it is only
 * reachable from a month button.
 *
 * Out-of-range months render DISABLED, never dropped. That is the point of the
 * grid: the rule — nothing in the future, twelve months back — is seen at a
 * glance instead of being discovered by tapping a control that does nothing. A
 * ragged grid with the unreachable months missing would explain nothing.
 */
export const MonthSheet = ({
  open,
  years,
  selected,
  onSelect,
  onDismiss,
  trigger,
}: Props) => {
  const t = useTranslations('dashboard.month_lens')
  const isMobile = useIsMobile()

  const grid = (
    <div className="flex flex-col gap-4">
      <h2 className="text-[15px] font-extrabold tracking-tight text-text">{t('sheet_title')}</h2>

      {years.map((year) => (
        <div key={year.year} className="flex flex-col gap-2">
          <p className="text-[11px] font-medium tracking-[0.1em] text-text-soft">{year.year}</p>
          <div className="grid grid-cols-4 gap-2">
            {year.months.map((month) => {
              const isSelected = month.year === selected.year && month.month === selected.month
              return (
                <button
                  key={month.month}
                  type="button"
                  disabled={!month.reachable}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onSelect({ year: month.year, month: month.month })}
                  className={cn(
                    'rounded-[10px] border py-2.5 text-[13px] font-bold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'border-navy bg-navy text-white'
                      : 'border-border bg-page text-text hover:bg-border-soft',
                    // Disabled, not absent — and `pointer-events-none` so the
                    // hover state never suggests otherwise.
                    !month.reachable && 'pointer-events-none opacity-30',
                  )}
                >
                  {month.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* The offset of the Comprometido card has no other surface that can
          explain it at the moment it matters. */}
      <p className="text-[11.5px] leading-snug text-text-soft">{t('committed_note')}</p>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onClose={onDismiss} ariaLabel={t('sheet_title')}>
          <div className="p-5">{grid}</div>
        </Drawer>
      </>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
      trigger={trigger}
      align="start"
      minWidthPx={300}
      maxWidthPx={340}
      className="p-4"
    >
      {grid}
    </Popover>
  )
}
