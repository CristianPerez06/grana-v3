import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { computeConcentration } from '@grana/dashboard'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { useT } from '../../lib/locale-context'
import { accountColors } from '../../lib/colors'
import { useDashboardHero } from '../../lib/dashboard/queries'
import { Button } from '../ui/Button'
import { AccountsCardSkeleton } from './AccountsCardSkeleton'
import { MaskedAmount } from './MaskedAmount'

// "Dónde está" — concentration view (mobile parity of the web redesign): a big
// "%" callout for the dominant account, a proportional concentration bar (one
// segment per account, widths derived from the data), and a compact 2-col grid
// for the rest + the USD holding. Shares the `useDashboardHero()` queryKey with
// HeroSection (single fetch). Capped at 6; the full list lives in /accounts.
const MAX_ACCOUNTS = 6
const SWAP_MIN_HEIGHT = 160

// ~44pt effective tap target for the small "Ver todas" link.
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const

// Account identity color (mirror of the web avatarColor): palette key token,
// else institution override, else slate.
const avatarColor = (avatar: ResolvedAccountAvatar): string =>
  avatar.colorKey ? accountColors[avatar.colorKey] : (avatar.colorOverride ?? accountColors.slate)

export const AccountsCard = () => {
  const t = useT()
  const router = useRouter()
  const query = useDashboardHero()
  const data = query.data

  const accounts = data ? data.accounts.slice(0, MAX_ACCOUNTS) : []
  const concentration = computeConcentration(accounts)
  const pctById = new Map(concentration.segments.map((s) => [s.id, s.pct]))
  const dominant = concentration.dominantId
    ? accounts.find((a) => a.id === concentration.dominantId)
    : undefined
  const rest = accounts.filter((a) => a.id !== dominant?.id)

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
          <View className="gap-4">
            {/* Concentration callout — only with a positive ARS balance. */}
            {dominant && concentration.dominantPct !== null && (
              <View className="flex-row items-center gap-3">
                <Text
                  className="text-[44px] font-extrabold"
                  style={{ color: avatarColor(dominant.avatar) }}
                >
                  {concentration.dominantPct}%
                </Text>
                <Text className="flex-1 text-[13px] font-semibold text-text-muted">
                  {t('dashboard.accounts.concentration_lead')}
                  {'\n'}
                  <Text className="font-bold text-text">{dominant.name} </Text>
                </Text>
              </View>
            )}

            {/* Concentration bar — one segment per account, width ∝ ARS share. */}
            {concentration.segments.length > 0 && (
              <View
                className="h-4 flex-row overflow-hidden rounded-[7px]"
                style={{ gap: 2 }}
              >
                {accounts
                  .filter((a) => (pctById.get(a.id) ?? 0) > 0)
                  .map((a) => (
                    <View
                      key={a.id}
                      style={{
                        flexGrow: pctById.get(a.id) ?? 0,
                        flexBasis: 0,
                        minWidth: 6,
                        backgroundColor: avatarColor(a.avatar),
                      }}
                    />
                  ))}
              </View>
            )}

            {/* Compact grid — remaining accounts + the USD holding. */}
            <View className="flex-row flex-wrap">
              {rest.map((account) => (
                <View key={account.id} className="w-1/2 flex-row items-center gap-2 py-1.5 pr-3">
                  <View
                    className="h-2 w-2 rounded-[3px]"
                    style={{ backgroundColor: avatarColor(account.avatar) }}
                  />
                  <Text className="flex-1 text-[13px] font-bold text-text" numberOfLines={1}>
                    {account.name}
                  </Text>
                  <MaskedAmount
                    amount={account.ars}
                    currency="ARS"
                    className={`text-[13px] font-extrabold ${
                      account.ars === 0 ? 'text-text-soft' : 'text-text'
                    }`}
                  />
                </View>
              ))}

              {/* USD holding — emerald closing cell. */}
              <View className="w-1/2 flex-row items-center gap-2 py-1.5 pr-3">
                <View className="h-2 w-2 rounded-[3px] bg-emerald" />
                <Text className="flex-1 text-[13px] font-bold text-emerald-deep" numberOfLines={1}>
                  {t('dashboard.accounts.usd_row')}
                </Text>
                <MaskedAmount
                  amount={data.usd}
                  currency="USD"
                  showCentsOverride
                  className="text-[13px] font-extrabold text-emerald-deep"
                />
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
