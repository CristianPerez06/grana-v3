import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path } from 'react-native-svg'

type Props = {
  title: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
  backLabel?: string
}

export function CurvedNavyHeader({
  title,
  subtitle,
  showBack,
  backHref,
  backLabel = 'Volver',
}: Props) {
  const router = useRouter()

  return (
    <View className="relative bg-navy px-5 pt-12 pb-12">
      <View className="mx-auto w-full max-w-[430px]">
        {showBack ? (
          <Pressable
            onPress={() => (backHref ? router.replace(backHref as never) : router.back())}
            className="mb-3 flex-row items-center gap-1"
            hitSlop={8}
          >
            <Text className="text-base font-medium text-navy-muted">‹</Text>
            <Text className="text-sm font-medium text-navy-muted">{backLabel}</Text>
          </Pressable>
        ) : null}
        <Text className="text-2xl font-bold leading-tight text-white">{title}</Text>
        {subtitle ? (
          <Text className="mt-1 text-sm leading-snug text-navy-muted">{subtitle}</Text>
        ) : null}
      </View>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 32 }}
        pointerEvents="none"
      >
        <Svg
          width="100%"
          height={32}
          viewBox="0 0 380 32"
          preserveAspectRatio="none"
        >
          <Path d="M0,0 Q190,42 380,0 L380,32 L0,32 Z" fill="#F6F7F9" />
        </Svg>
      </View>
    </View>
  )
}
