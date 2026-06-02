'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

type Props = {
  /**
   * When true the button renders visually disabled (no interaction). The
   * /transactions shell uses this while the drawer's data queries
   * (`accounts` + `categories` + `household`) are still pending, so the user
   * sees the button immediately but can't open a drawer that would crash on
   * undefined props.
   */
  disabled?: boolean
}

/**
 * Desktop CTA to register a movement. Opens the drawer when the provider is
 * present; otherwise falls back to navigating to the `/transactions/new` page.
 */
export function RegisterMovementButton({ disabled = false }: Props = {}) {
  const t = useTranslations('transactions')
  const drawer = useMovementDrawer()
  const label = t('actions.register_movement')
  const className =
    'hidden items-center gap-2 rounded-[var(--radius-lg)] bg-emerald px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-deep sm:inline-flex'
  const disabledClassName = `${className} cursor-not-allowed opacity-60 hover:bg-emerald`

  if (disabled) {
    return (
      <button type="button" disabled className={disabledClassName} aria-disabled>
        <Plus className="size-4" aria-hidden />
        {label}
      </button>
    )
  }

  if (!drawer) {
    return (
      <Link href="/transactions/new" className={className}>
        <Plus className="size-4" aria-hidden />
        {label}
      </Link>
    )
  }

  return (
    <button type="button" onClick={() => drawer.openCreate()} className={className}>
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  )
}
