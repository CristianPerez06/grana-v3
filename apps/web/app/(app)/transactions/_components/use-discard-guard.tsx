'use client'

import { useCallback, useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'

/**
 * Guards a drawer close against losing unsaved form edits.
 *
 * The host is the single funnel for every close path — the form's ✕ calls the
 * host's `onClose`, and Radix routes Esc and scrim clicks to that same handler —
 * so wrapping it once here covers all three. The form only reports whether it is
 * dirty (`onDirtyChange`); it does not own the confirmation.
 *
 * Usage:
 *   const guard = useDiscardGuard(() => setOpen(false))
 *   <Drawer onClose={guard.requestClose}>
 *     <MovementForm onClose={guard.requestClose} onDirtyChange={guard.setDirty} … />
 *   </Drawer>
 *   {guard.dialog}
 */
export const useDiscardGuard = (close: () => void) => {
  const t = useTranslations('transactions.discard_changes')
  const [dirty, setDirtyState] = useState(false)
  const [asking, setAsking] = useState(false)

  // Stable identity: the form reports through a `useEffect` that depends on it.
  const setDirty = useCallback((next: boolean) => setDirtyState(next), [])

  const finish = useCallback(() => {
    setAsking(false)
    // The host unmounts or remounts the form on close, so the next open starts
    // pristine — but reset anyway, since a host may keep the form mounted.
    setDirtyState(false)
    close()
  }, [close])

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true)
    else finish()
  }, [dirty, finish])

  const dialog = (
    <AlertDialog.Root open={asking} onOpenChange={setAsking}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-navy/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
          <AlertDialog.Title className="text-[16px] font-bold text-text">
            {t('title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
            {t('body')}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
              >
                {t('keep_editing')}
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={finish}
              className="h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('discard')}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )

  return { requestClose, setDirty, dialog }
}
