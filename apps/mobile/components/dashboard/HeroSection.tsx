import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../lib/locale-context'
import { useDashboardHero } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { HeroSkeleton } from './HeroSkeleton'
import { MaskedAmount } from './MaskedAmount'
import { MaskedAmountDisplay } from './MaskedAmountDisplay'

// "Para gastar · hoy" — the dark hero card of the dashboard redesign: today's
// available balance, ARS as the headline and USD as a subordinate chip line.
// The per-account breakdown lives in the sibling AccountsCard ("Dónde está").
// The eyebrow and caption are fixed chrome; only the amounts region swaps
// between skeleton / error / data over a stable min-height.
const SWAP_MIN_HEIGHT = 96

export const HeroSection = () => {
  const t = useT()
  const router = useRouter()
  const query = useDashboardHero()
  const data = query.data

  return (
    <Pressable
      onPress={() => router.push('/accounts')}
      accessibilityRole="button"
      className="rounded-2xl bg-navy p-6"
    >
      <Text className="text-[11px] font-extrabold uppercase tracking-widest text-white/55">
        {t('dashboard.hero.eyebrow')}
      </Text>

      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {data ? (
          <>
            <MaskedAmountDisplay
              amount={data.ars}
              currency="ARS"
              className="text-[38px] font-extrabold text-white"
              decimalClassName="text-[19px] text-white/55"
            />
            <View className="mt-3 flex-row items-center gap-2">
              <View className="rounded-full bg-emerald-soft px-2.5 py-0.5">
                <Text className="text-[11px] font-extrabold text-positive">USD</Text>
              </View>
              <MaskedAmount
                amount={data.usd}
                currency="USD"
                showCentsOverride
                className="text-[15px] font-bold text-white/90"
              />
            </View>
          </>
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-white/70">
              {t('dashboard.hero_error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <HeroSkeleton />
        )}
      </View>

      <Text className="mt-2 text-xs font-semibold text-white/50">
        {t('dashboard.hero.caption')}
      </Text>
    </Pressable>
  )
}
