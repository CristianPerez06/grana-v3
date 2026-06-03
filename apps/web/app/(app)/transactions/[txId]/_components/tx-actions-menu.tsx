'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'
import { deleteTransaction } from '@/app/_actions/transactions'
import { invalidateAfterMovementMutation } from '@/lib/transactions/invalidation'

// Edit / delete icon actions anchored at the top-right of the detail header.
// Only ever up to two actions, so they show as direct icon buttons (no kebab),
// rendered conditionally on the edit/delete capabilities and the kind of
// movement. Delete opens a Radix AlertDialog with copy contextual to the
// kind (parent of installment / card payment / default).
//
// When neither edit nor delete is available, the component renders `null`
// so the TxHeader leaves its right slot empty.

type Props = {
  transactionId: string
  canEdit: boolean
  canDelete: boolean
  isParent: boolean
  isCardPayment: boolean
  /**
   * When provided, the "Editar" item opens the in-context edit drawer instead
   * of navigating to the `/edit` page. The host renders the drawer.
   */
  onEdit?: () => void
}

export const TxActionsMenu = ({
  transactionId,
  canEdit,
  canDelete,
  isParent,
  isCardPayment,
  onEdit,
}: Props) => {
  const t = useTranslations('transactions.detail.actions')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!canEdit && !canDelete) return null

  const deleteWarning = isCardPayment
    ? t('delete_warning_card_payment')
    : isParent
      ? t('delete_warning_parent')
      : t('delete_warning_default')

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const result = await deleteTransaction(transactionId)
      if (result.ok) {
        invalidateAfterMovementMutation(queryClient)
        setDeleteOpen(false)
        router.push('/transactions')
      } else {
        setError(result.formError ?? t('delete_warning_default'))
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {canEdit && (
          <button
            type="button"
            onClick={() =>
              onEdit ? onEdit() : router.push(`/transactions/${transactionId}/edit`)
            }
            aria-label={t('edit')}
            title={t('edit')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-text-muted hover:bg-muted/40 hover:text-text transition-colors"
          >
            <Pencil size={17} strokeWidth={2} aria-hidden />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={t('delete')}
            title={t('delete')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-expense hover:bg-expense/10 transition-colors"
          >
            <Trash2 size={17} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-[16px] font-bold text-text">
              {t('delete')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13.5px] text-text-muted leading-relaxed">
              {deleteWarning}
            </AlertDialog.Description>
            {error && (
              <p className="mt-3 text-[13px] text-expense">{error}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="h-10 px-4 rounded-[12px] border border-border bg-card text-[13px] font-medium text-text-muted hover:text-text transition-colors"
                  disabled={isPending}
                >
                  {t('cancel')}
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="h-10 px-4 rounded-[12px] bg-expense text-[13px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t('delete_confirm')}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
