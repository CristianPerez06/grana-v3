import { Text, View } from 'react-native'
import { ArrowUpRight, CreditCard, Repeat } from 'lucide-react-native'
import type { CommittedCurrency } from '@grana/dashboard'
import { useT } from '../../lib/locale-context'
import { useCommittedOutlook } from '../../lib/dashboard/queries'
import { colors } from '../../lib/colors'
import { Button } from '../ui/Button'
import { CommittedSkeleton } from './CommittedSkeleton'
import { MaskedAmount } from './MaskedAmount'
import { MaskedAmountDisplay } from './MaskedAmountDisplay'

const SWAP_MIN_HEIGHT = 240

// Token mirror for inline icon backgrounds (RN can't read CSS vars).
const NAVY = colors.navy
const TERRACOTTA = '#B56A5A'

const committedTotal = (c: CommittedCurrency) => c.debt + c.recurringExpense

const Tile = ({
  icon,
  iconBg,
  label,
  hint,
  amount,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  hint?: string
  amount: number
}) => (
  <View className="gap-2 rounded-2xl border border-border p-4">
    <View
      className="h-8 w-8 items-center justify-center rounded-lg"
      style={{ backgroundColor: iconBg }}
    >
      {icon}
    </View>
    <Text className="text-[12px] font-bold text-text-muted">
      {label}
      {hint ? <Text className="font-medium text-text-soft"> {hint}</Text> : null}
    </Text>
    <MaskedAmount amount={amount} currency="ARS" className="text-[19px] font-extrabold text-text" />
  </View>
)

// Splits a single-tag rich phrase ("…<amount></amount>…") so native can inject
// the masked amount node where the web `t.rich` tag would render it.
const NetBand = ({ net, surplus, phrase }: { net: number; surplus: boolean; phrase: string }) => {
  const m = phrase.match(/^([\s\S]*)<amount><\/amount>([\s\S]*)$/)
  const before = m?.[1] ?? phrase
  const after = m?.[2] ?? ''
  return (
    <View className={`mt-3 rounded-2xl px-4 py-3 ${surplus ? 'bg-emerald-soft' : 'bg-border-soft'}`}>
      <Text className={`text-[12.5px] font-semibold ${surplus ? 'text-emerald-deep' : 'text-negative'}`}>
        {before}
        <MaskedAmountDisplay
          amount={Math.abs(net)}
          currency="ARS"
          signPrefix={surplus ? '+' : undefined}
          className="font-extrabold"
          decimalClassName="opacity-70"
        />
        {after}
      </Text>
    </View>
  )
}

// "Comprometido" (mobile parity) — COMPROMISO lens: card debt + next-month
// recurring outflows as two tiles. With recurring income, a green "Ya entra"
// tile + a net closing band appear; the income never sums into the total.
// Static "from today": it does NOT follow the month navigator.
export const CommittedSection = () => {
  const t = useT()
  const query = useCommittedOutlook()
  const data = query.data

  const ars = data?.ARS
  const usd = data?.USD
  const totalArs = ars ? committedTotal(ars) : 0
  const hasIncome = ars ? ars.recurringIncome > 0 : false
  const net = ars ? ars.recurringIncome - totalArs : 0
  const surplus = net >= 0

  const isEmpty =
    ars && usd
      ? committedTotal(ars) === 0 &&
        committedTotal(usd) === 0 &&
        ars.recurringIncome === 0 &&
        usd.recurringIncome === 0
      : false

  return (
    <View className="rounded-2xl border border-border bg-card p-6">
      <View className="mb-0.5">
        <Text className="text-lg font-semibold text-text">{t('dashboard.committed.title')}</Text>
        <Text numberOfLines={1} className="text-[12.5px] text-text-soft">
          {t('dashboard.committed.question')}
        </Text>
      </View>

      <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
        {ars && usd ? (
          isEmpty ? (
            <View className="items-center justify-center px-4">
              <Text className="text-center text-sm text-text-muted">
                {t('dashboard.committed.empty')}
              </Text>
            </View>
          ) : (
            <View>
              {/* Total comprometido = lo que sale (deuda + gastos recurrentes). */}
              <Text className="text-xs font-extrabold uppercase text-text-soft">
                {t('dashboard.committed.total_label')}
              </Text>
              <View className="mt-1.5">
                <MaskedAmountDisplay
                  amount={totalArs}
                  currency="ARS"
                  className="text-[30px] font-extrabold text-text"
                  decimalClassName="text-[15px] opacity-55"
                />
              </View>

              {hasIncome && (
                <Text className="mt-4 text-[11px] font-extrabold uppercase text-terracotta">
                  {t('dashboard.committed.outflow_label')}
                </Text>
              )}

              <View className={`gap-3 ${hasIncome ? 'mt-2' : 'mt-5'}`}>
                <Tile
                  icon={<CreditCard size={16} color="#FFFFFF" strokeWidth={2.25} />}
                  iconBg={NAVY}
                  label={t('dashboard.committed.debt')}
                  amount={ars.debt}
                />
                <Tile
                  icon={<Repeat size={16} color="#FFFFFF" strokeWidth={2.25} />}
                  iconBg={TERRACOTTA}
                  label={t('dashboard.committed.recurring_expense')}
                  hint={t('dashboard.committed.next_month')}
                  amount={ars.recurringExpense}
                />
              </View>

              {hasIncome && (
                <>
                  <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-emerald/40 bg-emerald-soft p-4">
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald">
                      <ArrowUpRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12px] font-bold text-emerald-deep">
                        {t('dashboard.committed.income_tile_title')}
                      </Text>
                      <Text numberOfLines={1} className="text-[11px] font-medium text-emerald-deep">
                        {t('dashboard.committed.income_tile_sub')}
                      </Text>
                    </View>
                    <MaskedAmountDisplay
                      amount={ars.recurringIncome}
                      currency="ARS"
                      signPrefix="+"
                      className="text-[17px] font-extrabold text-emerald-deep"
                      decimalClassName="text-[10px] opacity-70"
                    />
                  </View>

                  <NetBand
                    net={net}
                    surplus={surplus}
                    phrase={t(
                      surplus
                        ? 'dashboard.committed.net_surplus'
                        : 'dashboard.committed.net_deficit',
                    )}
                  />
                </>
              )}

              {/* USD strip — bimoneda por defecto; ceros cuando no hay actividad USD. */}
              <View className="mt-5 flex-row flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-3.5">
                <View className="rounded-full bg-emerald-soft px-2.5 py-0.5">
                  <Text className="text-[11px] font-extrabold text-emerald-deep">USD</Text>
                </View>
                <MaskedAmount
                  amount={committedTotal(usd)}
                  currency="USD"
                  showCentsOverride
                  className="text-[17px] font-extrabold text-text"
                />
              </View>
            </View>
          )
        ) : query.isError ? (
          <View className="items-center justify-center gap-3 px-4">
            <Text className="text-center text-sm text-text-muted">
              {t('dashboard.committed.error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => query.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : (
          <CommittedSkeleton />
        )}
      </View>
    </View>
  )
}
