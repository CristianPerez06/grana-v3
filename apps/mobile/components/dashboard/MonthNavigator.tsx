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
}

// Header month selector — mirror of the web "monthsel" pill: a white bordered
// container with the two arrows and a bold capitalized label. Sits inside the
// navy dashboard header, stretching to the available width.
export const MonthNavigator = ({ year, month, onPrev, onNext }: Props) => {
  const label = `${MONTH_NAMES_ES[month - 1]} ${year}`

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
      <Text className="min-w-[104px] flex-1 text-center text-sm font-bold text-text">
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
