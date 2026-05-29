import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { colors } from '../../lib/colors'
import { formatDateISO, getTodayAR } from '../../lib/date'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { EyeMaskProvider } from '../../components/dashboard/EyeMaskContext'
import { HeroSection } from '../../components/dashboard/HeroSection'
import { MonthBalanceSection } from '../../components/dashboard/MonthBalanceSection'
import { UpcomingFortnightSection } from '../../components/dashboard/UpcomingFortnightSection'
import { WelcomeFirstMoveCard } from '../../components/dashboard/WelcomeFirstMoveCard'
import { QuickAddFab } from '../../components/transactions/QuickAddFab'

const MONTHS_BACK_LIMIT = 12

export default function DashboardScreen() {
  const today = getTodayAR()
  // The dashboard always opens on the current month; MonthBalanceSection owns
  // month navigation in local state (no `?month=` param).
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const queryClient = useQueryClient()

  // The pull-to-refresh indicator is bound to the gesture, NOT to in-flight
  // dashboard queries. Section-local fetches share the `['dashboard']` prefix
  // (e.g. MonthBalanceSection's `balance-series` query when navigating months),
  // so a `useIsFetching(['dashboard'])`-derived flag would falsely engage the
  // top RefreshControl on every arrow tap and shove the scroll down. Instead we
  // hold `refreshing` for exactly the pull: `invalidateQueries` resolves once
  // the refetches settle.
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      setRefreshing(false)
    }
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

  return (
    <EyeMaskProvider key={eyeMaskKey}>
      <View className="flex-1 bg-background">
        <DashboardHeader todayISO={formatDateISO(today)} />
        <ScrollView
          contentContainerClassName="px-6 pt-6 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSoft}
              colors={[colors.textSoft]}
            />
          }
        >
          {/* Each section owns its query and its in-card loading/error state;
              the shell only places them. A slow or failing section never
              blocks the others. */}
          <View className="flex-col gap-5">
            <WelcomeFirstMoveCard />
            <HeroSection />
            <UpcomingFortnightSection today={today} />
            <MonthBalanceSection
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthsBackLimit={MONTHS_BACK_LIMIT}
            />
          </View>
        </ScrollView>
        <QuickAddFab />
      </View>
    </EyeMaskProvider>
  )
}
