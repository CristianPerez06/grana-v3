import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MonthSheetProps } from '@grana/ui-contracts'
import { useT } from '../../lib/locale-context'

// Breathing room below the last element, on top of the OS inset, matching
// `BottomSheet`. It goes in as a spacer at the END of the scroll content, never
// as `contentContainerStyle` — NativeWind maps `contentContainerClassName` onto
// that prop and the two collide.
const BOTTOM_SPACING = 20

// The grid is 26 buttons at most (two calendar years). It fits without
// scrolling on a normal phone, but not on a short one with the system font
// enlarged, so the scroller carries a bound in pixels — a percentage on the
// panel would only clip, because a ScrollView in an auto-height parent sizes
// itself to its content and believes its viewport is the whole thing.
const LIST_MAX_HEIGHT = 420

/**
 * Native mirror of the web `month-sheet.tsx` — the sheet the header's date line
 * opens to choose which month the dashboard is read from.
 *
 * It does NOT use `BottomSheet`, on purpose. That component wraps its panel in a
 * `Pressable` scrim, and the `mobile-app-shell` spec is explicit that the
 * ancestor pattern only survives over bodies made of inputs and list rows. This
 * body is a grid of `Pressable`s: the scrim and the tap-swallowing wrapper would
 * both claim the touch responder on press, so starting a drag on a month would
 * race the scroller and parts of the sheet would scroll while parts did not.
 * The scrim is a SIBLING behind the panel instead (`MovementFiltersSheet` is the
 * reference), which still closes on tap and competes with nothing — and makes
 * the tap-swallowing wrapper unnecessary, since the panel paints after it.
 *
 * Out-of-range months render DISABLED, never dropped: the rule — nothing in the
 * future, twelve months back — is meant to be seen, not discovered by tapping a
 * control that does nothing.
 */
export const MonthSheet = ({ open, years, selected, onSelect, onDismiss }: MonthSheetProps) => {
  const t = useT()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={open}
      onRequestClose={onDismiss}
      transparent
      animationType="slide"
      // Must match what a keyboard provider would force under edge-to-edge, and
      // what every other sheet in the app declares. This sheet has no text
      // input, so it mounts no `KeyboardProvider`.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onDismiss}
          accessibilityLabel={t('common.close')}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,26,43,0.30)' }]}
        />

        <View className="overflow-hidden rounded-t-2xl bg-page">
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-9 rounded-full bg-border" />
          </View>

          <Text className="px-5 pb-3 pt-2 text-[15px] font-extrabold text-text">
            {t('dashboard.month_lens.sheet_title')}
          </Text>

          <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} className="px-5">
            {years.map((year) => (
              <View key={year.year} className="pb-3">
                <Text className="pb-2 text-[11px] font-medium tracking-[1.1px] text-text-soft">
                  {year.year}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {year.months.map((month) => {
                    const isSelected =
                      month.year === selected.year && month.month === selected.month
                    return (
                      <Pressable
                        key={month.month}
                        disabled={!month.reachable}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !month.reachable, selected: isSelected }}
                        onPress={() => onSelect({ year: month.year, month: month.month })}
                        // Four per row, gap-2 (8px) between them, inside px-5
                        // padding: the width is what makes the grid regular
                        // without a grid primitive.
                        style={{ width: '22%', opacity: month.reachable ? 1 : 0.3 }}
                        className={`items-center rounded-[10px] border py-2.5 ${
                          isSelected ? 'border-navy bg-navy' : 'border-border bg-card'
                        }`}
                      >
                        <Text
                          className={`text-[13px] font-bold ${
                            isSelected ? 'text-white' : 'text-text'
                          }`}
                        >
                          {month.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}

            {/* The offset of the Comprometido card has no other surface that can
                explain it at the moment it matters. */}
            <Text className="pb-2 text-[11.5px] leading-4 text-text-soft">
              {t('dashboard.month_lens.committed_note')}
            </Text>

            {/* Safe-area room as a spacer at the end of the scroll content. */}
            <View style={{ height: insets.bottom + BOTTOM_SPACING }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
