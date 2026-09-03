'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { dateLineVariants, reachableMonths } from '@grana/dashboard'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { useDashboardMonth } from './dashboard-month-context'
import { FittingText } from './fitting-text'
import { MonthSheet } from './month-sheet'

type Props = {
  /** Today's accounting date as `YYYY-MM-DD`, derived from `getTodayAR()`. */
  todayISO: string
}

export const DashboardHeader = ({ todayISO }: Props) => {
  const t = useTranslations('dashboard')
  const tLens = useTranslations('dashboard.month_lens')
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const { selected, current, isCurrent, goToMonth } = useDashboardMonth()
  const drawer = useMovementDrawer()

  const [sheetOpen, setSheetOpen] = useState(false)
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

        {/* The header holds exactly two things: who you are, and when you are
            looking from. The month selector and the eye toggle used to sit here
            and took ~190px of a ~330px row, which is why the date truncated
            every Wednesday. The selector is now the date line itself; the eye
            toggle moved to the balance card, where the amounts it masks begin. */}
        <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
          <h1 className="w-full text-2xl font-semibold tracking-tight text-white sm:order-1 sm:w-auto sm:min-w-0 sm:flex-1 md:text-text">
            {greeting}
          </h1>

          <div className="flex min-w-0 flex-1 items-center gap-2 sm:order-3 sm:w-full sm:flex-none">
            {/* THE LENS — not a label beside a control, the control itself.
                Enabled from the first paint: it never reads the profile query,
                which was the only reason header controls rendered disabled.
                The caret is load-bearing, not decoration: without it nothing
                distinguishes a date you can tap from a date that is printed.
                The `after:` pseudo-element is the 44px touch target — native
                uses `hitSlop` for the same thing. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              aria-label={tLens('open')}
              className="group relative flex min-w-0 items-center gap-1.5 text-sm text-navy-muted after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint md:text-text-muted md:focus-visible:ring-ring"
            >
              <FittingText variants={dateLineVariants(todayISO, localeCode, selected)} />
              <ChevronDown size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
            </button>

            {/* Only while it means something. */}
            {!isCurrent && (
              <button
                type="button"
                onClick={() => goToMonth(current)}
                className="shrink-0 rounded-full bg-emerald-soft px-2.5 py-1 text-[12px] font-bold text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint md:bg-emerald-bg md:text-emerald-deep md:focus-visible:ring-ring"
              >
                {tLens('back_to_today')}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:order-2">
            {isLoading || !drawer ? (
              <Button className="hidden w-auto md:inline-flex" disabled>
                <Plus size={18} strokeWidth={2} />
                {t('new_movement')}
              </Button>
            ) : (
              <Button className="hidden w-auto md:inline-flex" onClick={() => drawer.openCreate()}>
                <Plus size={18} strokeWidth={2} />
                {t('new_movement')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <MonthSheet
        open={sheetOpen}
        years={reachableMonths(todayISO, localeCode)}
        selected={selected}
        onSelect={(month) => {
          goToMonth(month)
          setSheetOpen(false)
        }}
        onDismiss={() => setSheetOpen(false)}
      />
    </header>
  )
}
