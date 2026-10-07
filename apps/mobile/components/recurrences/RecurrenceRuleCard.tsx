import { Pressable, Text, View } from 'react-native'
import { AlertTriangle, ChevronRight, Repeat } from 'lucide-react-native'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { formatCompactDate, recurrenceTitle, type RecurrenceSummary } from '@grana/recurrences'
import { colors } from '../../lib/colors'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'
import { ResolveAheadActions } from './ResolveAheadActions'
import {
  amountSign,
  amountToneClass,
  categoryName,
  frequencyLabel,
  movementLabel,
  subcategoryName,
} from './format'

type Tab = 'active' | 'paused' | 'finished'

// A single rule row in the hub list. Mirrors web's recurring-tabs card anatomy
// with native primitives: category-tinted tile (or a Repeat glyph for
// transfers), title (description → category → type), a meta line (frequency +
// account), the tonal amount, and — on the active tab — the "Próx. {date}"
// caption under the meta line. Tapping the row opens the rule detail; below
// it, an active rule with a next date offers the two ways to resolve that date
// before it arrives (web's hub does the same under each upcoming row).
export function RecurrenceRuleCard({
  rule,
  tab,
  duplicate = false,
  onPress,
}: {
  rule: RecurrenceSummary
  tab: Tab
  /** The rule collides with another active one (see `duplicateRuleIds`). Informative badge, mirror of web's hub. */
  duplicate?: boolean
  onPress: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()

  const isInactive = rule.status === 'paused' || tab === 'finished'
  const tileColor = rule.category?.color ?? '#8C97A4'
  const tileIcon = rule.category?.icon

  const title = recurrenceTitle({
    description: rule.description,
    subcategory: subcategoryName(rule.subcategory, t),
    category: categoryName(rule.category, t),
    type: movementLabel(rule.movement_type, t),
  })

  const accountName = rule.account?.name ?? '—'
  // The frequency leads the account line as plain text, web's twin: as a chip
  // beside the name it took the name's width.
  const freq = frequencyLabel(rule.frequency, t)
  const accountLine = `${freq} · ${
    rule.movement_type === 'transfer'
      ? `${accountName} → ${rule.destination_account?.name ?? '—'}`
      : accountName
  }`

  // A finished rule that still has occurrences waiting says so — web's twin. The
  // rule stops producing; it does not stop owing, and hiding them because it
  // ended would strand them.
  const meta =
    rule.lifecycle.state === 'finished-with-pending'
      ? `${t('recurrences.limit.finished_with_pending', { count: rule.lifecycle.unresolved })} · ${accountLine}`
      : tab === 'finished'
        ? rule.end_date
          ? `${freq} · ${t('recurrences.until_template', { date: formatShortDate(rule.end_date, locale) })}`
          : rule.lifecycle.progress != null
            ? `${t('recurrences.limit.progress', {
                spent: rule.lifecycle.progress.spent,
                total: rule.lifecycle.progress.total,
              })} · ${accountLine}`
            : accountLine
        : rule.status === 'paused'
          ? `${t('recurrences.statuses.paused')} · ${accountLine}`
          : accountLine

  // Compact — `1 dic`, the year only when it is not this year's — same helper as web.
  const nextDate =
    tab === 'active' && rule.next_occurrence
      ? formatCompactDate(rule.next_occurrence, formatDateISO(getTodayAR()), locale)
      : null

  // The actions sit OUTSIDE the row's Pressable: a Button inside a Pressable
  // makes both claim the touch, and the row's navigation would swallow the tap.
  const showActions = tab === 'active' && rule.status === 'active' && rule.next_occurrence != null

  return (
    <View>
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
          {duplicate && (
            <View
              accessibilityLabel={t('recurrences.duplicate_hint')}
              className="shrink-0 flex-row items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5"
            >
              <AlertTriangle size={11} color={colors.warningDeep} />
              <Text className="text-[10.5px] font-extrabold uppercase text-warning-deep">
                {t('recurrences.duplicate_badge')}
              </Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} className="text-[13px] font-medium text-text-muted">
          {meta}
        </Text>
        {/* The date lives under the account, not under the amount: there it made
            the right column as wide as the date, and on a phone the name and the
            account were left a letter each. Same as web at phone width. */}
        {nextDate && (
          <Text numberOfLines={1} className="text-[12px] font-semibold text-text-soft">
            {t('recurrences.next_prefix')} {nextDate}
          </Text>
        )}
      </View>

      <View className="shrink-0 flex-row items-center gap-2">
        <Text className={`text-[16px] font-extrabold ${amountToneClass(rule.movement_type)}`}>
          {amountSign(rule.movement_type)}
          {fmtMoney(Number(rule.amount), rule.currency_code, showCents)}
        </Text>
        <ChevronRight size={18} color="#B8C0CA" />
      </View>
    </Pressable>
    {showActions && rule.next_occurrence ? (
      <View className="px-3.5 pb-3.5">
        <ResolveAheadActions
          recurrenceId={rule.id}
          dueDate={rule.next_occurrence}
          ruleAmount={Number(rule.amount)}
          ruleCurrency={rule.currency_code}
          movementType={rule.movement_type}
          ruleAccountId={rule.account_id}
          transferDestinationAccountId={rule.transfer_destination_account_id}
          shared={rule.household_id != null}
        />
      </View>
    ) : null}
    </View>
  )
}
