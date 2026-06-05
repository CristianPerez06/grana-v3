'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

type Props = {
  cardId: string
}

/**
 * Empty-state "register first purchase" CTA on the card detail page.
 * Lives as a small client component so the server page can host it while the
 * drawer opener (which needs the React context) runs client-side.
 */
export function RegisterFirstPurchaseButton({ cardId }: Props) {
  const t = useTranslations('cards')
  const drawer = useMovementDrawer()
  return (
    <Button
      size="lg"
      disabled={!drawer}
      onClick={() => drawer?.openCreate(cardId)}
    >
      {t('actions.register_first_purchase')}
    </Button>
  )
}
