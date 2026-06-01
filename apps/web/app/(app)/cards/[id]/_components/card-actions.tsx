'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { reactivateAccount } from '@/app/_actions/accounts'
import { InactiveCardBanner } from '../../_components/inactive-card-banner'
import { useEditCardDrawer } from './edit-card-drawer'

type Props = {
  cardId: string
  isActive: boolean
  /** Kept for the page-level call signature; archive/delete now live in the drawer. */
  hasMovements?: boolean
}

export const CardActions = ({ cardId, isActive }: Props) => {
  const t = useTranslations('cards')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Active cards edit (and archive/delete) through the drawer hosted by the page.
  const drawer = useEditCardDrawer()

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.reactivate_failed'))
      }
    })
  }

  return (
    <>
      {!isActive && (
        <InactiveCardBanner onReactivate={handleReactivate} isPending={isPending} />
      )}

      {isActive && drawer && (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={drawer.openEdit}
            className="text-text-muted transition-colors hover:text-text"
          >
            {t('actions.edit')}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  )
}
