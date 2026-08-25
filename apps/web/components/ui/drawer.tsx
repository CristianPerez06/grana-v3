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
 * Sliding panel over a scrim, presented two ways:
 *
 * - **`md` and up** — a full-height side panel anchored to `side`, `widthPx` wide.
 * - **Below `md`** — a bottom sheet: full width, anchored to the bottom edge,
 *   hugging its content up to 90dvh, mirroring native's `BottomSheet`.
 *
 * The switch is internal on purpose. `DrawerProps` does not change and no
 * consumer passes anything new: `side` and `widthPx` are simply inert below
 * `md`. That is what keeps all seventeen call sites untouched.
 *
 * Built on Radix Dialog so focus trap, Esc-to-close and focus restoration come
 * for free. Closing on scrim click is Radix's default (overlay click). The panel
 * itself scrolls via its children.
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
          // A CSS variable rather than `width`, because an inline width would
          // beat the media query and leave the sheet 528px wide on a phone.
          style={{ '--drawer-width': `${widthPx}px` } as React.CSSProperties}
          className={cn(
            'fixed z-50 flex max-w-full flex-col overflow-hidden bg-page outline-none',
            // Below `md`: bottom sheet. `max-h` bounds the panel so the
            // consumer's `min-h-0 flex-1` body still gets a scroll region once
            // the content outgrows the screen.
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[20px] shadow-[0_-24px_60px_-20px_rgba(11,26,43,0.30)]',
            // `md` and up: the side panel, unchanged.
            'md:inset-y-0 md:bottom-auto md:h-dvh md:max-h-none md:w-[var(--drawer-width)] md:rounded-none md:shadow-[-24px_0_60px_-20px_rgba(11,26,43,0.30)]',
            side === 'right'
              ? 'md:right-0 md:left-auto grana-drawer-right'
              : 'md:left-0 md:right-auto grana-drawer-left',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          {/* Grab handle: the affordance that says "this came from the bottom
              and can be dismissed". Decorative — dragging is not wired up, and
              the scrim plus Esc already close the sheet. */}
          <div aria-hidden className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <DrawerContainerContext.Provider value={panel}>
            {children}
          </DrawerContainerContext.Provider>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
