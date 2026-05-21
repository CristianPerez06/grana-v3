import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Money } from '@grana/validation'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CreditCardSummary } from '../../lib/cards/queries'
import { useEyeMask } from './EyeMaskContext'
import { useShowCents } from '../../lib/preferences-context'

type Props = {
  card: CreditCardSummary
  width: number
}

const MASK = '••••••'

const alertBorderClass: Record<'red' | 'amber' | 'none', string> = {
  red: 'border-l-negative',
  amber: 'border-l-amber',
  none: 'border-l-border',
}

export const CreditCardItem = ({ card, width }: Props) => {
  const router = useRouter()
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  const period = card.activePeriod
  const alert = period?.alert ?? 'none'
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)

  const usedPercent =
    card.credit_limit && card.credit_limit > 0
      ? Math.min(100, Math.round((pendingARS / card.credit_limit) * 100))
      : null

  const renderARS = (amount: number) => (masked ? MASK : formatARS(amount, showCents))
  const renderUSD = (amount: number) => (masked ? MASK : formatUSD(amount, showCents))

  const available =
    card.credit_limit && card.credit_limit > 0
      ? Money.toNumber(Money.subtract(Money.from(card.credit_limit), Money.from(pendingARS)))
      : 0

  return (
    <Pressable
      onPress={() => router.push('/tarjetas')}
      accessibilityRole="button"
      style={{ width }}
      className={`mr-4 rounded-xl border border-border border-l-4 ${alertBorderClass[alert]} bg-card p-4`}
    >
      {/* Header */}
      <View className="mb-3 flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-text" numberOfLines={1}>
            {card.name}
          </Text>
          {!card.is_active && (
            <Text className="text-xs italic text-text-muted">Archivada</Text>
          )}
        </View>
        {alert === 'red' && (
          <View className="rounded-full bg-negative/10 px-2 py-0.5">
            <Text className="text-xs font-medium text-negative">Vencido</Text>
          </View>
        )}
        {alert === 'amber' && (
          <View className="rounded-full bg-amber/10 px-2 py-0.5">
            <Text className="text-xs font-medium text-amber">Por vencer</Text>
          </View>
        )}
      </View>

      {/* Amounts. Bimoneda por defecto: si la tarjeta tiene USD activo lo
          mostramos siempre, incluso en cero. */}
      <View className="mb-3">
        <Text className="text-2xl font-bold text-text">{renderARS(pendingARS)}</Text>
        {hasUSD && (
          <Text className="mt-0.5 text-xs text-text-muted">{renderUSD(pendingUSD)}</Text>
        )}
      </View>

      {/* Credit limit bar */}
      {usedPercent !== null && (
        <View>
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
            <View
              style={{ width: `${usedPercent}%` }}
              className={`h-full rounded-full ${
                usedPercent >= 90
                  ? 'bg-negative'
                  : usedPercent >= 70
                    ? 'bg-amber'
                    : 'bg-emerald'
              }`}
            />
          </View>
          <Text className="mt-1 text-xs text-text-muted">
            {usedPercent}% usado · {renderARS(available)} disponible
          </Text>
        </View>
      )}
    </Pressable>
  )
}
