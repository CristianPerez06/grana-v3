'use client'

import * as RadixSwitch from '@radix-ui/react-switch'
import type { SwitchProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * iOS-style on/off switch on Radix Switch. `on` uses the emerald accent.
 * Controlled via `checked` + `onValueChange`; respects `disabled`.
 */
export function Switch({
  checked,
  onValueChange,
  disabled = false,
  ariaLabel,
  className,
}: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onValueChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-[23px] w-10 shrink-0 cursor-pointer items-center rounded-full bg-border-soft transition-colors duration-[var(--duration-fast)] outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-[state=checked]:bg-emerald disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block size-[19px] translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-[var(--duration-fast)]',
          'data-[state=checked]:translate-x-[18px]',
        )}
      />
    </RadixSwitch.Root>
  )
}
