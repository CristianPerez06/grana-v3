import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocale, useT } from '../../lib/locale-context'
import { useProfileFirstName } from '../../lib/dashboard/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { EyeMaskToggle } from './EyeMaskToggle'
import { MonthNavigator } from '../ui/MonthNavigator'

type Props = {
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

export const DashboardHeader = ({ todayISO }: Props) => {
  const t = useT()
  const locale = useLocale()
  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  // The header paints from the first frame with the anon greeting; the name
  // query resolves async (and may fail) without ever blocking the header.
  const { data: name } = useProfileFirstName()

  const greeting = name
    ? t('dashboard.welcome', { name })
    : t('dashboard.welcome_anon')

  const { selected, goPrev, goNext } = useDashboardMonth()

  return (
    <SafeAreaView edges={['top']} className="bg-navy">
      <View className="px-6 pb-4 pt-3">
        <View className="h-5" />
        {/* Selector and eye toggle sit on the greeting's row, as on web: a
            full-width month pill of its own was ~44px of a screen where vertical
            room is the scarce resource, spent on a control that fits beside the
            title. The month goes to three letters to make that room, and the
            greeting is the block that wraps — the controls do not shrink. */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-2xl font-semibold text-white">{greeting}</Text>
            <Text className="mt-1 text-sm text-navy-muted">
              {formatToday(todayISO, localeCode)}
            </Text>
          </View>
          <View className="shrink-0 flex-row items-center gap-1.5">
            <MonthNavigator
              compact
              year={selected.year}
              month={selected.month}
              onPrev={goPrev}
              onNext={goNext}
            />
            <EyeMaskToggle />
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
