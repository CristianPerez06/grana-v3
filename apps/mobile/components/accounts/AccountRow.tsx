import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { AccountWithBalances } from '@grana/accounts'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'
import { AccountAvatar } from '../ui/AccountAvatar'
import { AccountRowMenu } from './AccountRowMenu'

type Props = {
  account: AccountWithBalances
}

// One account row: avatar + name/institution + ARS/USD balances + action menu.
// ARS is the primary balance, USD secondary (never summed/converted). Only an
// active currency contributes a balance line. Mirror of web's AccountRow.
export function AccountRow({ account }: Props) {
  const t = useT()
  const router = useRouter()
  const showCents = useShowCents()

  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')

  const institutionName = account.institution?.name ?? null
  const title = institutionName ?? account.name
  const subtitle = institutionName && institutionName !== account.name ? account.name : null

  const open = () =>
    router.push({ pathname: '/(app)/accounts/[id]', params: { id: account.id } })

  return (
    <View className="flex-row items-center gap-3 px-[18px] py-[15px]">
      <AccountAvatar {...account.avatar} size="md" />

      <Pressable className="flex-1 flex-col gap-1" onPress={open} accessibilityRole="button">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-[15px] font-semibold text-text">{title}</Text>
          {!account.is_active && (
            <View className="rounded-full bg-warning-soft px-2 py-0.5">
              <Text className="text-[10px] font-extrabold uppercase text-warning">
                {t('accounts.badges.archived')}
              </Text>
            </View>
          )}
        </View>
        {subtitle && <Text className="text-[13px] text-text-soft">{subtitle}</Text>}
        <View className="mt-1 flex-row items-baseline gap-2">
          {hasARS && (
            <Text className="text-[15px] font-semibold tabular-nums text-text">
              {formatARS(account.balances.ARS, showCents)}
            </Text>
          )}
          {hasUSD && (
            <Text className="text-[13px] tabular-nums text-text-soft">
              {formatUSD(account.balances.USD, showCents)}
            </Text>
          )}
        </View>
      </Pressable>

      <AccountRowMenu account={account} />
    </View>
  )
}
