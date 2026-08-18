'use client'

import { useTranslations } from 'next-intl'

/**
 * "Discard your changes?" confirmation for a form inside a drawer.
 *
 * Deliberately NOT a Radix `AlertDialog`. A second Radix modal opened over an
 * open `Dialog` portals to `document.body`, i.e. OUTSIDE the drawer's locked
 * subtree, and inherits that lock's side effects: the outer modal sets
 * `pointer-events: none` on the body and marks everything else `aria-hidden`,
 * and the two dismissable layers arbitrate Esc and outside-clicks between them.
 * `drawer.tsx` already documents the same trap for popovers portal'd to the body.
 *
 * So this renders as a plain absolutely-positioned layer INSIDE the drawer
 * panel: no portal, no second focus trap, no layer stack. The drawer's
 * `Dialog.Content` is `position: fixed`, so `absolute inset-0` covers exactly
 * the panel. It also reads better — the drawer asks, instead of a page-wide
 * modal stacking a second scrim over the first.
 */
type Props = {
  open: boolean
  /** Close the drawer and lose the edits. */
  onDiscard: () => void
  /** Dismiss the confirmation and stay in the form. */
  onKeepEditing: () => void
}

export const DiscardChangesDialog = ({ open, onDiscard, onKeepEditing }: Props) => {
  const t = useTranslations('transactions.discard_changes')
  if (!open) return null
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-navy/40 p-5"
      // Clicking the backdrop is the safe choice, not the destructive one.
      onClick={onKeepEditing}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // Swallow it: without this the drawer's own Esc handler would fire and
        // ask to close all over again.
        e.stopPropagation()
        onKeepEditing()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t('title')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-[18px] border border-border bg-card p-6 shadow-xl"
      >
        <p className="text-[16px] font-bold text-text">{t('title')}</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{t('body')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onKeepEditing}
            className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
          >
            {t('keep_editing')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('discard')}
          </button>
        </div>
      </div>
    </div>
  )
}
