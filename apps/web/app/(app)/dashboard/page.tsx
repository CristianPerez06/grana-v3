import { getTranslations } from 'next-intl/server'
import {
  getDashboardHero,
  getMonthBalanceSeries,
  getUpcomingFortnight,
  hasUserMovements,
} from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { DashboardHeader } from './_components/dashboard-header'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { EyeMaskProvider } from './_components/eye-mask-context'
import { HeroSection } from './_components/hero-section'
import { MonthBalanceSection } from './_components/month-balance-section'
import { SectionFallback } from './_components/section-fallback'
import { UpcomingFortnightSection } from './_components/upcoming-fortnight-section'
import { WelcomeFirstMoveCard } from './_components/welcome-first-move-card'

const MONTHS_BACK_LIMIT = 12

const DashboardPage = async () => {
  const today = getTodayAR()
  // The dashboard always opens on the current month. Month navigation is
  // client-side state inside MonthBalanceSection, so there is no `?month=`
  // param to parse here anymore.
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const t = await getTranslations('dashboard')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [heroResult, upcomingResult, monthResult, hasMovementsResult, profileResult] =
    await Promise.allSettled([
      getDashboardHero(supabase),
      getUpcomingFortnight(supabase, today),
      getMonthBalanceSeries(supabase, currentYear, currentMonth),
      hasUserMovements(supabase),
      user
        ? supabase.from('profiles').select('full_name').eq('id', user.id).single()
        : Promise.resolve({ data: null }),
    ])

  const fullName =
    profileResult.status === 'fulfilled' ? profileResult.value.data?.full_name : null
  const firstName = fullName?.split(' ')[0] ?? ''

  const showWelcomeCard =
    hasMovementsResult.status === 'fulfilled' && hasMovementsResult.value === false

  return (
    <EyeMaskProvider>
      <DashboardHeader name={firstName} todayISO={formatDateISO(today)} />

      <div className="flex flex-col gap-5">
        {showWelcomeCard && <WelcomeFirstMoveCard />}

        {/* Hero — full width on top in every viewport. */}
        {heroResult.status === 'fulfilled' ? (
          <HeroSection data={heroResult.value} />
        ) : (
          <SectionFallback message={t('hero_error')} />
        )}

        {/*
          Below the Hero: single column on mobile (Lo que viene → Balance del mes);
          on lg, two columns with equal heights — Balance del mes (grows, col 1) +
          Lo que viene (acotado, col 2). DOM order keeps the mobile order; `lg:order-*`
          flips the columns on desktop.
        */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="lg:order-2">
            {upcomingResult.status === 'fulfilled' ? (
              <UpcomingFortnightSection data={upcomingResult.value} />
            ) : (
              <SectionFallback message={t('upcoming.error')} />
            )}
          </div>

          <div className="lg:order-1">
            {monthResult.status === 'fulfilled' ? (
              <MonthBalanceSection
                initialData={monthResult.value}
                currentYear={currentYear}
                currentMonth={currentMonth}
                monthsBackLimit={MONTHS_BACK_LIMIT}
              />
            ) : (
              <SectionFallback message={t('month.error')} />
            )}
          </div>
        </div>
      </div>

      <QuickAddFab />
    </EyeMaskProvider>
  )
}

export default DashboardPage
