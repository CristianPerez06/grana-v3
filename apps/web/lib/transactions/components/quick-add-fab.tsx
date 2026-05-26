'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Floating action button to register a movement. Fixed bottom-right, shown on
 * the movements list and the dashboard so the user can start an alta without
 * scrolling back to the header. Links to the canonical create route.
 */
export const QuickAddFab = () => {
  const t = useTranslations('transactions')
  return (
    <Link
      href="/transactions/new"
      aria-label={t('actions.register_movement')}
      className="fixed bottom-6 right-6 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 md:bottom-8 md:right-8"
    >
      <Plus className="size-6" aria-hidden />
    </Link>
  )
}
