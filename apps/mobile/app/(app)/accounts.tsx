import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { useT } from '../../lib/locale-context'

export default function AccountsScreen() {
  const t = useT()
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-6 py-6">
        <PageHeader title={t('nav.accounts')} />
      </View>
    </SafeAreaView>
  )
}
