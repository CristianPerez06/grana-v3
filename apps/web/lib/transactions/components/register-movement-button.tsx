'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

type Props = {
  /**
   * When true the button renders visually disabled (no interaction). Callers
   * use this while their own header-level data is still pending; the button
   * is also disabled automatically when `useMovementDrawer()` is null
   * (`MovementDrawerLoader` queries still resolving).
   */
  disabled?: boolean
}

/**
 * Desktop CTA to register a movement. Opens the drawer via the app-shell-level
 * `MovementDrawerProvider`. Renders disabled when the drawer provider is not
 * yet available (cold-load window) or when the caller passes `disabled=true`.
 */
export function RegisterMovementButton({ disabled = false }: Props = {}) {
  const t = useTranslations('transactions')
  const drawer = useMovementDrawer()
  const isDisabled = disabled || !drawer
  return (
    <Button
      variant="primary"
      size="md"
      className="hidden w-auto sm:inline-flex"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : () => drawer?.openCreate()}
    >
      <Plus className="size-4" aria-hidden />
      {t('actions.register_movement')}
    </Button>
  )
}
