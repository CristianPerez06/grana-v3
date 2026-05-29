'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

/**
 * Floating action button to register a movement. Mobile only — desktop uses
 * the header CTA. Opens the drawer when the provider is present (transactions
 * list); otherwise (e.g. the dashboard) navigates to `/transactions/new`.
 */
export const QuickAddFab = () => {
  const t = useTranslations('transactions')
  const drawer = useMovementDrawer()
  const label = t('actions.register_movement')
  const className =
    'fixed bottom-10 right-10 z-40 inline-flex size-16 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-lg transition-colors hover:bg-success/90 sm:hidden'

  if (drawer) {
    return (
      <button
        type="button"
        onClick={() => drawer.openCreate()}
        aria-label={label}
        className={className}
      >
        <Plus className="size-7" aria-hidden />
      </button>
    )
  }

  return (
    <Link href="/transactions/new" aria-label={label} className={className}>
      <Plus className="size-7" aria-hidden />
    </Link>
  )
}
