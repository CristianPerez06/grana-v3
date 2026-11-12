import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getTodayAR, formatDateISO, type BalanceCurrency } from '@grana/money-logic'
import type { TransactionWithDetails } from '@grana/transactions'
import { useShowCents } from '../../lib/preferences-context'
import { useLocale, useT } from '../../lib/locale-context'
import type { Locale } from '../../lib/locale'
import { accountMovementView, resolveCategoryLabel } from '../../lib/accounts/movement-view'

type Props = {
  tx: TransactionWithDetails
  accountId: string
  /** Account balance per currency AFTER this movement; null hides it (filters active). */
  runningBalance?: Record<BalanceCurrency, number> | null
  /** Which currencies of the balance to show, ARS first — the same for every row of the account. */
  runningBalanceCurrencies?: readonly BalanceCurrency[]
}

const MONTHS: Record<Locale, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function formatMovementDate(iso: string, locale: Locale, today: string): string | null {
  if (iso === today) return null // caller substitutes "Hoy"
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return iso
  return `${d} ${MONTHS[locale][m - 1]}`
}

const formatMoney = (amount: number, currency: BalanceCurrency, showCents: boolean) =>
  currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

// Read-only movement row: date/description + signed amount with tone, and under
// the amount the running balance (saldo corriente) — parity with the web app at
// phone width, where the balance has no column of its own and sits under the
// amount. A same-account exchange shows both legs.
export function MovementRow({
  tx,
  accountId,
  runningBalance = null,
  runningBalanceCurrencies = [],
}: Props) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()

  const view = accountMovementView(tx, accountId)
  const categoryLabel = resolveCategoryLabel(tx.category, t)
  const todayIso = formatDateISO(getTodayAR())
  const dateLabel = formatMovementDate(tx.date, locale, todayIso) ?? t('common.today')

  const primary = tx.description?.trim() || categoryLabel || view.counterpartyName || dateLabel

  const metaParts = [dateLabel]
  if (categoryLabel && categoryLabel !== primary) metaParts.push(categoryLabel)
  else if (view.counterpartyName && view.counterpartyName !== primary) {
    metaParts.push(view.counterpartyName)
  }

  const prefix = view.sign === '+' ? '+ ' : view.sign === '-' ? '- ' : ''
  const formatted = formatMoney(view.amount, view.currencyCode, showCents)
  const toneClass =
    view.sign === '+' ? 'text-emerald-deep' : view.sign === '-' ? 'text-negative' : 'text-text'

  return (
    <View className="flex-row items-center gap-3 px-[18px] py-[13px]">
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-bold text-text" numberOfLines={1}>
          {primary}
        </Text>
        <Text className="mt-0.5 text-[12px] text-text-muted" numberOfLines={1}>
          {metaParts.join(' · ')}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-[14px] font-extrabold tabular-nums ${toneClass}`}>
          {prefix}
          {formatted}
        </Text>
        {/* Same-account exchange: the leg that came back into this account. */}
        {view.receivedLeg && (
          <Text className="text-[13px] font-extrabold tabular-nums text-emerald-deep">
            {'+ '}
            {formatMoney(view.receivedLeg.amount, view.receivedLeg.currencyCode, showCents)}
          </Text>
        )}
        {runningBalance && runningBalanceCurrencies.length > 0 && (
          <View className="mt-1.5 items-end">
            {runningBalanceCurrencies.map((currency) => (
              <Text
                key={currency}
                className={`tabular-nums text-text-muted ${
                  currency === 'USD' && runningBalanceCurrencies.length > 1
                    ? 'text-[11px] font-semibold'
                    : 'text-[12px] font-bold'
                }`}
              >
                {formatMoney(runningBalance[currency], currency, showCents)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
