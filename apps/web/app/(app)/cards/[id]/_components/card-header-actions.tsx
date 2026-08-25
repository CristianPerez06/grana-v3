'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { deactivateCreditCardAccount } from '@/app/_actions/credit-cards'
import { deleteAccount } from '@/app/_actions/accounts'
import { useEditCardDrawer } from './edit-card-drawer'
import { DeactivateBlockDialog } from '../../_components/deactivate-block-dialog'

type Props = {
  cardId: string
  /** Hide the register-purchase button (e.g. the empty state already has a big CTA). */
  showAdd?: boolean
  /**
   * Governs the destructive action, mirroring the accounts rule: a card with
   * movements can only be archived; one without can be deleted outright.
   */
  hasMovements?: boolean
}

/**
 * Header actions for the card detail: primary "Registrar consumo" + edit (pencil)
 * + a contextual destructive icon (archive when the card has movements, delete
 * when it doesn't) with a confirm dialog — same icon-action language as the
 * movement detail header.
 */
export const CardHeaderActions = ({ cardId, showAdd = true, hasMovements = false }: Props) => {
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const movementDrawer = useMovementDrawer()
  const editDrawer = useEditCardDrawer()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dangerLabel = hasMovements ? t('actions.archive') : t('actions.delete')
  const dangerBody = hasMovements ? t('edit.archive_sub') : t('confirmations.delete_body')

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      if (hasMovements) {
        const result = await deactivateCreditCardAccount(cardId)
        if (!result.ok) {
          setConfirmOpen(false)
          if (result.formError === 'pending_debt') setBlockOpen(true)
          else setError(result.formError ?? t('errors.archive_failed'))
          return
        }
        setConfirmOpen(false)
        router.refresh()
        return
      }
      const result = await deleteAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      setConfirmOpen(false)
      router.push('/cards')
    })
  }

  return (
    <>
      {showAdd && (
        <>
          <Button
            size="sm"
            className="inline-flex w-auto"
            disabled={!movementDrawer}
            onClick={() => movementDrawer?.openCreate(cardId)}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            {t('actions.register_purchase')}
          </Button>
        </>
      )}
      {editDrawer && (
        <button
          type="button"
          onClick={editDrawer.openEdit}
          aria-label={t('actions.edit')}
          title={t('actions.edit')}
          className="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-border-soft hover:text-text"
        >
          <Pencil className="size-[17px]" aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setError(null)
          setConfirmOpen(true)
        }}
        aria-label={dangerLabel}
        title={dangerLabel}
        className={
          hasMovements
            ? 'inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-border-soft hover:text-text'
            : 'inline-flex size-9 items-center justify-center rounded-lg text-expense transition-colors hover:bg-expense/10'
        }
      >
        {hasMovements ? <Archive className="size-[17px]" aria-hidden /> : <Trash2 className="size-[17px]" aria-hidden />}
      </button>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-[16px] font-bold text-text">{dangerLabel}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
              {dangerBody}
            </AlertDialog.Description>
            {error && <p className="mt-3 text-[13px] text-expense">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
                >
                  {tCommon('cancel')}
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className={
                  hasMovements
                    ? 'h-10 rounded-[12px] bg-navy px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50'
                    : 'h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50'
                }
              >
                {dangerLabel}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <DeactivateBlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} />
    </>
  )
}
