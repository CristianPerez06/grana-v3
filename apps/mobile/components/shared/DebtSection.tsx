import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { BalanceCurrency } from '@grana/money-logic'
import type { DebtByCurrency } from '../../lib/shared/queries'
import { Button } from '../ui/Button'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { fmtMoney } from './money'
import { CARD } from './ui'

type Props = {
  debt: DebtByCurrency
  youId: string
  youName: string
  partnerName: string
}

const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] ?? ''
const initial = (n: string) => (n.trim()[0] || '?').toUpperCase()

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      <Text className="text-lg font-black text-white">{initial(name)}</Text>
    </View>
  )
}

// "Qué se deben hoy" — the net debt strip, today-anchored (does NOT follow the
// month navigator). Bimoneda: ARS leads with the two-member avatars + a
// directional bar, USD subordinate as a pill. Natural language, never jargon.
// Mirror of web's debt-section.
export function DebtSection({ debt, youId, youName, partnerName }: Props) {
  const t = useT()
  const router = useRouter()

  const you = firstName(youName)
  const partner = firstName(partnerName)

  const balanceForYou = (cur: BalanceCurrency): number => {
    const d = debt[cur]
    if (!d || d.kind === 'settled') return 0
    return d.to === youId ? d.amount : -d.amount
  }
  const ars = balanceForYou('ARS')
  const usd = balanceForYou('USD')
  const arsSettled = Math.abs(ars) < 0.01
  const usdSettled = Math.abs(usd) < 0.01
  const youOwe = (['ARS', 'USD'] as const).some((c) => {
    const d = debt[c]
    return d?.kind === 'owes' && d.from === youId
  })

  return (
    <View className={`${CARD} p-5`}>
      <Text className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
        {t('shared.dashboard.debt_today_title')}
      </Text>

      <View className="mt-3.5 flex-row items-center justify-center gap-3.5">
        <Avatar name={you} color={colors.slate} />
        <View className="items-center gap-1.5">
          <Text
            className={`text-2xl font-black ${arsSettled || ars > 0 ? 'text-positive' : 'text-negative'}`}
          >
            {arsSettled ? t('shared.dashboard.settled') : fmtMoney(Math.abs(ars), 'ARS')}
          </Text>
          {!arsSettled && (
            <View className="h-[3px] w-16 flex-row overflow-hidden rounded-full">
              <View
                className="flex-1"
                style={{ backgroundColor: ars < 0 ? colors.slate : colors.terracotta }}
              />
              <View
                className="flex-1"
                style={{ backgroundColor: ars < 0 ? colors.terracotta : colors.slate }}
              />
            </View>
          )}
        </View>
        <Avatar name={partner} color={colors.terracotta} />
      </View>

      <Text className="mt-3 text-center text-xs font-bold text-text-muted">
        {arsSettled
          ? t('shared.dashboard.settled')
          : ars > 0
            ? t('shared.dashboard.owes_to', { from: partner, to: you })
            : t('shared.dashboard.owes_to', { from: you, to: partner })}{' '}
        · {t('shared.dashboard.in_pesos')}
      </Text>

      <View className="mt-3 flex-row justify-center">
        <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-soft px-3 py-1.5">
          <View className="rounded-full bg-emerald/20 px-1.5 py-0.5">
            <Text className="text-[9.5px] font-extrabold tracking-wide text-emerald-deep">USD</Text>
          </View>
          <Text className="text-[12.5px] font-bold text-emerald-deep">
            {usdSettled
              ? t('shared.dashboard.settled')
              : `${
                  usd > 0
                    ? t('shared.dashboard.you_are_owed', { name: partner })
                    : t('shared.dashboard.you_owe', { name: partner })
                } ${fmtMoney(Math.abs(usd), 'USD')}`}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-2 border-t border-border-soft pt-4">
        {youOwe && (
          <View className="flex-1">
            <Button variant="primary" onPress={() => router.push('/home/settle')}>
              {t('shared.dashboard.settle_action')}
            </Button>
          </View>
        )}
        <View className="flex-1">
          <Button variant="secondary" onPress={() => router.push('/home/cuenta-corriente')}>
            {t('shared.dashboard.current_account_action')}
          </Button>
        </View>
      </View>
    </View>
  )
}
