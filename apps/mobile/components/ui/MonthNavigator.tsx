import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { colors } from '../../lib/colors'

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

type Props = {
  year: number
  month: number
  onPrev?: () => void
  onNext?: () => void
  /**
   * Squeezed variant: the month drops to its first three letters and the pill
   * stops stretching. For the dashboard header, where the selector shares a row
   * with the greeting and there is no room for "Septiembre 2026".
   */
  compact?: boolean
}

// Shared month selector — mirror of the web "monthsel" pill: a white bordered
// container with the two arrows and a bold capitalized label. Presentational and
// prop-driven; used by the dashboard header and the Movimientos feed. Stretches
// to the available width.
export const MonthNavigator = ({ year, month, onPrev, onNext, compact = false }: Props) => {
  const name = MONTH_NAMES_ES[month - 1]!
  const label = `${compact ? name.slice(0, 3) : name} ${year}`

  return (
    <View className="flex-row items-center rounded-xl border border-border bg-card p-1">
      {onPrev ? (
        <Pressable
          onPress={onPrev}
          accessibilityLabel="Mes anterior"
          className="h-8 w-8 items-center justify-center rounded-[10px]"
        >
          <ChevronLeft size={16} color={colors.textMuted} />
        </Pressable>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-[10px] opacity-30">
          <ChevronLeft size={16} color={colors.textSoft} />
        </View>
      )}
      <Text
        className={`text-center font-bold text-text ${
          compact ? 'px-1 text-[13px]' : 'min-w-[104px] flex-1 text-sm'
        }`}
      >
        {label}
      </Text>
      {onNext ? (
        <Pressable
          onPress={onNext}
          accessibilityLabel="Mes siguiente"
          className="h-8 w-8 items-center justify-center rounded-[10px]"
        >
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-[10px] opacity-30">
          <ChevronRight size={16} color={colors.textSoft} />
        </View>
      )}
    </View>
  )
}
