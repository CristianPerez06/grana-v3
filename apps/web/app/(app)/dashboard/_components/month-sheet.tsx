'use client'

import { useTranslations } from 'next-intl'
import type { MonthSheetProps } from '@grana/ui-contracts'
import { Drawer } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

/**
 * The sheet the header's date line opens to choose which month the dashboard is
 * read from.
 *
 * Built on `Drawer`, which below `md` already presents itself as a bottom sheet
 * and brings the focus trap, Esc-to-close, scrim-click and focus restoration
 * from Radix Dialog. Dismissing never changes the selection: only `onSelect`
 * does, and it is only reachable from a month button.
 *
 * Out-of-range months are rendered DISABLED, never dropped. That is the whole
 * point of the grid: the rule — nothing in the future, twelve months back — is
 * seen at a glance instead of being discovered by tapping a control that does
 * nothing. A ragged grid with the unreachable months missing would explain
 * nothing and read as an accident.
 */
export const MonthSheet = ({ open, years, selected, onSelect, onDismiss }: MonthSheetProps) => {
  const t = useTranslations('dashboard.month_lens')

  return (
    <Drawer open={open} onClose={onDismiss} ariaLabel={t('sheet_title')}>
      <div className="flex flex-col gap-4 p-5">
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
    </Drawer>
  )
}
