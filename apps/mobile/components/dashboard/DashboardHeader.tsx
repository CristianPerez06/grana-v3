import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale, useT } from '../../lib/locale-context'
import { EyeMaskToggle } from './EyeMaskToggle'

type Props = {
  /** First name from the profile, or empty string for the anonymous fallback. */
  name: string
  /** Today's accounting date as `YYYY-MM-DD`, derived from `getTodayAR()`. */
  todayISO: string
}

function formatToday(todayISO: string, localeCode: string): string {
  const [y, m, d] = todayISO.split('-').map(Number)
  const formatted = new Date(y, m - 1, d).toLocaleDateString(localeCode, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export const DashboardHeader = ({ name, todayISO }: Props) => {
  const t = useT()
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const greeting = name
    ? t('dashboard.welcome', { name })
    : t('dashboard.welcome_anon')

  return (
    <SafeAreaView edges={['top']} className="bg-navy">
      <View className="flex-col gap-3 px-6 pb-4 pt-3">
        <View className="h-5" />
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-semibold text-white">{greeting}</Text>
            <Text className="mt-1 text-sm text-navy-muted">
              {formatToday(todayISO, localeCode)}
            </Text>
          </View>
          <EyeMaskToggle />
        </View>
      </View>
    </SafeAreaView>
  )
}
