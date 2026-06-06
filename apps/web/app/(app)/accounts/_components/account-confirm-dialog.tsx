'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { archiveAccount, deleteAccount } from '@/app/_actions/accounts'
import { invalidateAfterAccountMutation } from '@/lib/transactions/invalidation'
import type { AccountWithBalances } from '@/lib/accounts/types'

type Action = 'archive' | 'delete'

type Props = {
  open: boolean
  onClose: () => void
  account: AccountWithBalances
  action: Action
  /** If set, navigate here after a successful delete (used from the detail page). */
  redirectOnDelete?: string
}

/**
 * Confirms an archive or delete on a single account. Title shows the account
 * name; the body uses the localized copy for that action; the destructive CTA
 * triggers the action and renders any tagged `formError` inline without closing
 * the dialog. The caller drives `open`; this component only flips it via
 * `onClose` on cancel/success.
 */
export function AccountConfirmDialog({
  open,
  onClose,
  account,
  action,
  redirectOnDelete,
}: Props) {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const qc = useQueryClient()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    const result =
      action === 'archive'
        ? await archiveAccount(account.id)
        : await deleteAccount(account.id)
    setLoading(false)

    if (!result.ok) {
      setError(
        result.formError ??
          t(action === 'archive' ? 'errors.archive_failed' : 'errors.delete_failed'),
      )
      return
    }

    invalidateAfterAccountMutation(qc)
    onClose()
    setError(null)
    if (action === 'delete' && redirectOnDelete) {
      router.push(redirectOnDelete)
    }
  }

  const handleClose = () => {
    if (loading) return
    setError(null)
    onClose()
  }

  const title =
    action === 'archive' ? t('confirmations.archive_title') : t('confirmations.delete_title')
  const body =
    action === 'archive'
      ? t('confirmations.archive_body')
      : t('confirmations.delete_body_no_transactions')
  const cta = action === 'archive' ? t('actions.archive') : t('actions.delete')

  return (
    <Dialog open={open} onClose={handleClose} ariaLabel={title}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <p className="font-medium text-text">{account.name}</p>
        <p>{body}</p>
        {error && <p className="text-sm font-medium text-negative">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={handleClose} disabled={loading}>
          {tCommon('cancel')}
        </Button>
        <Button variant="destructive" onPress={handleConfirm} loading={loading}>
          {cta}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
