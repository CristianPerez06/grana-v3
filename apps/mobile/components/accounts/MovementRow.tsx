import { Text, View } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getTodayAR, formatDateISO } from '@grana/money-logic'
import type { TransactionWithDetails } from '@grana/transactions'
import { useShowCents } from '../../lib/preferences-context'
import { useLocale, useT } from '../../lib/locale-context'
import type { Locale } from '../../lib/locale'
import { accountMovementView, resolveCategoryLabel } from '../../lib/accounts/movement-view'

type Props = {
  tx: TransactionWithDetails
  accountId: string
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

// Read-only movement row: date/description + signed amount with tone. No per-row
// running balance — parity with the web app at mobile breakpoints (the running
// balance column is `hidden md:block` on web; the total lives in the hero).
export function MovementRow({ tx, accountId }: Props) {
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
  const formatted =
    view.currencyCode === 'ARS'
      ? formatARS(view.amount, showCents)
      : formatUSD(view.amount, showCents)
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
      <Text className={`text-[14px] font-extrabold tabular-nums ${toneClass}`}>
        {prefix}
        {formatted}
      </Text>
    </View>
  )
}
