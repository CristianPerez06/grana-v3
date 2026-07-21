import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Settings } from 'lucide-react-native'
import { getTodayAR } from '@grana/money-logic'
import {
  getHousehold,
  getHouseholdDebt,
  getHouseholdOutlook,
  getPendingSettlements,
  getSharedAccruedMovements,
  getSharedExpenses,
} from '../../../lib/shared/queries'
import { PageHeader } from '../../../components/ui/PageHeader'
import { MonthNavigator } from '../../../components/ui/MonthNavigator'
import { QuickAddFab } from '../../../components/transactions/QuickAddFab'
import { SetupForm } from '../../../components/shared/SetupForm'
import { InviteCard } from '../../../components/shared/InviteCard'
import { SharedHero } from '../../../components/shared/SharedHero'
import { DebtSection } from '../../../components/shared/DebtSection'
import { OutlookSection } from '../../../components/shared/OutlookSection'
import { RecentSharedList } from '../../../components/shared/RecentSharedList'
import { PendingSettlementCard } from '../../../components/shared/PendingSettlementCard'
import {
  HeroSkeleton,
  HogarHomeSkeleton,
  ListCardSkeleton,
} from '../../../components/shared/HogarSkeleton'
import { CARD } from '../../../components/shared/ui'
import { useLocale, useT } from '../../../lib/locale-context'
import { colors } from '../../../lib/colors'

const ymOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

export default function HomeScreen() {
  const t = useT()
  const router = useRouter()

  const householdQuery = useQuery({ queryKey: ['shared', 'household'], queryFn: getHousehold })
  const household = householdQuery.data ?? null
  const isActive = (household?.members.length ?? 0) >= 2

  const settingsAction = (
    <Pressable
      hitSlop={8}
      disabled={!household}
      onPress={() => router.push('/home/settings')}
      accessibilityRole="button"
      accessibilityLabel={t('shared.settings.title')}
      style={{ opacity: household ? 1 : 0.4 }}
    >
      <Settings size={22} color={colors.white} strokeWidth={1.9} />
    </Pressable>
  )

  return (
    <View className="flex-1 bg-background">
      <PageHeader title={household?.name ?? t('shared.title')} actions={settingsAction} />

      <ScrollView contentContainerClassName="px-6 pt-6 pb-28">
        {householdQuery.isPending ? (
          <HogarHomeSkeleton />
        ) : householdQuery.isError ? (
          <View className={`${CARD} p-5`}>
            <Text className="text-sm text-text-muted">{t('shared.dashboard.empty')}</Text>
          </View>
        ) : !household ? (
          <SetupForm />
        ) : !isActive ? (
          <WaitingState />
        ) : (
          <ActiveState
            youId={household.members[0].userId}
            youName={household.members[0].fullName}
            partnerName={household.members[1].fullName}
          />
        )}
      </ScrollView>

      {isActive ? <QuickAddFab /> : null}
    </View>
  )
}

function WaitingState() {
  const t = useT()
  return (
    <View className="flex-col gap-4">
      <View className={`${CARD} flex-col gap-1 p-5`}>
        <Text className="text-lg font-semibold text-text">
          {t('shared.dashboard.waiting_title')}
        </Text>
        <Text className="text-sm text-text-muted">{t('shared.dashboard.waiting_hint')}</Text>
      </View>
      <InviteCard />
    </View>
  )
}

function ActiveState({
  youId,
  youName,
  partnerName,
}: {
  youId: string
  youName: string
  partnerName: string
}) {
  const t = useT()
  const locale = useLocale()

  const today = getTodayAR()
  const current = { year: today.getFullYear(), month: today.getMonth() + 1 }
  const [sel, setSel] = useState(current)
  const ym = ymOf(sel.year, sel.month)

  const monthLabel = new Date(sel.year, sel.month - 1, 1)
    .toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())

  const debtQuery = useQuery({ queryKey: ['shared', 'debt'], queryFn: () => getHouseholdDebt() })
  const outlookQuery = useQuery({ queryKey: ['shared', 'outlook'], queryFn: () => getHouseholdOutlook() })
  const pendingQuery = useQuery({ queryKey: ['shared', 'pending'], queryFn: getPendingSettlements })
  const accruedQuery = useQuery({
    queryKey: ['shared', 'accrued', ym],
    queryFn: () => getSharedAccruedMovements(ym),
  })
  const recentQuery = useQuery({
    queryKey: ['shared', 'recent', ym],
    queryFn: () => getSharedExpenses({ month: ym }),
  })

  const monthIndex = (y: number, m: number) => y * 12 + (m - 1)
  const canGoForward = monthIndex(sel.year, sel.month) < monthIndex(current.year, current.month)
  const shift = (delta: number) => {
    const idx = monthIndex(sel.year, sel.month) + delta
    setSel({ year: Math.floor(idx / 12), month: (idx % 12) + 1 })
  }

  return (
    <View className="flex-col gap-4">
      <MonthNavigator
        year={sel.year}
        month={sel.month}
        onPrev={() => shift(-1)}
        onNext={canGoForward ? () => shift(1) : undefined}
      />

      {accruedQuery.isPending ? (
        <HeroSkeleton />
      ) : (
        <SharedHero items={accruedQuery.data ?? []} monthLabel={monthLabel} />
      )}

      {debtQuery.data && (
        <DebtSection
          debt={debtQuery.data}
          youId={youId}
          youName={youName}
          partnerName={partnerName}
        />
      )}

      {!outlookQuery.isPending && (
        <OutlookSection outlook={outlookQuery.data ?? null} debt={debtQuery.data ?? null} youId={youId} />
      )}

      {(pendingQuery.data ?? []).length > 0 && (
        <View className="flex-col gap-3">
          <Text className="px-1 text-sm font-extrabold text-text">
            {t('shared.settle.pending_title')}
          </Text>
          {pendingQuery.data!.map((s) => (
            <PendingSettlementCard key={s.id} settlement={s} />
          ))}
        </View>
      )}

      {recentQuery.isPending ? (
        <ListCardSkeleton />
      ) : (
        <RecentSharedList items={recentQuery.data ?? []} youId={youId} />
      )}
    </View>
  )
}
