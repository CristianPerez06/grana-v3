import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CreditCard, Home, List, MoreHorizontal } from 'lucide-react-native'
import { colors } from '../../lib/colors'

type TabRoute = { key: string; name: string }
type TabBarNavigation = {
  emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
    defaultPrevented: boolean
  }
  navigate: (name: string) => void
}
type TabBarState = { index: number; routes: TabRoute[] }

type IconType = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>

const ROUTE_TO_ICON: Record<string, IconType> = {
  dashboard: Home,
  movimientos: List,
  tarjetas: CreditCard,
}

const ROUTE_TO_LABEL: Record<string, string> = {
  dashboard: 'Inicio',
  movimientos: 'Movimientos',
  tarjetas: 'Tarjetas',
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
      className="flex-row items-center gap-1 rounded-t-xl border-t border-border-soft bg-card px-3 pt-[14px]"
      style={{ paddingBottom: Math.max(14, insets.bottom) }}
    >
      {state.routes.map((route, index) => {
        if (route.name === 'menu') {
          return (
            <MenuButton
              key={route.key}
              onPress={onMenuPress}
              active={menuActive}
            />
          )
        }

        const Icon = ROUTE_TO_ICON[route.name]
        const label = ROUTE_TO_LABEL[route.name] ?? route.name
        if (!Icon) return null

        const isFocused = state.index === index && !menuActive
        const color = isFocused ? colors.positive : colors.textSoft

        const handlePress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            className="flex-1 items-center gap-1 py-1"
          >
            <View
              className="h-[3px] w-6 rounded-full"
              style={{ backgroundColor: isFocused ? colors.positive : 'transparent' }}
            />
            <Icon size={22} strokeWidth={1.9} color={color} />
            <Text
              className="text-[10px]"
              style={{
                color,
                fontWeight: isFocused ? '700' : '500',
              }}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function MenuButton({ onPress, active }: { onPress: () => void; active: boolean }) {
  return (
    <View className="flex-1 items-center justify-center py-1">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Menú"
        accessibilityState={active ? { selected: true } : {}}
        className="h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.positive }}
      >
        <MoreHorizontal size={26} strokeWidth={2} color={colors.white} />
      </Pressable>
    </View>
  )
}
