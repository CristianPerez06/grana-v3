import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Money } from '@grana/validation'
import type {
  UpcomingFortnight,
  UpcomingItem,
  UpcomingItemTarget,
} from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { MaskedAmount } from './MaskedAmount'

type Props = {
  data: UpcomingFortnight
}

type TotalsByCurrency = { ARS: number; USD: number }

function sumByCurrency(items: UpcomingItem[]): TotalsByCurrency {
  let ars = Money.from(0)
  let usd = Money.from(0)
  for (const item of items) {
    if (item.currency === 'ARS') ars = Money.add(ars, Money.from(item.amount))
    else if (item.currency === 'USD') usd = Money.add(usd, Money.from(item.amount))
  }
  return { ARS: Money.toNumber(ars), USD: Money.toNumber(usd) }
}

function formatItemDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Mobile route mapping for upcoming item targets. The cards module mobile
// doesn't yet have detail-of-period or detail-of-card routes, so both kinds
// fall back to the `/tarjetas` tab (decisión transitoria documentada en spec).
function routeForUpcomingItem(_target: UpcomingItemTarget): string {
  return '/tarjetas'
}

type GroupProps = {
  title: string
  items: UpcomingItem[]
  direction: 'pay' | 'collect'
}

const Group = ({ title, items, direction }: GroupProps) => {
  const router = useRouter()
  const totals = sumByCurrency(items)
  const sign = direction === 'pay' ? '−' : '+'

  return (
    <View className="flex-col gap-3">
      <Text className="text-xs font-semibold uppercase text-text-muted">
        {title}
      </Text>
      {items.length === 0 ? (
        <Text className="text-sm text-text-muted">—</Text>
      ) : (
        <View className="flex-col gap-2">
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(routeForUpcomingItem(item.target))}
              accessibilityRole="button"
              className="flex-row items-baseline justify-between gap-3 rounded-md py-1.5"
            >
              <View className="min-w-0 flex-row items-baseline gap-2">
                <Text className="text-xs font-medium text-text-muted">
                  {formatItemDate(item.date)}
                </Text>
                <Text className="text-sm text-text" numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <View className="shrink-0 flex-row items-baseline">
                <Text
                  className={`text-sm font-semibold ${
                    direction === 'pay' ? 'text-text' : 'text-emerald'
                  }`}
                >
                  {sign}
                </Text>
                <MaskedAmount
                  amount={item.amount}
                  currency={item.currency}
                  className={`text-sm font-semibold ${
                    direction === 'pay' ? 'text-text' : 'text-emerald'
                  }`}
                />
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {items.length > 0 && (
        <View className="mt-1 border-t border-border-soft pt-2">
          {totals.ARS !== 0 && (
            <View className="flex-row items-baseline justify-between">
              <Text className="text-xs text-text-muted">Total</Text>
              <MaskedAmount
                amount={totals.ARS}
                currency="ARS"
                className="text-xs text-text-muted"
              />
            </View>
          )}
          {totals.USD !== 0 && (
            <View className="flex-row items-baseline justify-between">
              <Text className="text-xs text-text-muted">
                {totals.ARS !== 0 ? '' : 'Total'}
              </Text>
              <MaskedAmount
                amount={totals.USD}
                currency="USD"
                showCentsOverride
                className="text-xs text-text-muted"
              />
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export const UpcomingFortnightSection = ({ data }: Props) => {
  const t = useT()
  const totalPayARS = sumByCurrency(data.toPay).ARS
  const totalPayUSD = sumByCurrency(data.toPay).USD
  const totalCollectARS = sumByCurrency(data.toCollect).ARS
  const totalCollectUSD = sumByCurrency(data.toCollect).USD

  const balanceARS = Money.toNumber(
    Money.subtract(Money.from(totalCollectARS), Money.from(totalPayARS)),
  )
  const balanceUSD = Money.toNumber(
    Money.subtract(Money.from(totalCollectUSD), Money.from(totalPayUSD)),
  )

  const hasAny = data.toPay.length > 0 || data.toCollect.length > 0

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-4 flex-row items-baseline justify-between">
        <Text className="text-lg font-semibold text-text">
          {t('dashboard.upcoming.title')}
        </Text>
        <Text className="text-xs text-text-muted">
          {t('dashboard.upcoming.subtitle')}
        </Text>
      </View>

      {hasAny ? (
        <View className="flex-col gap-6">
          <Group title={t('dashboard.upcoming.to_pay')} items={data.toPay} direction="pay" />
          <Group title={t('dashboard.upcoming.to_collect')} items={data.toCollect} direction="collect" />

          <View className="border-t border-border-soft pt-4">
            <Text className="text-xs font-medium uppercase text-text-muted">
              {t('dashboard.upcoming.period_balance')}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
              {(balanceARS !== 0 || (totalPayARS === 0 && totalCollectARS === 0)) && (
                <View className="flex-row items-baseline">
                  <Text
                    className={`text-xl font-bold ${
                      balanceARS > 0
                        ? 'text-emerald'
                        : balanceARS < 0
                          ? 'text-negative'
                          : 'text-text'
                    }`}
                  >
                    {balanceARS > 0 ? '+ ' : ''}
                  </Text>
                  <MaskedAmount
                    amount={balanceARS}
                    currency="ARS"
                    className={`text-xl font-bold ${
                      balanceARS > 0
                        ? 'text-emerald'
                        : balanceARS < 0
                          ? 'text-negative'
                          : 'text-text'
                    }`}
                  />
                </View>
              )}
              {balanceUSD !== 0 && (
                <View className="flex-row items-baseline">
                  <Text
                    className={`text-sm font-semibold ${
                      balanceUSD > 0
                        ? 'text-emerald'
                        : balanceUSD < 0
                          ? 'text-negative'
                          : 'text-text'
                    }`}
                  >
                    {balanceUSD > 0 ? '+ ' : ''}
                  </Text>
                  <MaskedAmount
                    amount={balanceUSD}
                    currency="USD"
                    showCentsOverride
                    className={`text-sm font-semibold ${
                      balanceUSD > 0
                        ? 'text-emerald'
                        : balanceUSD < 0
                          ? 'text-negative'
                          : 'text-text'
                    }`}
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <Text className="text-sm text-text-muted">
          {t('dashboard.upcoming.empty')}
        </Text>
      )}
    </View>
  )
}
