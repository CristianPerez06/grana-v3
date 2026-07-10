import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

export const QuickAddFab = () => {
  const t = useT()
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/transactions/new')}
      accessibilityRole="button"
      accessibilityLabel={t('transactions.actions.register_movement')}
      className="absolute bottom-10 right-10 h-20 w-20 items-center justify-center rounded-2xl bg-emerald shadow-lg"
    >
      <Plus size={32} strokeWidth={2.5} color={colors.white} />
    </Pressable>
  )
}
