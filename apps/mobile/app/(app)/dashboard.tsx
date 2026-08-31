import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { colors } from '../../lib/colors'
import { formatDateISO, getTodayAR } from '../../lib/date'
import { BalanceCard } from '../../components/dashboard/BalanceCard'
import { CommittedSection } from '../../components/dashboard/CommittedSection'
import { DashboardHeader } from '../../components/dashboard/DashboardHeader'
import { DashboardMonthProvider } from '../../components/dashboard/DashboardMonthContext'
import { EyeMaskProvider } from '../../components/dashboard/EyeMaskContext'
import { SharedStrip } from '../../components/dashboard/SharedStrip'
import { SpentCard } from '../../components/dashboard/SpentCard'
import { SaveSuggestionStrip } from '../../components/savings/SaveSuggestionStrip'
import { QuickAddFab } from '../../components/transactions/QuickAddFab'

export default function DashboardScreen() {
  const today = getTodayAR()
  // The dashboard always opens on the current month; the shared month provider
  // (header navigator) owns navigation in client state (no `?month=` param).
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const queryClient = useQueryClient()

  // The pull-to-refresh indicator is bound to the gesture, NOT to in-flight
  // dashboard queries. Section-local fetches share the `['dashboard']` prefix
  // (e.g. the balance/breakdown queries when navigating months), so a
  // `useIsFetching(['dashboard'])`-derived flag would falsely engage the top
  // RefreshControl on every arrow tap and shove the scroll down. Instead we
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

  // Reset client dashboard state when leaving the tab: bump key so the
  // providers (eye mask + selected month) remount with their defaults on the
  // next focus. Expo Router keeps tab screens mounted by default, so the
  // natural unmount-on-leave doesn't happen — we force a remount via key.
  const [providersKey, setProvidersKey] = useState(0)
  useFocusEffect(
    useCallback(() => {
      return () => {
        setProvidersKey((k) => k + 1)
      }
    }, []),
  )

  return (
    <EyeMaskProvider key={providersKey}>
      <DashboardMonthProvider currentYear={currentYear} currentMonth={currentMonth}>
        <View className="flex-1 bg-page">
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
            {/* Same four blocks as web, in the same order, single column:
                saldo → cuánto gastaste → compromisos → compartido. */}
            <View className="flex-col gap-3">
              {/* La sugerencia de guardar, arriba de la card porque su momento es
                  "acabás de cobrar". Si no corresponde ofrecerla no renderiza
                  nada y la card sube sola: no es una tarea pendiente. */}
              <SaveSuggestionStrip
                year={today.getFullYear()}
                month={today.getMonth() + 1}
              />
              <BalanceCard todayISO={formatDateISO(today)} />
              <SpentCard />
              <CommittedSection />
              <SharedStrip />
            </View>
          </ScrollView>
          <QuickAddFab />
        </View>
      </DashboardMonthProvider>
    </EyeMaskProvider>
  )
}
