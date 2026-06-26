import { Text, View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'

type Props = {
  onCreate: () => void
}

// Shown when the user has zero active accounts. CTA mirrors the header "Crear".
export function AccountsEmptyState({ onCreate }: Props) {
  const t = useT()
  return (
    <View className="items-center gap-3 rounded-[18px] border border-border bg-card px-6 py-12">
      <Text className="text-center text-lg font-bold text-text">
        {t('accounts.empty.title')}
      </Text>
      <Text className="text-center text-sm text-text-muted">
        {t('accounts.empty.description')}
      </Text>
      <View className="pt-2">
        <Button onPress={onCreate}>{t('accounts.empty.cta')}</Button>
      </View>
    </View>
  )
}
