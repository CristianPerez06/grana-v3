'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { reactivateAccount } from '@/app/_actions/accounts'
import { InactiveCardBanner } from '../../_components/inactive-card-banner'

type Props = {
  cardId: string
  isActive: boolean
  /** Kept for the page-level call signature; archive/delete now live in the drawer. */
  hasMovements?: boolean
}

// Edit for active cards lives in the header (CardHeaderActions pencil → drawer);
// this component only handles the inactive (archived) reactivate banner.
export const CardActions = ({ cardId, isActive }: Props) => {
  const t = useTranslations('cards')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(cardId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.reactivate_failed'))
      }
    })
  }

  if (isActive) return null

  return (
    <>
      <InactiveCardBanner onReactivate={handleReactivate} isPending={isPending} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  )
}
