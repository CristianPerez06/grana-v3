import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { CreditCardSummary } from '../../lib/cards/queries'
import { t } from '../../lib/i18n'
import { CreditCardCarousel } from './CreditCardCarousel'

type Props = {
  cards: CreditCardSummary[]
}

export const CardsSection = ({ cards }: Props) => {
  const router = useRouter()

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-baseline justify-between">
        <Text className="text-lg font-semibold text-text">
          {t('dashboard.cards.title')}
        </Text>
      </View>
      {cards.length === 0 ? (
        <View className="flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8">
          <Text className="text-center text-sm text-text-muted">
            {t('dashboard.cards.empty_title')}
          </Text>
          <Pressable
            onPress={() => router.push('/tarjetas')}
            accessibilityRole="button"
            className="rounded-md bg-emerald px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">
              + {t('dashboard.cards.empty_cta')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <CreditCardCarousel cards={cards} />
      )}
    </View>
  )
}
