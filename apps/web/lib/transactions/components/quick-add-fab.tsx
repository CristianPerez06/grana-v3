'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

/**
 * Floating action button to register a movement. Mobile only — desktop uses
 * the header CTA. Opens the drawer via the app-shell-level provider; renders
 * disabled when the provider is not yet available (`useMovementDrawer()` is
 * null during the cold-load window).
 */
export const QuickAddFab = () => {
  const t = useTranslations('transactions')
  const drawer = useMovementDrawer()
  const label = t('actions.register_movement')
  return (
    <Button
      variant="primary"
      size="fab"
      aria-label={label}
      className="fixed bottom-10 right-10 z-40 sm:hidden"
      disabled={!drawer}
      onClick={drawer ? () => drawer.openCreate() : undefined}
    >
      <Plus className="size-7" aria-hidden />
    </Button>
  )
}
