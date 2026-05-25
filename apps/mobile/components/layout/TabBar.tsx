import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, List, MoreHorizontal, Users } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

type TabRoute = { key: string; name: string }
type TabBarNavigation = {
  emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
    defaultPrevented: boolean
  }
  navigate: (name: string) => void
}
type TabBarState = { index: number; routes: TabRoute[] }

type IconType = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>

type SlotKind = 'tab' | 'tab-disabled' | 'menu'

type SlotConfig = {
  kind: SlotKind
  icon?: IconType
  labelKey?: string
}

const SLOT_CONFIG: Record<string, SlotConfig> = {
  dashboard: { kind: 'tab', icon: Home, labelKey: 'nav.dashboard' },
  movimientos: { kind: 'tab', icon: List, labelKey: 'nav.movements' },
  home: { kind: 'tab-disabled', icon: Users, labelKey: 'nav.home' },
  menu: { kind: 'menu' },
}

type Props = {
  state: TabBarState
  navigation: TabBarNavigation
  onMenuPress: () => void
  menuActive: boolean
}

export function TabBar({ state, navigation, onMenuPress, menuActive }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()

  return (
    <View
      className="flex-row items-center gap-1 rounded-t-xl border-t border-border-soft bg-card px-3 pt-[14px]"
      style={{ paddingBottom: Math.max(14, insets.bottom) }}
    >
      {state.routes.map((route, index) => {
        const slot = SLOT_CONFIG[route.name]
        if (!slot) return null

        if (slot.kind === 'menu') {
          return <MenuButton key={route.key} onPress={onMenuPress} active={menuActive} />
        }

        if (slot.kind === 'tab-disabled') {
          return <DisabledTab key={route.key} icon={slot.icon!} labelKey={slot.labelKey!} />
        }

        const isFocused = state.index === index && !menuActive
        const color = isFocused ? colors.positive : colors.textSoft
        const Icon = slot.icon!

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
              style={{ color, fontWeight: isFocused ? '700' : '500' }}
            >
              {t(slot.labelKey!)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function MenuButton({ onPress, active }: { onPress: () => void; active: boolean }) {
  const t = useT()
  return (
    <View className="flex-1 items-center justify-center py-1">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('nav.open_menu')}
        accessibilityState={active ? { selected: true } : {}}
        className="h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ backgroundColor: colors.positive }}
      >
        <MoreHorizontal size={26} strokeWidth={2} color={colors.white} />
      </Pressable>
    </View>
  )
}

function DisabledTab({ icon: Icon, labelKey }: { icon: IconType; labelKey: string }) {
  const t = useT()
  return (
    <View
      className="flex-1 items-center gap-1 py-1 opacity-50"
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityHint={t('nav.coming_soon')}
    >
      <View className="h-[3px] w-6 rounded-full" />
      <Icon size={22} strokeWidth={1.9} color={colors.textSoft} />
      <Text className="text-[10px] font-medium" style={{ color: colors.textSoft }}>
        {t(labelKey)}
      </Text>
      <Text className="text-[8px] font-medium" style={{ color: colors.textSoft }}>
        {t('nav.coming_soon')}
      </Text>
    </View>
  )
}
