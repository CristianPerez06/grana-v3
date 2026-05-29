import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Sparkles } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { useHasMovements } from '../../lib/dashboard/queries'

export const WelcomeFirstMoveCard = () => {
  const t = useT()
  const router = useRouter()
  const { data: hasMovements } = useHasMovements()

  // Self-gating: stays absent while the query is pending or when the user
  // already has movements; materializes only once we know there are none.
  // The brief top-of-page shift when it appears is accepted (rarely seen).
  if (hasMovements !== false) return null

  return (
    <View className="rounded-2xl border border-emerald/30 bg-emerald/5 p-6">
      <View className="flex-row items-start gap-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald/15">
          <Sparkles size={20} color="#10B981" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-text">
            {t('dashboard.welcome_card.title')}
          </Text>
          <Text className="mt-1 text-sm text-text-muted">
            {t('dashboard.welcome_card.description')}
          </Text>
          <Pressable
            onPress={() => router.push('/accounts')}
            accessibilityRole="button"
            className="mt-3 self-start rounded-md bg-emerald px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">
              {t('dashboard.welcome_card.cta')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
