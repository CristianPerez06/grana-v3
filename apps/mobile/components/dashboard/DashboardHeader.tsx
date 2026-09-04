import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronDown } from 'lucide-react-native'
import { dateLineVariants, reachableMonths } from '@grana/dashboard'
import { colors } from '../../lib/colors'
import { useLocale, useT } from '../../lib/locale-context'
import { useProfileFirstName } from '../../lib/dashboard/queries'
import { useDashboardMonth } from './DashboardMonthContext'
import { FittingText } from './FittingText'
import { MonthSheet } from './MonthSheet'

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
  const greeting = name ? t('dashboard.welcome', { name }) : t('dashboard.welcome_anon')

  const { selected, current, isCurrent, goToMonth } = useDashboardMonth()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <SafeAreaView edges={['top']} className="bg-navy">
      <View className="px-6 pb-4 pt-3">
        <View className="h-5" />

        {/* The header holds exactly two things: who you are, and when you are
            looking from. The month pill and the eye toggle used to share the
            date's row and took ~190px of a ~310px line, which is why the date
            truncated. The selector is now the date line itself; the eye toggle
            moved to the balance card, where the amounts it masks begin. */}
        <Text className="text-2xl font-semibold text-white">{greeting}</Text>

        <View className="mt-1 flex-row items-center gap-2">
          {/* THE LENS — not a label beside a control, the control itself. The
              caret is load-bearing, not decoration: without it nothing
              distinguishes a date you can tap from a date that is printed.
              `hitSlop` is the 44px touch target — web uses an `::after`
              pseudo-element for the same thing. */}
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.month_lens.open')}
            accessibilityState={{ expanded: sheetOpen }}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            className="min-w-0 flex-1 flex-row items-center gap-1.5"
          >
            <FittingText
              variants={dateLineVariants(todayISO, localeCode, selected)}
              className="text-sm text-navy-muted"
            />
            <ChevronDown size={14} color={colors.navyMuted} />
          </Pressable>

          {/* Only while it means something. */}
          {!isCurrent && (
            <Pressable
              onPress={() => goToMonth(current)}
              accessibilityRole="button"
              hitSlop={8}
              className="shrink-0 rounded-full bg-emerald-soft px-2.5 py-1"
            >
              {/* `--mint` comes through the colors mirror rather than a class:
                  `text-mint` is used nowhere else in the native app, and
                  `--emerald` does not clear AA against the band's navy. */}
              <Text className="text-[12px] font-bold" style={{ color: colors.mint }}>
                {t('dashboard.month_lens.back_to_today')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <MonthSheet
        open={sheetOpen}
        years={reachableMonths(todayISO, localeCode)}
        selected={selected}
        onSelect={(month) => {
          goToMonth(month)
          setSheetOpen(false)
        }}
        onDismiss={() => setSheetOpen(false)}
      />
    </SafeAreaView>
  )
}
