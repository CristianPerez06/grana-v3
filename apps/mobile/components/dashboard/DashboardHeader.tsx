import { Text, View } from 'react-native'
import { t } from '../../lib/i18n'
import { EyeMaskToggle } from './EyeMaskToggle'

export const DashboardHeader = () => (
  <View className="mb-6 flex-row items-center justify-between">
    <Text className="text-2xl font-semibold text-text">{t('dashboard.title')}</Text>
    <EyeMaskToggle />
  </View>
)
