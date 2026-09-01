import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { formatTodayLine } from '@grana/dashboard'
import { useLocale, useT } from '../../lib/locale-context'
import { useProfileFirstName } from '../../lib/dashboard/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { EyeMaskToggle } from './EyeMaskToggle'
import { MonthNavigator } from '../ui/MonthNavigator'

type Props = {
  /** Today's accounting date as `YYYY-MM-DD`, derived from `getTodayAR()`. */
  todayISO: string
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
        {/* TWO ROWS — the same two web shows below `sm`. The greeting gets the
            first row whole; the selector and the eye toggle drop to the date's
            row. Beside the greeting those controls are ~190px of a ~310px line
            and left it ~130px, so "Hola, Julieta." wrapped, and a name is
            exactly what must not be squeezed. Beside the date — ~105px with the
            month at three letters — they fit with room to spare, and the header
            costs no line it was not already spending. A full-width month pill
            on a row of its own, which this screen used to have, cost ~44px more
            on the surface where vertical room is the scarce resource. */}
        <Text className="text-2xl font-semibold text-white">{greeting}</Text>
        <View className="mt-1 flex-row items-center justify-between gap-3">
          {/* ONE ROW, always. `numberOfLines` is web's `truncate`: one line or
              an ellipsis, never a paragraph. */}
          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm text-navy-muted">
            {formatTodayLine(todayISO, localeCode, { shortMonth: true })}
          </Text>
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
