import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../lib/locale-context'
import { useDashboardHero } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { MaskedAmount } from './MaskedAmount'

// The label is fixed chrome; only the amounts region swaps between
// spinner / error / data, over a stable min-height so the card never collapses.
const SWAP_MIN_HEIGHT = 64

export const HeroSection = () => {
  const t = useT()
  const router = useRouter()
  const query = useDashboardHero()
  const data = query.data

  return (
    <Pressable
      onPress={() => router.push('/accounts')}
      accessibilityRole="button"
      className="rounded-2xl border border-border bg-card p-6"
    >
      <Text className="text-xs font-medium uppercase text-text-muted">
        {t('dashboard.hero.label')}
      </Text>

      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="mt-2 justify-center">
        {data ? (
          <>
            <MaskedAmount
              amount={data.ars}
              currency="ARS"
              className="text-4xl font-bold text-text"
            />
            <View className="mt-1">
              <MaskedAmount
                amount={data.usd}
                currency="USD"
                showCentsOverride
                className="text-sm text-text-muted"
              />
            </View>
          </>
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.hero_error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <View className="items-center justify-center">
            <Spinner size="lg" />
          </View>
        )}
      </View>
    </Pressable>
  )
}
