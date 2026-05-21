import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
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
  prevHref?: string
  nextHref?: string
}

const ICON_COLOR = '#6B7683'
const ICON_COLOR_DISABLED = '#C8CDD5'

export const MonthNavigator = ({ year, month, prevHref, nextHref }: Props) => {
  const label = `${MONTH_NAMES_ES[month - 1]} ${year}`

  return (
    <View className="flex-row items-center justify-center gap-3">
      {prevHref ? (
        <Link href={prevHref} accessibilityLabel="Mes anterior" asChild>
          <Pressable className="h-8 w-8 items-center justify-center rounded-full">
            <ChevronLeft size={18} color={ICON_COLOR} />
          </Pressable>
        </Link>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full opacity-30">
          <ChevronLeft size={18} color={ICON_COLOR_DISABLED} />
        </View>
      )}
      <Text className="min-w-[120px] text-center text-sm font-medium uppercase text-text-muted">
        {label}
      </Text>
      {nextHref ? (
        <Link href={nextHref} accessibilityLabel="Mes siguiente" asChild>
          <Pressable className="h-8 w-8 items-center justify-center rounded-full">
            <ChevronRight size={18} color={ICON_COLOR} />
          </Pressable>
        </Link>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full opacity-30">
          <ChevronRight size={18} color={ICON_COLOR_DISABLED} />
        </View>
      )}
    </View>
  )
}
