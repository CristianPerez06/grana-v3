import { View } from 'react-native'
import { PageHeader } from '../../components/ui/PageHeader'

export default function MovimientosScreen() {
  return (
    <View className="flex-1 bg-background px-6 py-6">
      <PageHeader title="Movimientos" />
    </View>
  )
}
