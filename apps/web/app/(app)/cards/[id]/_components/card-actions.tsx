'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deactivateCreditCardAccount } from '@/app/_actions/credit-cards'
import { deleteAccount, reactivateAccount } from '@/app/_actions/accounts'
import { DeactivateBlockDialog } from '../../_components/deactivate-block-dialog'
import { InactiveCardBanner } from '../../_components/inactive-card-banner'

type Props = {
  cardId: string
  isActive: boolean
  hasMovements: boolean
}

export const CardActions = ({ cardId, isActive, hasMovements }: Props) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const [isPending, startTransition] = useTransition()
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await deactivateCreditCardAccount(cardId)
      if (!result.ok) {
        if (result.formError === 'pending_debt') {
          setBlockDialogOpen(true)
        } else {
          setError(result.formError ?? t('errors.archive_failed'))
        }
      }
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.reactivate_failed'))
      }
    })
  }

  const handleDelete = () => {
    if (
      !confirm(
        t('confirmations.delete_body'),
      )
    )
      return
    startTransition(async () => {
      setError(null)
      const result = await deleteAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.delete_failed'))
        return
      }
      router.push('/cards')
    })
  }

  return (
    <>
      {!isActive && (
        <InactiveCardBanner onReactivate={handleReactivate} isPending={isPending} />
      )}

      {isActive && (
        <div className="flex items-center gap-2 text-sm">
          <a
            href={`/cards/${cardId}/edit`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('actions.edit')}
          </a>
          <span className="text-muted-foreground" aria-hidden="true">·</span>
          {hasMovements ? (
            <button
              onClick={handleDeactivate}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              {t('actions.archive')}
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              {t('actions.delete')}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <DeactivateBlockDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
      />
    </>
  )
}
