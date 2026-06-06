'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Centered modal on >= sm, bottom sheet on < sm. Built on Radix Dialog so focus
 * trap, Esc-to-close, focus restoration and outside-click are free. Callers
 * compose <DialogHeader/>, <DialogBody/>, <DialogFooter/> for structure.
 *
 * The primitive is agnostic to semantics: destructive actions are expressed by
 * the caller using <Button variant="destructive"> in the footer. Loading state
 * lives on the caller's CTA — the dialog does NOT auto-close on action; the
 * caller flips `open` to false on success and leaves it open on error so the
 * formError slot can render inline in the body.
 */
type DialogProps = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, ariaLabel, children, className }: DialogProps) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="grana-scrim fixed inset-0 z-40 bg-[rgba(11,26,43,0.30)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <RadixDialog.Content
          aria-label={ariaLabel}
          aria-describedby={undefined}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-card shadow-[0_24px_60px_-20px_rgba(11,26,43,0.30)] outline-none',
            // Mobile: bottom sheet, full width, rounded top
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl',
            // Desktop (>= sm): centered modal, fixed width, rounded all corners
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[min(440px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            className,
          )}
        >
          <RadixDialog.Title className="sr-only">{ariaLabel}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

type DialogHeaderProps = {
  children: ReactNode
  className?: string
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-6 pb-3 pt-6', className)}>
      <h2 className="text-lg font-semibold leading-tight text-text">{children}</h2>
    </div>
  )
}

type DialogBodyProps = {
  children: ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div className={cn('flex flex-col gap-3 overflow-y-auto px-6 pb-4 text-sm text-text-soft', className)}>
      {children}
    </div>
  )
}

type DialogFooterProps = {
  children: ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border-soft bg-card px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  )
}
