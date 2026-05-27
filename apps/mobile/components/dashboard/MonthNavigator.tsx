import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

type Props = {
  year: number
  month: number
  onPrev?: () => void
  onNext?: () => void
}

const ICON_COLOR = '#6B7683'
const ICON_COLOR_DISABLED = '#C8CDD5'

export const MonthNavigator = ({ year, month, onPrev, onNext }: Props) => {
  const label = `${MONTH_NAMES_ES[month - 1]} ${year}`

  return (
    <View className="flex-row items-center justify-center gap-3">
      {onPrev ? (
        <Pressable
          onPress={onPrev}
          accessibilityLabel="Mes anterior"
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <ChevronLeft size={18} color={ICON_COLOR} />
        </Pressable>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full opacity-30">
          <ChevronLeft size={18} color={ICON_COLOR_DISABLED} />
        </View>
      )}
      <Text className="min-w-[120px] text-center text-sm font-medium uppercase text-text-muted">
        {label}
      </Text>
      {onNext ? (
        <Pressable
          onPress={onNext}
          accessibilityLabel="Mes siguiente"
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <ChevronRight size={18} color={ICON_COLOR} />
        </Pressable>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full opacity-30">
          <ChevronRight size={18} color={ICON_COLOR_DISABLED} />
        </View>
      )}
    </View>
  )
}
