'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { deleteTransaction, deleteTransfer, deleteAdjustment, deleteExchange } from '@/app/_actions/transactions'
import { deleteInstallmentParent } from '@/app/_actions/credit-cards'

type Props = {
  transaction: TransactionWithDetails
  /** Account used to revalidate after the action (for the madre, a child's card account). */
  accountId: string
  /** Where to land after a successful delete. */
  returnHref: string
  /** Target of the "Editar" link (already includes any `?from=` origin). */
  editHref: string
}

/**
 * Shared Editar/Eliminar actions for a movement detail. Used by both the
 * in-account detail header and the global movement detail so the delete logic
 * lives in one place. Honors the existing per-type and installment rules
 * (enforced server-side): deleting an installment parent only succeeds if every
 * child is pending; paid credit-card consumptions and individual children are
 * rejected by the action.
 */
export const TransactionActions = ({ transaction, accountId, returnHref, editHref }: Props) => {
  const router = useRouter()
  const t = useTranslations('transactions')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { type } = transaction

  const confirmMessage = transaction.is_parent
    ? t('confirmations.delete_installment_parent_inline')
    : type === 'transfer'
      ? t('confirmations.delete_transfer_inline')
      : type === 'adjustment'
        ? t('confirmations.delete_adjustment_inline')
        : t('confirmations.delete_movement_inline')

  const handleDelete = () => {
    if (!confirm(confirmMessage)) return
    startTransition(async () => {
      setError(null)

      let result
      if (transaction.is_parent) {
        result = await deleteInstallmentParent(transaction.id)
      } else if (type === 'transfer' && transaction.transfer_destination_account_id) {
        result = await deleteTransfer(
          transaction.id,
          accountId,
          transaction.transfer_destination_account_id,
        )
      } else if (type === 'adjustment') {
        result = await deleteAdjustment(transaction.id, accountId)
      } else if (type === 'exchange' && transaction.transfer_destination_account_id) {
        result = await deleteExchange(
          transaction.id,
          accountId,
          transaction.transfer_destination_account_id,
        )
      } else {
        result = await deleteTransaction(transaction.id, accountId)
      }

      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      router.push(returnHref)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Link
          href={editHref}
          className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          {t('actions.edit')}
        </Link>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          {t('actions.delete')}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
