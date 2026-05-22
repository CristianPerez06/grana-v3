import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { colors } from '../../lib/colors'
import { getTodayAR } from '../../lib/date'
import { t } from '../../lib/i18n'
import {
  useDashboardCards,
  useDashboardHero,
  useHasMovements,
  useMonthBalanceSeries,
  useUpcomingFortnight,
} from '../../lib/dashboard/queries'
import { PreferencesProvider } from '../../lib/preferences-context'
import { CardsSection } from '../../components/dashboard/CardsSection'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { EyeMaskProvider } from '../../components/dashboard/EyeMaskContext'
import { HeroSection } from '../../components/dashboard/HeroSection'
import { MonthBalanceSection } from '../../components/dashboard/MonthBalanceSection'
import { SectionFallback } from '../../components/dashboard/SectionFallback'
import { UpcomingFortnightSection } from '../../components/dashboard/UpcomingFortnightSection'
import { WelcomeFirstMoveCard } from '../../components/dashboard/WelcomeFirstMoveCard'
import { Spinner } from '../../components/ui/Spinner'

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

export default function DashboardScreen() {
  const params = useLocalSearchParams<{ month?: string }>()
  const today = getTodayAR()
  const { year, month, currentYear, currentMonth } = parseMonthParam(params.month, today)

  const queryClient = useQueryClient()
  const hero = useDashboardHero()
  const upcoming = useUpcomingFortnight(today)
  const monthSeries = useMonthBalanceSeries(year, month)
  const cards = useDashboardCards()
  const movements = useHasMovements()

  const isRefetching =
    hero.isFetching ||
    upcoming.isFetching ||
    monthSeries.isFetching ||
    cards.isFetching ||
    movements.isFetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [queryClient])

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

  const initialLoading =
    hero.isPending &&
    upcoming.isPending &&
    monthSeries.isPending &&
    cards.isPending &&
    movements.isPending

  if (initialLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    )
  }

  const showWelcomeCard = movements.data === false

  return (
    <PreferencesProvider>
      <EyeMaskProvider key={eyeMaskKey}>
        <ScrollView
          className="flex-1 bg-background"
          contentContainerClassName="px-6 py-6"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.textSoft}
              colors={[colors.textSoft]}
            />
          }
        >
          <DashboardHeader />

          <View className="flex-col gap-5">
            {showWelcomeCard && <WelcomeFirstMoveCard />}

            {hero.data ? (
              <HeroSection data={hero.data} />
            ) : hero.error ? (
              <SectionFallback message={t('dashboard.hero_error')} />
            ) : null}

            {upcoming.data ? (
              <UpcomingFortnightSection data={upcoming.data} />
            ) : upcoming.error ? (
              <SectionFallback message={t('dashboard.upcoming.error')} />
            ) : null}

            {monthSeries.data ? (
              <MonthBalanceSection
                data={monthSeries.data}
                currentYear={currentYear}
                currentMonth={currentMonth}
                monthsBackLimit={MONTHS_BACK_LIMIT}
              />
            ) : monthSeries.error ? (
              <SectionFallback message={t('dashboard.month.error')} />
            ) : null}

            {cards.data ? (
              <CardsSection cards={cards.data} />
            ) : cards.error ? (
              <SectionFallback message={t('dashboard.cards.error')} />
            ) : null}
          </View>
        </ScrollView>
      </EyeMaskProvider>
    </PreferencesProvider>
  )
}
