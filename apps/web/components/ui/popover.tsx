'use client'

import * as RadixPopover from '@radix-ui/react-popover'
import type { PopoverProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * Content anchored to a trigger. Built on Radix Popover, which handles the
 * anchored positioning, collision flip (bottom → top when it doesn't fit),
 * outside-click and Esc dismissal, and closing on scroll of an ancestor.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  align = 'start',
  minWidthPx = 280,
  maxWidthPx = 340,
  children,
  className,
}: PopoverProps) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          style={{ minWidth: minWidthPx, maxWidth: maxWidthPx }}
          className={cn(
            'grana-popover z-50 max-h-[60vh] overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-card p-1.5 shadow-[0_20px_50px_-12px_rgba(11,26,43,0.30)] outline-none',
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
