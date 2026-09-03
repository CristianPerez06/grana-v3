'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatTodayLine } from '@grana/dashboard'
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
        {/* TWO ROWS, and which two changes at `sm` — one DOM, `flex-wrap` plus
            `order` do the swap. The three blocks always fit on two lines; what
            differs is which line the controls share.

            Below `sm` the greeting takes the whole first row and the controls
            drop to the date's row. The controls are ~190px of a ~330px line, so
            beside the greeting they left it ~130px — "Hola, Julieta." wrapped,
            and a name is exactly what must not be squeezed. Beside the date,
            which is ~105px with the month at three letters, they fit with room
            to spare, and neither row costs a line that was not already there.

            From `sm` the greeting shares its row with the controls (order 1-2)
            and the date takes the second row on its own (order 3) — the desktop
            arrangement, unchanged: big title, controls to its right, date under
            the title. */}
        <div className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
          <h1 className="w-full text-2xl font-semibold tracking-tight text-white sm:order-1 sm:w-auto sm:min-w-0 sm:flex-1 md:text-text">
            {greeting}
          </h1>

          {/* ONE ROW, always. Below `sm` the weekday AND the month go to three
              letters, because even with the row to share, the full date and the
              controls do not both fit. Trimming the month alone was not enough:
              it was sized against "Martes" (92px) and the line truncated on
              "Miércoles" (109px), the longest weekday there is. `truncate` is
              the floor: at any width the date is one line or an ellipsis, never
              a paragraph. */}
          <p className="min-w-0 flex-1 truncate text-sm text-navy-muted sm:order-3 sm:w-full sm:flex-none md:text-text-muted">
            <span className="sm:hidden">
              {formatTodayLine(todayISO, localeCode, { short: true })}
            </span>
            <span className="hidden sm:inline">{formatTodayLine(todayISO, localeCode)}</span>
          </p>

          <div className="flex shrink-0 items-center gap-2 sm:order-2">
            <MonthNavigator
              responsive
              year={selected.year}
              month={selected.month}
              onPrev={isDisabled ? undefined : goPrev}
              onNext={isDisabled ? undefined : goNext}
            />
            <EyeMaskToggle disabled={isDisabled} />
            {isDisabled || !drawer ? (
              <Button className="hidden w-auto md:inline-flex" disabled>
                <Plus size={18} strokeWidth={2} />
                {t('new_movement')}
              </Button>
            ) : (
              <Button
                className="hidden w-auto md:inline-flex"
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
