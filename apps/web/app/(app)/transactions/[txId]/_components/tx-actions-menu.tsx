'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useTranslations } from 'next-intl'
import { deleteTransaction } from '@/app/_actions/transactions'

// Kebab menu (`⋯`) anchored at the top-right of the detail header. Items
// rendered conditionally on the edit/delete capabilities and the kind of
// movement. Delete opens a Radix AlertDialog with copy contextual to the
// kind (parent of installment / card payment / default).
//
// When neither edit nor delete is available, the component renders `null`
// so the TxHeader leaves its right slot empty.

type Props = {
  transactionId: string
  /** Account the transaction lives on — required by the delete server action. */
  accountId: string
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
  accountId,
  canEdit,
  canDelete,
  isParent,
  isCardPayment,
  onEdit,
}: Props) => {
  const t = useTranslations('transactions.detail.actions')
  const router = useRouter()
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
      const result = await deleteTransaction(transactionId, accountId)
      if (result.ok) {
        setDeleteOpen(false)
        router.push('/transactions')
      } else {
        setError(result.formError ?? t('delete_warning_default'))
      }
    })
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-text hover:bg-muted/40 transition-colors"
            aria-label={t('menu_label')}
          >
            <MoreHorizontal size={20} strokeWidth={2} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="min-w-[180px] rounded-[14px] border border-border bg-card overflow-hidden shadow-lg z-50"
          >
            {canEdit && (
              <DropdownMenu.Item
                onSelect={() =>
                  onEdit ? onEdit() : router.push(`/transactions/${transactionId}/edit`)
                }
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-[13px] font-semibold text-text cursor-pointer outline-none data-[highlighted]:bg-muted/40"
              >
                <Pencil size={15} strokeWidth={2} />
                {t('edit')}
              </DropdownMenu.Item>
            )}
            {canDelete && (
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault() // keep menu open until the dialog handles it
                  setDeleteOpen(true)
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-[13px] font-semibold text-expense cursor-pointer outline-none data-[highlighted]:bg-expense/10"
              >
                <Trash2 size={15} strokeWidth={2} />
                {t('delete')}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

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
