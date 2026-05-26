'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { EyeMaskToggle } from './eye-mask-toggle'

type Props = {
  /** First name from the profile, or empty string for the anonymous fallback. */
  name: string
  /** Today's accounting date as `YYYY-MM-DD`, derived from `getTodayAR()`. */
  todayISO: string
}

function formatToday(todayISO: string, localeCode: string): string {
  const [y, m, d] = todayISO.split('-').map(Number)
  const formatted = new Date(y, m - 1, d).toLocaleDateString(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export const DashboardHeader = ({ name, todayISO }: Props) => {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const greeting = name ? t('welcome', { name }) : t('welcome_anon')

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {formatToday(todayISO, localeCode)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <EyeMaskToggle />
        <Button asChild className="w-auto">
          <Link href="/transactions/new">
            <Plus size={18} strokeWidth={2} />
            {t('new_movement')}
          </Link>
        </Button>
      </div>
    </header>
  )
}
