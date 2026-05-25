import { Text, View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { EyeMaskToggle } from './EyeMaskToggle'

export const DashboardHeader = () => {
  const t = useT()
  return (
    <View className="mb-6 flex-row items-center justify-between">
      <Text className="text-2xl font-semibold text-text">{t('dashboard.title')}</Text>
      <EyeMaskToggle />
    </View>
  )
}
