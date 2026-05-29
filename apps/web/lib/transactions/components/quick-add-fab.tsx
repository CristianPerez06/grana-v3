'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Floating action button to register a movement. Mobile only — desktop uses
 * the header CTA.
 */
export const QuickAddFab = () => {
  const t = useTranslations('transactions')
  return (
    <Link
      href="/transactions/new"
      aria-label={t('actions.register_movement')}
      className="fixed bottom-10 right-10 z-40 inline-flex size-16 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-lg transition-colors hover:bg-success/90 sm:hidden"
    >
      <Plus className="size-7" aria-hidden />
    </Link>
  )
}
