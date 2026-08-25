import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { CreditCard, LogOut, Settings, Wallet, X } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/colors'
import { useMenuIdentity } from '../../lib/profile/queries'
import { useT } from '../../lib/locale-context'

type Props = {
  onClose: () => void
}

export function AppMenu({ onClose }: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data: identity } = useMenuIdentity()

  async function handleSignOut() {
    onClose()
    await supabase.auth.signOut()
  }

  const navigateAndClose = (path: '/accounts' | '/cards' | '/(app)/settings') => {
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

      <ProfileBlock name={identity?.name ?? null} email={identity?.email ?? null} />

      <View className="gap-[2px] px-4">
        <SheetItem
          Icon={Wallet}
          label={t('nav.accounts')}
          onPress={() => navigateAndClose('/accounts')}
        />
        <SheetItem
          Icon={CreditCard}
          label={t('nav.cards')}
          onPress={() => navigateAndClose('/cards')}
        />
        <SheetItem
          Icon={Settings}
          label={t('nav.settings')}
          onPress={() => navigateAndClose('/(app)/settings')}
        />

        <View className="my-2 border-t border-border-soft" />

        <SheetItem Icon={LogOut} label={t('nav.logout')} onPress={handleSignOut} destructive />
      </View>
    </View>
  )
}

/**
 * "Logged in as" identity. Mirrors web's `ProfileBlock`
 * (`apps/web/app/(app)/_components/profile-block.tsx`): same avatar-initial +
 * name + email shape, built from React Native primitives.
 *
 * Renders nothing until the query resolves, rather than a skeleton — it sits
 * above the destinations and a placeholder would push them down as it settles.
 */
function ProfileBlock({ name, email }: { name: string | null; email: string | null }) {
  const primary = name || email
  if (!primary) return null
  const secondary = name ? email : null

  return (
    <View className="flex-row items-center gap-3 px-5 pb-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-soft">
        <Text className="text-[13px] font-bold text-emerald">
          {primary.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px] font-bold text-text">
          {primary}
        </Text>
        {secondary && (
          <Text numberOfLines={1} className="text-[11px] text-text-soft">
            {secondary}
          </Text>
        )}
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
  const t = useT()
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
          <Text className="text-[10px] font-medium text-text-soft">{t('nav.coming_soon')}</Text>
        </View>
      )}
    </Pressable>
  )
}
