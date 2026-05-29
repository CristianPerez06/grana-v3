import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

// Disabled until the `/transactions/new` screen exists; flip `DISABLED` to
// false once the create flow is wired up.
const DISABLED = true

export const QuickAddFab = () => {
  const t = useT()
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/transactions/new')}
      disabled={DISABLED}
      accessibilityRole="button"
      accessibilityLabel={t('transactions.actions.register_movement')}
      accessibilityState={DISABLED ? { disabled: true } : undefined}
      className={`absolute bottom-10 right-10 h-20 w-20 items-center justify-center rounded-2xl bg-emerald shadow-lg ${
        DISABLED ? 'opacity-50' : ''
      }`}
    >
      <Plus size={32} strokeWidth={2.5} color={colors.white} />
    </Pressable>
  )
}
