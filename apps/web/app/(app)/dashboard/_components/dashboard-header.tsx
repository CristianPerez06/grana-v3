'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { useDashboardMonth } from './dashboard-month-context'
import { EyeMaskToggle } from './eye-mask-toggle'
import { MonthNavigator } from './month-navigator'

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

  const { selected, goPrev, goNext } = useDashboardMonth()
  const drawer = useMovementDrawer()

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

  const isDisabled = isLoading || !drawer
  const greeting = firstName ? t('welcome', { name: firstName }) : t('welcome_anon')

  return (
    // The dashboard is the one section with a header of its own instead of a
    // `PageHeader`, on both platforms. It still wears the same navy band below
    // `md` — see `page-header.tsx` for why the negative margins are what they
    // are, and `apps/mobile/components/dashboard/DashboardHeader.tsx` for the
    // native original this mirrors.
    <header className="-mx-4 -mt-5 mb-6 bg-navy pt-safe-top md:mx-0 md:mt-0 md:bg-transparent md:pt-0">
      <div className="px-4 pt-3 pb-4 md:p-0">
        {/* Reserves the back-link's slot so the dashboard's band is the same
            height as every other route's. The dashboard is a tab root and
            never has one. */}
        <div className="mb-3 h-5 md:hidden" aria-hidden />
        {/* ONE ROW at every width. Stacked, the selector took a full-width pill
            and ~44px of its own on the viewport where vertical room is
            scarcest, for a control that fits beside the title. The month goes
            to three letters below `sm` to make that room, and the greeting is
            the block that wraps — the controls never shrink. */}
        <div className="flex flex-row items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-text">
              {greeting}
            </h1>
            <p className="mt-1 text-sm text-navy-muted md:text-text-muted">
              {formatToday(todayISO, localeCode)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MonthNavigator
              responsive
              year={selected.year}
              month={selected.month}
              onPrev={isDisabled ? undefined : goPrev}
              onNext={isDisabled ? undefined : goNext}
            />
            <EyeMaskToggle disabled={isDisabled} />
            {isDisabled || !drawer ? (
              <Button className="hidden w-auto sm:inline-flex" disabled>
                <Plus size={18} strokeWidth={2} />
                {t('new_movement')}
              </Button>
            ) : (
              <Button
                className="hidden w-auto sm:inline-flex"
                onClick={() => drawer.openCreate()}
              >
                <Plus size={18} strokeWidth={2} />
                {t('new_movement')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
