import { Pressable, Text, View } from 'react-native'
import type { MovementPerspective } from '@grana/money-logic'
import type { FinancialMovement } from '@grana/transactions'
import { useLocale, useT } from '../../lib/locale-context'
import type { Locale } from '../../lib/locale'
import { MovementRow } from './MovementRow'

/** Date arithmetic on an ISO day string (`todayISO` is injected, no tz "today"). */
const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Hermes has no full `Intl` (no `toLocaleDateString` with weekday/month), so the
// group header is composed from hand-rolled tables — same approach as the
// accounts MovementRow.
const WEEKDAYS: Record<Locale, readonly string[]> = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}
const MONTHS: Record<Locale, readonly string[]> = {
  es: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
}

/** Why the list is empty — copy injected by the caller. */
export type MovementEmptyState = {
  title: string
  body: string
  /**
   * Optional way out. The feed's "no movement matches your filters" variant
   * needs one: unlike an empty month, that state is a consequence of what the
   * user just did, so showing it without an undo strands them.
   */
  action?: { label: string; onPress: () => void }
}

type Props = {
  movements: FinancialMovement[]
  perspective: MovementPerspective
  /** Financial "today" (from getTodayAR) — used for the Hoy/Ayer group labels. */
  todayISO: string
  /** Per-movement installment chip labels (e.g. "Cuota 2 de 6"), keyed by id. */
  installmentChips?: Map<string, string>
  /** Group rows under date headers (Hoy / Ayer / weekday). On by default. */
  groupByDate?: boolean
  /** Empty-state copy. Absent ⇒ nothing rendered when there are no movements. */
  emptyState?: MovementEmptyState
  /** Show the owning account in each row's subtitle — the global feed spans accounts. */
  showAccount?: boolean
  /** Show the feed-only row badges ("Revisar" / "Compartido"). */
  showFeedBadges?: boolean
  /** Navigate to a movement's detail on tap. Absent ⇒ rows render flat. */
  onPressMovement?: (movement: FinancialMovement) => void
}

/**
 * Native movement list, mirror of the web `MovementList` (same name + public
 * props), scoped to what the card statement pane uses. Groups rows by date with
 * Hoy/Ayer/weekday headers. Rows are navigable when `onPressMovement` is passed
 * (the global feed opens `/transactions/[txId]`); otherwise they render flat.
 */
export function MovementList({
  movements,
  perspective,
  todayISO,
  installmentChips,
  groupByDate = true,
  emptyState,
  showAccount = false,
  showFeedBadges = false,
  onPressMovement,
}: Props) {
  const t = useT()
  const locale = useLocale()

  if (movements.length === 0) {
    if (!emptyState) return null
    return (
      <View className="rounded-[20px] border border-dashed border-border p-8">
        <Text className="text-center text-sm font-semibold text-text">{emptyState.title}</Text>
        <Text className="mt-1 text-center text-sm text-text-muted">{emptyState.body}</Text>
        {emptyState.action && (
          <Pressable
            onPress={emptyState.action.onPress}
            accessibilityRole="button"
            className="mt-4 items-center self-center rounded-xl bg-emerald px-4 py-2.5"
          >
            <Text className="text-sm font-semibold text-white">{emptyState.action.label}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  const yesterdayISO = addDaysISO(todayISO, -1)
  const formatGroupDate = (dateStr: string): string => {
    if (dateStr === todayISO) return t('transactions.list.today')
    if (dateStr === yesterdayISO) return t('transactions.list.yesterday')
    const [y, m, d] = dateStr.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    const weekday = WEEKDAYS[locale][dow]
    const month = MONTHS[locale][m - 1]
    return locale === 'es' ? `${weekday} ${d} de ${month}` : `${weekday}, ${month} ${d}`
  }

  const renderRow = (movement: FinancialMovement, rowIndex: number) => (
    <View key={movement.id} className={rowIndex === 0 ? undefined : 'border-t border-border-soft'}>
      <MovementRow
        movement={movement}
        perspective={perspective}
        installmentChip={installmentChips?.get(movement.id) ?? null}
        showAccount={showAccount}
        showFeedBadges={showFeedBadges}
        onPress={onPressMovement ? () => onPressMovement(movement) : undefined}
      />
    </View>
  )

  if (!groupByDate) {
    return <View className="flex-col">{movements.map(renderRow)}</View>
  }

  const grouped = new Map<string, FinancialMovement[]>()
  for (const movement of movements) {
    const existing = grouped.get(movement.date) ?? []
    existing.push(movement)
    grouped.set(movement.date, existing)
  }

  return (
    <View className="flex-col">
      {Array.from(grouped.entries()).map(([date, dayMovements], dayIndex) => (
        <View key={date} className={dayIndex === 0 ? undefined : 'mt-3 border-t border-border-soft pt-3'}>
          <Text className="px-4 pb-2 text-[12px] font-extrabold capitalize text-text-muted">
            {formatGroupDate(date)}
          </Text>
          <View className="flex-col">{dayMovements.map(renderRow)}</View>
        </View>
      ))}
    </View>
  )
}
