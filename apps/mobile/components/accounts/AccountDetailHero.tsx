import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { AccountWithBalances } from '@grana/accounts'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'
import { AccountAvatar } from '../ui/AccountAvatar'

type Props = {
  account: AccountWithBalances
}

// Navy hero: account identity (avatar + name + institution/type + archived badge)
// and the ARS/USD balances. ARS primary, USD secondary — never summed/converted.
export function AccountDetailHero({ account }: Props) {
  const t = useT()
  const showCents = useShowCents()

  const active = account.currencies.filter((c) => c.is_active)
  const hasARS = active.some((c) => c.currency_code === 'ARS')
  const hasUSD = active.some((c) => c.currency_code === 'USD')

  const meta =
    account.type === 'bank' && account.institution
      ? `${account.institution.name} · ${t('accounts.types.bank')}`
      : t('accounts.types.cash')

  return (
    <View className="gap-5 rounded-3xl bg-navy p-6">
      <View className="flex-row items-center gap-3">
        <AccountAvatar {...account.avatar} size="md" />
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-lg font-extrabold text-white">{account.name}</Text>
            {!account.is_active && (
              <View className="rounded-full bg-warning-soft px-2 py-0.5">
                <Text className="text-[10px] font-extrabold uppercase text-warning">
                  {t('accounts.badges.archived')}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-[13px] text-navy-muted">{meta}</Text>
        </View>
      </View>

      <View>
        <Text className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy-muted">
          {t('accounts.labels.balance')}
        </Text>
        {hasARS && (
          <Text className="mt-2 text-[34px] font-black tabular-nums text-white">
            {formatARS(account.balances.ARS, showCents)}
          </Text>
        )}
        {hasUSD && (
          <Text className="mt-1 text-base font-extrabold tabular-nums text-navy-muted">
            {formatUSD(account.balances.USD, showCents)}
          </Text>
        )}
      </View>
    </View>
  )
}
