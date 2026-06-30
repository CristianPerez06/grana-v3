'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { createContext, useContext, useState } from 'react'
import type { DrawerProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * The drawer's scrollable panel element. Radix Dialog (modal) locks page scroll
 * via `react-remove-scroll`, which only permits wheel/touch scrolling INSIDE the
 * locked content subtree. A child Popover portal'd to `document.body` (the Radix
 * default) lands outside it, so its list can't be scrolled with the wheel. Such
 * popovers read this context and portal their content into the panel instead, so
 * the scroll-lock allows them — see `BankSelector`. Null when not inside a Drawer.
 */
const DrawerContainerContext = createContext<HTMLElement | null>(null)
export const useDrawerContainer = () => useContext(DrawerContainerContext)

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
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
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
          ref={setPanel}
          aria-label={ariaLabel}
          aria-describedby={undefined}
          style={{ width: widthPx }}
          className={cn(
            'fixed inset-y-0 z-50 flex h-dvh max-w-full flex-col overflow-hidden bg-page shadow-[-24px_0_60px_-20px_rgba(11,26,43,0.30)] outline-none',
            side === 'right' ? 'right-0 grana-drawer-right' : 'left-0 grana-drawer-left',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          <DrawerContainerContext.Provider value={panel}>
            {children}
          </DrawerContainerContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
