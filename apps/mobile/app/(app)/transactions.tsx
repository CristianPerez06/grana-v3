import { View } from 'react-native'
import { PageHeader } from '../../components/ui/PageHeader'
import { QuickAddFab } from '../../components/transactions/QuickAddFab'
import { useT } from '../../lib/locale-context'

export default function MovimientosScreen() {
  const t = useT()
  return (
    <View className="flex-1 bg-background">
      <PageHeader title={t('nav.movements')} />
      <View className="flex-1 px-6 py-6" />
      <QuickAddFab />
    </View>
  )
}
