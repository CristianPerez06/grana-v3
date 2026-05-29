'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'

/**
 * Desktop CTA to register a movement. Opens the drawer when the provider is
 * present; otherwise falls back to navigating to the `/transactions/new` page.
 */
export function RegisterMovementButton() {
  const t = useTranslations('transactions')
  const drawer = useMovementDrawer()
  const label = t('actions.register_movement')
  const className =
    'hidden items-center gap-2 rounded-[var(--radius-lg)] bg-emerald px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-deep sm:inline-flex'

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
