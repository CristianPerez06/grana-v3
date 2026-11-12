import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getTodayAR, formatDateISO, legInCurrency, type BalanceCurrency } from '@grana/money-logic'
import {
  resolveTone,
  toFinancialMovement,
  type TransactionWithDetails,
} from '@grana/transactions'
import { toneToClass } from '../movements/tone'
import { useShowCents } from '../../lib/preferences-context'
import { useLocale, useT } from '../../lib/locale-context'
import type { Locale } from '../../lib/locale'
import { accountMovementView, resolveCategoryLabel } from '../../lib/accounts/movement-view'

type Props = {
  tx: TransactionWithDetails
  accountId: string
  /** Account balance per currency AFTER this movement; null hides it (filters active). */
  runningBalance?: Record<BalanceCurrency, number> | null
  /**
   * Currency lens (ARS | USD): the row shows only its leg and the balance in
   * this currency; a same-account exchange shows its outgoing leg in one lens
   * and its incoming leg in the other. Same rule as the web row.
   */
  currencyLens?: BalanceCurrency | null
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
  currencyLens = null,
}: Props) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()

  const fullView = accountMovementView(tx, accountId)
  const lensLeg = currencyLens ? legInCurrency(fullView, currencyLens) : null
  const view = lensLeg ? { ...fullView, ...lensLeg, receivedLeg: undefined } : fullView
  const categoryLabel = resolveCategoryLabel(tx.category, t)
  const todayIso = formatDateISO(getTodayAR())
  const dateLabel = formatMovementDate(tx.date, locale, todayIso) ?? t('common.today')

  const primary = tx.description?.trim() || categoryLabel || view.counterpartyName || dateLabel

  const metaParts = [dateLabel]
  if (categoryLabel && categoryLabel !== primary) metaParts.push(categoryLabel)
  else if (view.counterpartyName && view.counterpartyName !== primary) {
    metaParts.push(view.counterpartyName)
  }

  const formatted = formatMoney(view.amount, view.currencyCode, showCents)
  // Same tone and sign as the web row and the native feed: a transfer or an
  // exchange between own accounts is neutral, neither spending nor income.
  const movement = toFinancialMovement(tx)
  const isPendingReimbursement =
    movement.kind === 'reimbursement' && movement.state !== 'received'
  const toneClass = toneToClass(resolveTone(movement.kind, view.sign, isPendingReimbursement))

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
          {view.sign}
          {formatted}
        </Text>
        {/* Same-account exchange: the leg that came back into this account. */}
        {view.receivedLeg && (
          <Text className={`text-[13px] font-extrabold tabular-nums ${toneClass}`}>
            +{formatMoney(view.receivedLeg.amount, view.receivedLeg.currencyCode, showCents)}
          </Text>
        )}
        {runningBalance && (
          <Text className="mt-1 text-[12px] font-bold tabular-nums text-text-muted">
            {formatMoney(runningBalance[view.currencyCode], view.currencyCode, showCents)}
          </Text>
        )}
      </View>
    </View>
  )
}
