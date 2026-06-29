'use client'

import { useTranslations } from 'next-intl'
import { Fab } from '@/components/ui/fab'
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
  return (
    <Fab
      label={t('actions.register_movement')}
      disabled={!drawer}
      onClick={drawer ? () => drawer.openCreate() : undefined}
    />
  )
}
