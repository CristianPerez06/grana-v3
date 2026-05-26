import { View } from 'react-native'
import { PageHeader } from '../../components/ui/PageHeader'
import { useT } from '../../lib/locale-context'

export default function AccountsScreen() {
  const t = useT()
  return (
    <View className="flex-1 bg-background">
      <PageHeader title={t('nav.accounts')} />
      <View className="flex-1 px-6 py-6" />
    </View>
  )
}
