'use client'

import { useCallback, useState } from 'react'

/**
 * Guards a drawer close against losing unsaved form edits.
 *
 * The host is the single funnel for every close path — the form's ✕ calls the
 * host's `onClose`, and Radix routes Esc and scrim clicks to that same handler —
 * so wrapping it once here covers all three. The form only reports whether it is
 * dirty (`onDirtyChange`); it does not own the decision.
 *
 * This hook holds state only. The confirmation UI is `<DiscardChangesDialog>`,
 * which the host renders INSIDE the `<Drawer>` on purpose — see that file.
 *
 * Usage:
 *   const guard = useDiscardGuard(useCallback(() => setOpen(false), []))
 *   <Drawer onClose={guard.requestClose}>
 *     <MovementForm onClose={guard.requestClose} onDirtyChange={guard.setDirty} … />
 *     <DiscardChangesDialog open={guard.asking} onDiscard={guard.discard}
 *       onKeepEditing={guard.keepEditing} />
 *   </Drawer>
 */
export const useDiscardGuard = (close: () => void) => {
  // `useState` setters are referentially stable, so `setDirty` can be handed to
  // the form's `onDirtyChange` effect directly without a `useCallback` wrapper.
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)

  const discard = useCallback(() => {
    setAsking(false)
    // Hosts unmount or remount the form on close, so the next open starts
    // pristine — but reset anyway, in case a host keeps it mounted.
    setDirty(false)
    close()
  }, [close])

  const keepEditing = useCallback(() => setAsking(false), [])

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true)
    else discard()
  }, [dirty, discard])

  return { requestClose, setDirty, asking, discard, keepEditing }
}
