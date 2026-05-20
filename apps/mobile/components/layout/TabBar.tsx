import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CreditCard, Home, List, MoreHorizontal } from 'lucide-react-native'

type TabRoute = { key: string; name: string }
type TabBarNavigation = {
  emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
    defaultPrevented: boolean
  }
  navigate: (name: string) => void
}
type TabBarState = { index: number; routes: TabRoute[] }

type IconName = 'home' | 'list' | 'credit-card' | 'more'

const ICONS: Record<IconName, React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>> = {
  home: Home,
  list: List,
  'credit-card': CreditCard,
  more: MoreHorizontal,
}

const ROUTE_TO_ICON: Record<string, IconName> = {
  dashboard: 'home',
  movimientos: 'list',
  tarjetas: 'credit-card',
  menu: 'more',
}

const ROUTE_TO_LABEL: Record<string, string> = {
  dashboard: 'Inicio',
  movimientos: 'Movimientos',
  tarjetas: 'Tarjetas',
  menu: 'Menú',
}

type Props = {
  state: TabBarState
  navigation: TabBarNavigation
  onMenuPress: () => void
  menuActive: boolean
}

export function TabBar({ state, navigation, onMenuPress, menuActive }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="flex-row items-end gap-1 border-t border-border-soft bg-card px-3 pt-[10px]"
      style={{ paddingBottom: Math.max(14, insets.bottom) }}
    >
      {state.routes.map((route, index) => {
        const iconName = ROUTE_TO_ICON[route.name]
        const label = ROUTE_TO_LABEL[route.name] ?? route.name
        if (!iconName) return null

        const isMenu = route.name === 'menu'
        const isFocused = isMenu ? menuActive : state.index === index && !menuActive

        const handlePress = () => {
          if (isMenu) {
            onMenuPress()
            return
          }
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        const Icon = ICONS[iconName]
        const color = isFocused ? '#0B1A2B' : '#8A94A3'

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            className="flex-1 items-center gap-1 py-1"
          >
            <Icon size={22} strokeWidth={1.9} color={color} />
            <Text
              className={`text-[10px] ${isFocused ? 'font-bold text-navy' : 'font-medium text-text-soft'}`}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
