import { Pressable, Text, View } from 'react-native'
import { useT } from '../../lib/locale-context'

type Props = {
  onDismiss: () => void
}

// First-use nudge shown when the user has exactly one active account. Dismissible
// and client-only (parity with web) — not an onboarding gate.
export function AccountsHint({ onDismiss }: Props) {
  const t = useT()
  return (
    <View className="flex-row items-start gap-3 rounded-[18px] border border-border bg-card px-5 py-4">
      <View className="flex-1 gap-1">
        <Text className="text-[15px] font-bold text-text">{t('accounts.hint.title')}</Text>
        <Text className="text-[13px] text-text-muted">{t('accounts.hint.description')}</Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button">
        <Text className="text-[13px] font-bold text-emerald-deep">
          {t('accounts.hint.dismiss')}
        </Text>
      </Pressable>
    </View>
  )
}
