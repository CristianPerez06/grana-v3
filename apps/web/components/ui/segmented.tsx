'use client'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { SegmentedProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * Single-select segmented control on Radix ToggleGroup. The active option gets
 * an elevated white surface; disabled options never become active. ToggleGroup
 * `type="single"` guarantees exactly one value and ignores deselection clicks.
 */
export function Segmented({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
}: SegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(next) => {
        // ToggleGroup emits '' when the active item is re-clicked; keep the
        // current selection (a segmented control always has one active option).
        if (next) onValueChange(next)
      }}
      className={cn(
        'flex w-full items-center gap-1 rounded-[var(--radius-lg)] bg-[#EEF1F5] p-1',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'flex-1 cursor-pointer rounded-[10px] px-3 py-1.5 text-sm font-bold text-text-muted transition-colors duration-[var(--duration-fast)]',
            'data-[state=on]:bg-card data-[state=on]:text-text data-[state=on]:shadow-[0_1px_3px_rgba(11,26,43,0.10),0_0_0_0.5px_rgba(11,26,43,0.04)]',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
