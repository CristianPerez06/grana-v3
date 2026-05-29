'use client'

import * as Dialog from '@radix-ui/react-dialog'
import type { DrawerProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * Side panel that slides in over a scrim. Built on Radix Dialog so focus trap,
 * Esc-to-close and focus restoration come for free. Closing on scrim click is
 * Radix's default (overlay click). The panel itself scrolls via its children.
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  widthPx = 528,
  ariaLabel,
  children,
  className,
}: DrawerProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="grana-scrim fixed inset-0 z-40 bg-[rgba(11,26,43,0.30)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-label={ariaLabel}
          style={{ width: widthPx }}
          className={cn(
            'fixed inset-y-0 z-50 flex h-full max-w-full flex-col bg-page shadow-[-24px_0_60px_-20px_rgba(11,26,43,0.30)] outline-none',
            side === 'right' ? 'right-0 grana-drawer-right' : 'left-0 grana-drawer-left',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
