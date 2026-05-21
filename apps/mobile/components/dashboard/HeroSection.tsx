import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { DashboardHero } from '@grana/dashboard'
import { t } from '../../lib/i18n'
import { MaskedAmount } from './MaskedAmount'

type Props = {
  data: DashboardHero
}

export const HeroSection = ({ data }: Props) => {
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/accounts')}
      accessibilityRole="button"
      className="rounded-2xl border border-border bg-card p-6"
    >
      <Text className="text-xs font-medium uppercase text-text-muted">
        {t('dashboard.hero.label')}
      </Text>
      <View className="mt-2">
        <MaskedAmount
          amount={data.ars}
          currency="ARS"
          className="text-4xl font-bold text-text"
        />
      </View>
      <View className="mt-1">
        <MaskedAmount
          amount={data.usd}
          currency="USD"
          showCentsOverride
          className="text-sm text-text-muted"
        />
      </View>
    </Pressable>
  )
}
