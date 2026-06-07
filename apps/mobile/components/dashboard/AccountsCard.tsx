import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../lib/locale-context'
import { useDashboardHero } from '../../lib/dashboard/queries'
import { AccountAvatar } from '../ui/AccountAvatar'
import { Button } from '../ui/Button'
import { AccountsCardSkeleton } from './AccountsCardSkeleton'
import { MaskedAmount } from './MaskedAmount'

// "Dónde está" — the per-account breakdown below the hero. Shares the
// `useDashboardHero()` queryKey with HeroSection, so TanStack dedupes into a
// single fetch. The closing row is the total USD holding (a stock, not a
// per-account split). Capped at 6; the full list lives in /accounts.
const MAX_ACCOUNTS = 6
const SWAP_MIN_HEIGHT = 160

// ~44pt effective tap target for the small "Ver todas" link.
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

export const AccountsCard = () => {
  const t = useT()
  const router = useRouter()
  const query = useDashboardHero()
  const data = query.data

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-lg font-semibold text-text">
          {t('dashboard.accounts.title')}
        </Text>
        <Pressable
          onPress={() => router.push('/accounts')}
          accessibilityRole="link"
          hitSlop={LINK_HIT_SLOP}
        >
          <Text className="text-[13px] font-bold text-emerald-deep">
            {t('dashboard.accounts.view_all')}
          </Text>
        </Pressable>
      </View>

      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {data ? (
          <View>
            {data.accounts.slice(0, MAX_ACCOUNTS).map((account, index) => (
              <View
                key={account.id}
                className={`flex-row items-start gap-3 py-3 ${
                  index > 0 ? 'border-t border-border-soft' : ''
                }`}
              >
                <AccountAvatar {...account.avatar} size="sm" />
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-bold text-text"
                    numberOfLines={2}
                  >
                    {account.name}
                  </Text>
                  <View className="mt-2 border-t border-border-soft pt-2">
                    <MaskedAmount
                      amount={account.ars}
                      currency="ARS"
                      className={`text-[15.5px] font-extrabold ${
                        account.ars === 0 ? 'text-text-soft' : 'text-text'
                      }`}
                    />
                  </View>
                </View>
              </View>
            ))}

            {/* USD holding — the bimoneda closing row, emerald like web. */}
            <View className="mt-1 flex-row items-start gap-3 border-t border-border-soft pt-3">
              <View className="mt-1.5 h-2.5 w-2.5 rounded-[3px] bg-emerald" />
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-bold text-emerald-deep"
                  numberOfLines={1}
                >
                  {t('dashboard.accounts.usd_row')}
                </Text>
                <View className="mt-2 border-t border-border-soft pt-2">
                  <MaskedAmount
                    amount={data.usd}
                    currency="USD"
                    showCentsOverride
                    className="text-[15.5px] font-extrabold text-emerald-deep"
                  />
                </View>
              </View>
            </View>
          </View>
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.hero_error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <AccountsCardSkeleton />
        )}
      </View>
    </View>
  )
}
