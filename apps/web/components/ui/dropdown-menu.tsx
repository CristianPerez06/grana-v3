'use client'

import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Items anchored to a trigger. Built on Radix DropdownMenu so role="menu",
 * roving tabindex (↑/↓ + Enter/Space + Esc), click-outside dismissal and
 * positioning with flip are free.
 *
 * The primitive is agnostic about the trigger element: callers pass any button
 * via <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>.
 */
type DropdownMenuProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * When false, Radix skips `react-remove-scroll` and the body padding
   * compensation it applies on open — useful for kebab menus where the
   * shift can cause a parent flex-wrap layout (e.g. PageHeader) to reflow.
   */
  modal?: boolean
  children: ReactNode
}

export function DropdownMenu({ open, onOpenChange, modal, children }: DropdownMenuProps) {
  return (
    <RadixDropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {children}
    </RadixDropdownMenu.Root>
  )
}

type DropdownMenuTriggerProps = {
  asChild?: boolean
  children: ReactNode
}

export function DropdownMenuTrigger({ asChild = false, children }: DropdownMenuTriggerProps) {
  return <RadixDropdownMenu.Trigger asChild={asChild}>{children}</RadixDropdownMenu.Trigger>
}

type DropdownMenuContentProps = {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  minWidthPx?: number
  className?: string
}

export function DropdownMenuContent({
  children,
  align = 'end',
  minWidthPx = 180,
  className,
}: DropdownMenuContentProps) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        style={{ minWidth: minWidthPx }}
        className={cn(
          'grana-dropdown-menu z-50 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card p-1.5 shadow-[0_20px_50px_-12px_rgba(11,26,43,0.30)] outline-none',
          className,
        )}
      >
        {children}
      </RadixDropdownMenu.Content>
    </RadixDropdownMenu.Portal>
  )
}

type DropdownMenuItemProps = {
  children: ReactNode
  onSelect?: (event: Event) => void
  disabled?: boolean
  className?: string
}

const itemBaseClass =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm text-text outline-none transition-colors data-[highlighted]:bg-border-soft data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ children, onSelect, disabled = false, className }, ref) => {
    return (
      <RadixDropdownMenu.Item
        ref={ref}
        onSelect={onSelect}
        disabled={disabled}
        className={cn(itemBaseClass, className)}
      >
        {children}
      </RadixDropdownMenu.Item>
    )
  },
)
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuItemDestructive = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ children, onSelect, disabled = false, className }, ref) => {
    return (
      <RadixDropdownMenu.Item
        ref={ref}
        onSelect={onSelect}
        disabled={disabled}
        className={cn(
          itemBaseClass,
          'text-negative data-[highlighted]:bg-negative/10 data-[highlighted]:text-negative',
          className,
        )}
      >
        {children}
      </RadixDropdownMenu.Item>
    )
  },
)
DropdownMenuItemDestructive.displayName = 'DropdownMenuItemDestructive'

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <RadixDropdownMenu.Separator className={cn('my-1 h-px bg-border-soft', className)} />
}
