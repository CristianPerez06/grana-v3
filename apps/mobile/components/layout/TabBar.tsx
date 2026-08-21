import { Pressable, Text, View } from 'react-native'
import { useKeyboardState } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSegments } from 'expo-router'
import { Home, List, MoreHorizontal, Users } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

// Exactly the sections reached from the tab bar's … button (the AppMenu): none
// of them is a tab, so the whole section renders chromeless — the tab bar would
// only show detached/unhighlighted. Hiding it is half the contract: every
// section listed here declares a `backLink` to the dashboard on its root screen,
// otherwise the screen is left with no visible way out (see spec
// `mobile-app-shell`).
const CHROMELESS_SECTIONS: readonly string[] = ['accounts', 'cards', 'settings']

// Pushed screens that render chromeless even though they live inside a primary
// tab's stack. The movement alta form pushes over the Movimientos tab but should
// read as a dedicated full-screen flow, not "still in the tab".
const CHROMELESS_SCREENS: readonly (readonly [parent: string, screen: string])[] = [
  ['transactions', 'new'],
  // Hogar (Compartido) sub-screens pushed over the home tab — each reads as a
  // dedicated full-screen flow, like `/transactions/new`. Setup is not here:
  // it renders inline in the home tab's no-household state (mirrors web).
  ['home', 'settle'],
  ['home', 'settings'],
  ['home', 'cuenta-corriente'],
]

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
  transactions: { kind: 'tab', icon: List, labelKey: 'nav.movements' },
  home: { kind: 'tab', icon: Users, labelKey: 'nav.home' },
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
  const segments = useSegments()
  // Selector form on purpose: the tab bar only cares about visibility, so it
  // does not re-render on every height frame while the keyboard animates.
  const keyboardVisible = useKeyboardState((s) => s.isVisible)

  // Hide the tab bar on chromeless routes: whole non-tab sections (the ones
  // reached from the … button) and specific pushed screens inside a tab (e.g.
  // `/transactions/new`), so each reads as a full-screen flow instead of a
  // highlighted-tab sub-view. The two lists never overlap: sections match on
  // `parts[0]`, screens on the [parent, screen] pair — so `['home', 'settings']`
  // (the household's settings, pushed over the Hogar tab) is unrelated to the
  // `settings` section.
  // Group segments like `(app)` are dropped so the section/screen check is
  // stable regardless of the route group.
  const parts = segments.filter((s) => !s.startsWith('('))
  const section = parts[0]
  const screen = parts[parts.length - 1]
  const parent = parts[parts.length - 2]
  const chromeless =
    (section !== undefined && CHROMELESS_SECTIONS.includes(section)) ||
    CHROMELESS_SCREENS.some(([p, s]) => parent === p && screen === s)
  if (chromeless) return null

  // The tab bar is rendered by the navigator OUTSIDE the screen container, so it
  // stays pinned to the bottom edge even with the keyboard open — sitting
  // between the form content and the top of the keyboard, eating the vertical
  // space the focused field needs. It offers no useful navigation mid-edit, so
  // it steps aside and comes back on dismiss.
  if (keyboardVisible) return null

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
