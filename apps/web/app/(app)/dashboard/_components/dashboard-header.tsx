'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { EyeMaskToggle } from './eye-mask-toggle'

type Props = {
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

export const DashboardHeader = ({ todayISO }: Props) => {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const [firstName, setFirstName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setIsLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      setFirstName(data?.full_name?.split(' ')[0] ?? '')
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const isDisabled = isLoading
  const greeting = firstName ? t('welcome', { name: firstName }) : t('welcome_anon')

  return (
    <header className="mb-6 flex flex-row items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {formatToday(todayISO, localeCode)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <EyeMaskToggle disabled={isDisabled} />
        {isDisabled ? (
          <Button className="hidden w-auto sm:inline-flex" disabled>
            <Plus size={18} strokeWidth={2} />
            {t('new_movement')}
          </Button>
        ) : (
          <Button asChild className="hidden w-auto sm:inline-flex">
            <Link href="/transactions/new">
              <Plus size={18} strokeWidth={2} />
              {t('new_movement')}
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
