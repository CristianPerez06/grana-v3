import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CreditCard, LogOut, PiggyBank, Settings, X } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/colors'
import { t } from '../../lib/i18n'

type Props = {
  onClose: () => void
}

export function AppMenu({ onClose }: Props) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  async function handleSignOut() {
    onClose()
    await supabase.auth.signOut()
  }

  const navigateAndClose = (path: '/tarjetas') => {
    onClose()
    router.push(path)
  }

  return (
    <View
      className="bg-card rounded-t-[20px]"
      style={{ paddingBottom: Math.max(8, insets.bottom) }}
    >
      <View className="items-center pt-3 pb-1">
        <View className="h-1 w-10 rounded-full bg-border-soft" />
      </View>

      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text className="text-[14px] font-bold text-text">{t('nav.more_options')}</Text>
        <Pressable
          onPress={onClose}
          accessibilityLabel={t('nav.close_menu')}
          className="h-7 w-7 items-center justify-center rounded-full bg-page"
        >
          <X size={14} strokeWidth={2.2} color={colors.textSoft} />
        </Pressable>
      </View>

      <View className="gap-[2px] px-4">
        <SheetItem
          Icon={CreditCard}
          label={t('nav.cards')}
          onPress={() => navigateAndClose('/tarjetas')}
        />
        <SheetItem Icon={PiggyBank} label={t('nav.savings')} onPress={onClose} comingSoon />
        <SheetItem Icon={Settings} label={t('nav.settings')} onPress={onClose} />

        <View className="my-2 border-t border-border-soft" />

        <SheetItem Icon={LogOut} label={t('nav.logout')} onPress={handleSignOut} destructive />
      </View>
    </View>
  )
}

type SheetItemProps = {
  Icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>
  label: string
  onPress: () => void
  destructive?: boolean
  comingSoon?: boolean
}

function SheetItem({
  Icon,
  label,
  onPress,
  destructive = false,
  comingSoon = false,
}: SheetItemProps) {
  const color = destructive ? colors.error : colors.text
  const containerOpacity = comingSoon ? 'opacity-50' : ''
  const pressFeedback = comingSoon
    ? ''
    : destructive
      ? 'active:bg-error-soft'
      : 'active:bg-emerald-soft'

  return (
    <Pressable
      onPress={comingSoon ? undefined : onPress}
      className={`flex-row items-center gap-3 rounded-2xl px-4 py-[13px] ${containerOpacity} ${pressFeedback}`}
    >
      <Icon size={20} strokeWidth={1.9} color={color} />
      <Text
        className={`flex-1 text-[14px] font-semibold ${destructive ? 'text-error' : 'text-text'}`}
      >
        {label}
      </Text>
      {comingSoon && (
        <View className="rounded-full bg-border-soft px-2 py-0.5">
          <Text className="text-[10px] font-medium text-text-soft">Próximamente</Text>
        </View>
      )}
    </Pressable>
  )
}
