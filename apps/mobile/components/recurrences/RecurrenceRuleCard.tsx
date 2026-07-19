import { Pressable, Text, View } from 'react-native'
import { ChevronRight, Repeat } from 'lucide-react-native'
import type { RecurrenceSummary } from '@grana/recurrences'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'
import {
  amountSign,
  amountToneClass,
  categoryName,
  frequencyLabel,
  movementLabel,
} from './format'

type Tab = 'active' | 'paused' | 'finished'

// A single rule row in the hub list. Mirrors web's recurring-tabs card anatomy
// with native primitives: category-tinted tile (or a Repeat glyph for
// transfers), title (description → category → type), a frequency badge, a meta
// line (next occurrence + account), the tonal amount, and — on the active tab —
// the "próximo {date}" caption. Read-only; tapping opens the rule detail.
export function RecurrenceRuleCard({
  rule,
  tab,
  onPress,
}: {
  rule: RecurrenceSummary
  tab: Tab
  onPress: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()

  const isInactive = rule.status === 'paused' || tab === 'finished'
  const tileColor = rule.category?.color ?? '#8C97A4'
  const tileIcon = rule.category?.icon

  const title =
    rule.description || categoryName(rule.category, t) || movementLabel(rule.movement_type, t)

  const accountName = rule.account?.name ?? '—'
  const accountLine =
    rule.movement_type === 'transfer'
      ? `${accountName} → ${rule.destination_account?.name ?? '—'}`
      : accountName

  const meta =
    tab === 'finished'
      ? rule.end_date
        ? t('recurrences.until_template', { date: formatShortDate(rule.end_date, locale) })
        : accountLine
      : rule.status === 'paused'
        ? `${t('recurrences.statuses.paused')} · ${accountLine}`
        : accountLine

  const nextDate =
    tab === 'active' && rule.next_occurrence
      ? formatShortDate(rule.next_occurrence, locale)
      : null

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-3.5 py-3.5 active:bg-page"
    >
      <View
        className={`h-[46px] w-[46px] items-center justify-center rounded-[13px] ${
          isInactive ? 'opacity-60' : ''
        }`}
        style={{ backgroundColor: `${tileColor}1A` }}
      >
        {tileIcon ? (
          <Text className="text-[22px]">{tileIcon}</Text>
        ) : (
          <Repeat size={20} color={tileColor} />
        )}
      </View>

      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-shrink text-[15px] font-bold text-text">
            {title}
          </Text>
          <Text className="shrink-0 overflow-hidden rounded-md bg-border-soft px-2 py-0.5 text-[10.5px] font-extrabold uppercase text-text-muted">
            {frequencyLabel(rule.frequency, t)}
          </Text>
        </View>
        <Text numberOfLines={1} className="text-[13px] font-medium text-text-muted">
          {meta}
        </Text>
      </View>

      <View className="shrink-0 flex-row items-center gap-2">
        <View className="items-end">
          <Text className={`text-[16px] font-extrabold ${amountToneClass(rule.movement_type)}`}>
            {amountSign(rule.movement_type)}
            {fmtMoney(Number(rule.amount), rule.currency_code, showCents)}
          </Text>
          {nextDate && (
            <Text className="text-[12px] font-semibold text-text-soft">
              {t('recurrences.next_prefix')} {nextDate}
            </Text>
          )}
        </View>
        <ChevronRight size={18} color="#B8C0CA" />
      </View>
    </Pressable>
  )
}
