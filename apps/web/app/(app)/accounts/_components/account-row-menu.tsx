'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemDestructive,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { reactivateAccount } from '@/app/_actions/accounts'
import { invalidateAfterAccountMutation } from '@/lib/transactions/invalidation'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { useAccountsEditDrawer } from './accounts-edit-drawer'
import { AccountConfirmDialog } from './account-confirm-dialog'

type Props = {
  account: AccountWithBalances
}

/**
 * Kebab menu on each row that owns every mutation for an account: Edit (drawer),
 * Archive / Delete (confirm dialog), Reactivate (direct). The item set is
 * derived from (is_active, has_transactions) per the accounts spec.
 *
 * Edit falls back to the /edit page link when `useAccountsEditDrawer()` returns
 * null (route shell mounted without the provider, e.g. degraded JS).
 */
export function AccountRowMenu({ account }: Props) {
  const t = useTranslations('accounts')
  const router = useRouter()
  const qc = useQueryClient()
  const editDrawer = useAccountsEditDrawer()
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null)
  const [reactivating, startReactivate] = useTransition()
  const [inlineError, setInlineError] = useState<string | null>(null)

  const handleEdit = () => {
    if (editDrawer) {
      editDrawer.openEdit(account)
    } else {
      router.push(`/accounts/${account.id}/edit`)
    }
  }

  const handleReactivate = () => {
    startReactivate(async () => {
      setInlineError(null)
      const result = await reactivateAccount(account.id)
      if (!result.ok) {
        setInlineError(result.formError ?? t('errors.reactivate_failed'))
        return
      }
      invalidateAfterAccountMutation(qc)
    })
  }

  const isActive = account.is_active
  const hasTx = account.has_transactions

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('menu.label')}
              className="inline-flex size-11 items-center justify-center rounded-lg text-text-soft transition-colors hover:bg-border-soft hover:text-text cursor-pointer disabled:opacity-50 sm:size-9"
              disabled={reactivating}
            >
              <MoreVertical className="size-[17px]" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {isActive && (
              <DropdownMenuItem onSelect={handleEdit}>
                <Pencil className="size-4" aria-hidden />
                {t('actions.edit')}
              </DropdownMenuItem>
            )}
            {!isActive && (
              <DropdownMenuItem onSelect={handleReactivate} disabled={reactivating}>
                <RotateCcw className="size-4" aria-hidden />
                {t('actions.reactivate')}
              </DropdownMenuItem>
            )}
            {isActive && (
              <DropdownMenuItemDestructive onSelect={() => setConfirmAction('archive')}>
                <Archive className="size-4" aria-hidden />
                {t('actions.archive')}
              </DropdownMenuItemDestructive>
            )}
            {!hasTx && (
              <DropdownMenuItemDestructive onSelect={() => setConfirmAction('delete')}>
                <Trash2 className="size-4" aria-hidden />
                {t('actions.delete')}
              </DropdownMenuItemDestructive>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {inlineError && <p className="text-[13px] text-negative">{inlineError}</p>}
      </div>
      {confirmAction && (
        <AccountConfirmDialog
          open={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          account={account}
          action={confirmAction}
        />
      )}
    </>
  )
}
