import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Users } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { getHousehold, getHouseholdDebt } from '../../lib/shared/queries'
import { MaskedAmount } from './MaskedAmount'

// Native mirror of the web `shared-strip.tsx` — the block the mobile dashboard
// did not have. A thin strip with the household net, in one direction only
// (te deben / debés), rendered ONLY when there is activity to surface.
//
// Tolerant by construction: any failure resolves to "nothing to show" rather
// than an error state, because an empty strip is indistinguishable from a strip
// the user was never meant to see.

type Net = { currency: 'ARS' | 'USD'; amount: number; direction: 'they_owe_you' | 'you_owe' }

const initialsOf = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

const Avatar = ({ initials, overlap }: { initials: string; overlap?: boolean }) => (
  <View
    style={overlap ? { marginLeft: -6 } : undefined}
    className="size-5 items-center justify-center rounded-full border-2 border-card bg-positive"
  >
    <Text className="text-[8.5px] font-extrabold text-white">{initials}</Text>
  </View>
)

export const SharedStrip = () => {
  const t = useT()
  const router = useRouter()

  const query = useQuery({
    queryKey: ['dashboard', 'shared-net'] as const,
    queryFn: async () => {
      const household = await getHousehold()
      if (!household || household.members.length < 2) return null
      const debt = await getHouseholdDebt()
      if (!debt) return null

      // getHousehold orders the current user first.
      const self = household.members[0]!
      const other = household.members[1]!
      const nets: Net[] = (['ARS', 'USD'] as const).flatMap((currency) => {
        const d = debt[currency]
        if (d.kind === 'settled') return []
        return [
          {
            currency,
            amount: d.amount,
            direction: d.to === self.userId ? 'they_owe_you' : 'you_owe',
          } as Net,
        ]
      })
      if (nets.length === 0) return null

      return {
        selfInitials: initialsOf(self.fullName),
        otherInitials: initialsOf(other.fullName),
        nets,
      }
    },
    retry: false,
  })

  const data = query.data
  if (!data) return null

  const primary = data.nets[0]!
  const credit = primary.direction === 'they_owe_you'

  return (
    <Pressable
      onPress={() => router.push('/shared')}
      accessibilityRole="button"
      style={{ minHeight: 54 }}
      className="flex-row items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5"
    >
      <View className="size-[30px] items-center justify-center rounded-xl bg-emerald-soft">
        <Users size={16} color={colors.emeraldDeep} />
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-[13px] font-extrabold text-text">
          {t('dashboard.shared_strip.title')}
        </Text>
        <View className="flex-row">
          <Avatar initials={data.selfInitials} />
          <Avatar initials={data.otherInitials} overlap />
        </View>
      </View>
      <View className="ml-auto flex-row items-center gap-1.5">
        <Text
          className={`text-[13.5px] font-extrabold ${credit ? 'text-positive' : 'text-terracotta'}`}
        >
          {credit
            ? t('dashboard.shared_strip.they_owe_you')
            : t('dashboard.shared_strip.you_owe')}{' '}
        </Text>
        <MaskedAmount
          amount={primary.amount}
          currency={primary.currency}
          showCentsOverride={primary.currency === 'USD'}
          className={`text-[13.5px] font-extrabold ${credit ? 'text-positive' : 'text-terracotta'}`}
        />
        <ChevronRight size={15} color={colors.textSoft} />
      </View>
    </Pressable>
  )
}
