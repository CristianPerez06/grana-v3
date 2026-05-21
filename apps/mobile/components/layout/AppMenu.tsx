import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CreditCard,
  LogOut,
  PiggyBank,
  Settings,
  Users,
  X,
} from 'lucide-react-native'
import { supabase } from '../../lib/supabase'

type Props = {
  onClose: () => void
}

export function AppMenu({ onClose }: Props) {
  const insets = useSafeAreaInsets()

  async function handleSignOut() {
    onClose()
    await supabase.auth.signOut()
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
        <Text className="text-[14px] font-bold text-text">Más opciones</Text>
        <Pressable
          onPress={onClose}
          className="h-7 w-7 items-center justify-center rounded-full bg-page"
        >
          <X size={14} strokeWidth={2.2} color="#8A94A3" />
        </Pressable>
      </View>

      <View className="gap-[2px] px-4">
        <SheetItem Icon={CreditCard} label="Mis tarjetas" onPress={onClose} />
        <SheetItem Icon={Users} label="Hogar" onPress={onClose} />
        <SheetItem Icon={PiggyBank} label="Ahorros" onPress={onClose} comingSoon />
        <SheetItem Icon={Settings} label="Configuración" onPress={onClose} />

        <View className="my-2 border-t border-border-soft" />

        <SheetItem Icon={LogOut} label="Salir" onPress={handleSignOut} destructive />
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
  const color = destructive ? '#C54B3C' : '#0B1A2B'
  const containerOpacity = comingSoon ? 'opacity-50' : ''

  return (
    <Pressable
      onPress={comingSoon ? undefined : onPress}
      className={`flex-row items-center gap-3 rounded-2xl px-4 py-[13px] ${containerOpacity}`}
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
