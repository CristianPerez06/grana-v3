import { Text, View } from 'react-native'
import Svg, { Circle, Polyline } from 'react-native-svg'
import type { BalanceCurrency, OutlookMonth } from '@grana/money-logic'
import type { DebtByCurrency } from '../../lib/shared/queries'
import { useLocale, useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { fmtMoney } from './money'
import { CARD } from './ui'

type Props = {
  outlook: Record<BalanceCurrency, OutlookMonth[]> | null
  debt: DebtByCurrency | null
  youId: string
}

const W = 300
const H = 72
const P = 8

function points(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  return values.map((v, i) => {
    const x = P + (i / (values.length - 1)) * (W - 2 * P)
    const y = H - P - ((v - min) / range) * (H - 2 * P)
    return [x, y] as const
  })
}

// "Lo que se viene" — forward projection tile, today-anchored (independent of
// the month navigator): amber next-impact badge, a sparkline of the projected
// balance (today → upcoming months), and the projected end balance. Mirror of
// web's outlook-section.
export function OutlookSection({ outlook, debt, youId }: Props) {
  const t = useT()
  const locale = useLocale()

  const balanceForYou = (cur: BalanceCurrency): number => {
    const d = debt?.[cur]
    if (!d || d.kind === 'settled') return 0
    return d.to === youId ? d.amount : -d.amount
  }
  const arsForYou = balanceForYou('ARS')

  const arsMonths = outlook?.ARS ?? []
  const projMonths = arsMonths.filter((m) => m.items.length > 0)
  const projValues = [arsForYou, ...arsMonths.map((m) => m.cumulativeForA)]
  const projectedEnd = arsMonths.length ? arsMonths[arsMonths.length - 1].cumulativeForA : arsForYou
  const nextImpact = projMonths[0]?.items[0]

  const monthShort = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1)
      .toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', { month: 'short' })
      .replace('.', '')
  }

  const varies = projValues.some((v, i) => i > 0 && v !== projValues[0])
  const pts = varies && projValues.length >= 2 ? points(projValues) : null

  return (
    <View className={`${CARD} p-5`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
          {t('shared.dashboard.upcoming_home')}
        </Text>
        <View className="rounded-full bg-slate-soft px-2.5 py-0.5">
          <Text className="text-[10px] font-bold text-slate">{t('shared.dashboard.projection')}</Text>
        </View>
      </View>

      {projMonths.length === 0 ? (
        <View className="items-center gap-1.5 py-6">
          <Text className="text-3xl">🌴</Text>
          <Text className="text-sm font-extrabold text-text">
            {t('shared.dashboard.upcoming_none_title')}
          </Text>
          <Text className="text-center text-xs text-text-muted">
            {t('shared.dashboard.upcoming_none_hint')}
          </Text>
        </View>
      ) : (
        <>
          {nextImpact && (
            <View className="mt-3 flex-row items-center gap-2 self-start rounded-xl bg-warning-soft px-3 py-2">
              <View className="h-2 w-2 rounded-full bg-warning" />
              <Text className="text-[12.5px] font-bold text-warning-deep">
                {t('shared.dashboard.next_impact')}: {nextImpact.label}
                {projMonths[0] ? ` · ${monthShort(projMonths[0].month)}` : ''}
              </Text>
            </View>
          )}

          {pts && (
            <>
              <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginTop: 12 }}>
                <Polyline
                  points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={colors.positive}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={pts[0][0]} cy={pts[0][1]} r={4.5} fill={projValues[0] < 0 ? colors.terracotta : colors.positive} />
                <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={5} fill={colors.positive} />
              </Svg>
              <View className="mt-1 flex-row justify-between px-1">
                <Text className="text-[11px] font-bold text-negative">
                  {t('shared.dashboard.today_short')}
                </Text>
                {arsMonths.map((mo, i) => (
                  <Text
                    key={mo.month}
                    className={`text-[11px] font-bold ${i === arsMonths.length - 1 ? 'text-positive' : 'text-text-muted'}`}
                  >
                    {monthShort(mo.month)}
                  </Text>
                ))}
              </View>
            </>
          )}

          <View className="mt-3 flex-row items-baseline justify-center gap-2 border-t border-border-soft pt-3">
            <Text className={`text-2xl font-black ${projectedEnd >= 0 ? 'text-positive' : 'text-negative'}`}>
              {projectedEnd >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(projectedEnd), 'ARS')}
            </Text>
            <Text className="text-xs text-text-muted">{t('shared.dashboard.projected_balance')}</Text>
          </View>
        </>
      )}
    </View>
  )
}
