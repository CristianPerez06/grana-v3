import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { colors } from '../../lib/colors'
import { formatDateISO, getTodayAR } from '../../lib/date'
import { useT } from '../../lib/locale-context'
import {
  useDashboardHero,
  useHasMovements,
  useProfileFirstName,
  useUpcomingFortnight,
} from '../../lib/dashboard/queries'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { EyeMaskProvider } from '../../components/dashboard/EyeMaskContext'
import { HeroSection } from '../../components/dashboard/HeroSection'
import { MonthBalanceSection } from '../../components/dashboard/MonthBalanceSection'
import { SectionFallback } from '../../components/dashboard/SectionFallback'
import { UpcomingFortnightSection } from '../../components/dashboard/UpcomingFortnightSection'
import { WelcomeFirstMoveCard } from '../../components/dashboard/WelcomeFirstMoveCard'
import { Spinner } from '../../components/ui/Spinner'

const MONTHS_BACK_LIMIT = 12

export default function DashboardScreen() {
  const t = useT()
  const today = getTodayAR()
  // The dashboard always opens on the current month; MonthBalanceSection owns
  // month navigation in local state (no `?month=` param).
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const queryClient = useQueryClient()
  const hero = useDashboardHero()
  const upcoming = useUpcomingFortnight(today)
  const movements = useHasMovements()
  const profileFirstName = useProfileFirstName()

  const isRefetching =
    hero.isFetching || upcoming.isFetching || movements.isFetching

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

  // MonthBalanceSection self-manages its own loading/error in-card, so it no
  // longer gates the screen-level initial spinner.
  const initialLoading = hero.isPending && upcoming.isPending && movements.isPending

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['top']}>
        <Spinner size="lg" />
      </SafeAreaView>
    )
  }

  const showWelcomeCard = movements.data === false

  return (
    <EyeMaskProvider key={eyeMaskKey}>
      <View className="flex-1 bg-background">
        <DashboardHeader
          name={profileFirstName.data ?? ''}
          todayISO={formatDateISO(today)}
        />
        <ScrollView
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

            <MonthBalanceSection
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthsBackLimit={MONTHS_BACK_LIMIT}
            />
          </View>
        </ScrollView>
      </View>
    </EyeMaskProvider>
  )
}
