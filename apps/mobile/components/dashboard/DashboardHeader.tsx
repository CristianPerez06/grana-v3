import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useT } from '../../lib/locale-context'
import { EyeMaskToggle } from './EyeMaskToggle'

export const DashboardHeader = () => {
  const t = useT()
  return (
    <SafeAreaView edges={['top']} className="bg-navy">
      <View className="flex-col gap-3 px-6 pb-4 pt-3">
        <View className="h-5" />
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-white">{t('dashboard.title')}</Text>
          <EyeMaskToggle />
        </View>
      </View>
    </SafeAreaView>
  )
}
