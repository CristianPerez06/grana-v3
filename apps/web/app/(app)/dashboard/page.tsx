import { getTranslations } from 'next-intl/server'
import {
  getCreditCards,
  getDashboardHero,
  getMonthBalanceSeries,
  getUpcomingFortnight,
  hasUserMovements,
} from '@/lib/dashboard/queries'
import { getTodayAR } from '@/lib/date'
import { CardsSection } from './_components/cards-section'
import { DashboardHeader } from './_components/dashboard-header'
import { EyeMaskProvider } from './_components/eye-mask-context'
import { HeroSection } from './_components/hero-section'
import { MonthBalanceSection } from './_components/month-balance-section'
import { SectionFallback } from './_components/section-fallback'
import { UpcomingFortnightSection } from './_components/upcoming-fortnight-section'
import { WelcomeFirstMoveCard } from './_components/welcome-first-move-card'

const MONTHS_BACK_LIMIT = 12

type SearchParams = Promise<{ month?: string }>

type MonthParam = {
  year: number
  month: number
  currentYear: number
  currentMonth: number
}

function parseMonthParam(raw: string | undefined, today: Date): MonthParam {
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const fallback = { year: currentYear, month: currentMonth, currentYear, currentMonth }
  if (!raw) return fallback

  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return fallback

  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return fallback

  const monthsBack = (currentYear - year) * 12 + (currentMonth - month)
  if (monthsBack < 0 || monthsBack > MONTHS_BACK_LIMIT) return fallback

  return { year, month, currentYear, currentMonth }
}

const DashboardPage = async ({ searchParams }: { searchParams: SearchParams }) => {
  const today = getTodayAR()
  const { year, month, currentYear, currentMonth } = parseMonthParam(
    (await searchParams).month,
    today,
  )

  const t = await getTranslations('dashboard')

  const [heroResult, upcomingResult, monthResult, cardsResult, hasMovementsResult] =
    await Promise.allSettled([
      getDashboardHero(),
      getUpcomingFortnight(today),
      getMonthBalanceSeries(year, month),
      getCreditCards(),
      hasUserMovements(),
    ])

  const showWelcomeCard =
    hasMovementsResult.status === 'fulfilled' && hasMovementsResult.value === false

  return (
    <EyeMaskProvider>
      <DashboardHeader />

      <div className="flex flex-col gap-5">
        {showWelcomeCard && <WelcomeFirstMoveCard />}

        {heroResult.status === 'fulfilled' ? (
          <HeroSection data={heroResult.value} />
        ) : (
          <SectionFallback message={t('hero_error')} />
        )}

        {upcomingResult.status === 'fulfilled' ? (
          <UpcomingFortnightSection data={upcomingResult.value} />
        ) : (
          <SectionFallback message={t('upcoming.error')} />
        )}

        {monthResult.status === 'fulfilled' ? (
          <MonthBalanceSection
            data={monthResult.value}
            currentYear={currentYear}
            currentMonth={currentMonth}
            monthsBackLimit={MONTHS_BACK_LIMIT}
          />
        ) : (
          <SectionFallback message={t('month.error')} />
        )}

        {cardsResult.status === 'fulfilled' ? (
          <CardsSection cards={cardsResult.value} />
        ) : (
          <SectionFallback message={t('cards.error')} />
        )}
      </div>
    </EyeMaskProvider>
  )
}

export default DashboardPage
