import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import {
  getDashboardHero,
  getMonthBalanceSeries,
  getUpcomingFortnight,
  hasUserMovements,
  type DashboardHero,
  type MonthBalanceSeries,
  type UpcomingFortnight,
} from '@grana/dashboard'
import { supabase } from '../../lib/supabase'
import { getTodayAR } from '../../lib/date'
import {
  getCreditCards,
  type CreditCardSummary,
} from '../../lib/cards/queries'
import { t } from '../../lib/i18n'
import { PreferencesProvider } from '../../lib/preferences-context'
import { CardsSection } from '../../components/dashboard/CardsSection'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { EyeMaskProvider } from '../../components/dashboard/EyeMaskContext'
import { HeroSection } from '../../components/dashboard/HeroSection'
import { MonthBalanceSection } from '../../components/dashboard/MonthBalanceSection'
import { SectionFallback } from '../../components/dashboard/SectionFallback'
import { UpcomingFortnightSection } from '../../components/dashboard/UpcomingFortnightSection'
import { WelcomeFirstMoveCard } from '../../components/dashboard/WelcomeFirstMoveCard'

const MONTHS_BACK_LIMIT = 12

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

type Results = {
  hero: PromiseSettledResult<DashboardHero>
  upcoming: PromiseSettledResult<UpcomingFortnight>
  monthSeries: PromiseSettledResult<MonthBalanceSeries>
  cards: PromiseSettledResult<CreditCardSummary[]>
  hasMovements: PromiseSettledResult<boolean>
}

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ month?: string }>()
  const today = getTodayAR()
  const { year, month, currentYear, currentMonth } = parseMonthParam(params.month, today)

  const [results, setResults] = useState<Results | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      getDashboardHero(supabase),
      getUpcomingFortnight(supabase, today),
      getMonthBalanceSeries(supabase, year, month),
      getCreditCards(),
      hasUserMovements(supabase),
    ]).then(([hero, upcoming, monthSeries, cards, hasMovements]) => {
      if (cancelled) return
      setResults({
        hero: hero as PromiseSettledResult<DashboardHero>,
        upcoming: upcoming as PromiseSettledResult<UpcomingFortnight>,
        monthSeries: monthSeries as PromiseSettledResult<MonthBalanceSeries>,
        cards: cards as PromiseSettledResult<CreditCardSummary[]>,
        hasMovements: hasMovements as PromiseSettledResult<boolean>,
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  // Reset EyeMaskProvider when leaving the tab: bump key so the provider
  // remounts with masked=false on the next focus. Expo Router keeps tab
  // screens mounted by default, so the natural unmount-on-leave doesn't
  // happen — we force a remount via key.
  const [eyeMaskKey, setEyeMaskKey] = useState(0)
  useFocusEffect(
    useCallback(() => {
      return () => {
        setEyeMaskKey((k) => k + 1)
      }
    }, []),
  )

  if (!results) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    )
  }

  const showWelcomeCard =
    results.hasMovements.status === 'fulfilled' && results.hasMovements.value === false

  return (
    <PreferencesProvider>
      <EyeMaskProvider key={eyeMaskKey}>
        <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-6">
          <DashboardHeader />

          <View className="flex-col gap-5">
            {showWelcomeCard && <WelcomeFirstMoveCard />}

            {results.hero.status === 'fulfilled' ? (
              <HeroSection data={results.hero.value} />
            ) : (
              <SectionFallback message={t('dashboard.hero_error')} />
            )}

            {results.upcoming.status === 'fulfilled' ? (
              <UpcomingFortnightSection data={results.upcoming.value} />
            ) : (
              <SectionFallback message={t('dashboard.upcoming.error')} />
            )}

            {results.monthSeries.status === 'fulfilled' ? (
              <MonthBalanceSection
                data={results.monthSeries.value}
                currentYear={currentYear}
                currentMonth={currentMonth}
                monthsBackLimit={MONTHS_BACK_LIMIT}
              />
            ) : (
              <SectionFallback message={t('dashboard.month.error')} />
            )}

            {results.cards.status === 'fulfilled' ? (
              <CardsSection cards={results.cards.value} />
            ) : (
              <SectionFallback message={t('dashboard.cards.error')} />
            )}
          </View>
        </ScrollView>
      </EyeMaskProvider>
    </PreferencesProvider>
  )
}
