import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronDown } from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { CreditCardSummary } from '../../lib/cards/queries'
import {
  groupCardsByBank,
  applyFilter,
  countByFilter,
  sortCardsByDue,
  cardUsePercent,
  cardTone,
  type CardPredicateFilter,
  type BankGroup,
  type CardTone,
} from '@grana/cards'
import { accountColors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { useEyeMask } from '../dashboard/EyeMaskContext'
import { Segmented } from '../ui/Segmented'
import { WalletFilterChips } from './WalletFilterChips'

type Props = {
  cards: CreditCardSummary[]
  /** Map of network id → display name, for each row's monogram + meta. */
  networkNames: Record<string, string>
}

const MASK = '••••••'

/** Grouped vs flat. Not a predicate — the predicates live in the chip row. */
type ViewMode = 'by-bank' | 'list'
const VIEW_MODES: ViewMode[] = ['by-bank', 'list']
const VIEW_MODE_KEY: Record<ViewMode, string> = { 'by-bank': 'by_bank', list: 'list' }

const DOT_CLASS: Record<CardTone, string> = {
  due: 'bg-negative',
  soon: 'bg-warning',
  ok: 'bg-emerald/40',
}
const BADGE_BG: Record<CardTone, string> = {
  due: 'bg-negative/10',
  soon: 'bg-warning-soft',
  ok: 'bg-emerald/10',
}
const BADGE_TEXT: Record<CardTone, string> = {
  due: 'text-negative',
  soon: 'text-warning-deep',
  ok: 'text-emerald',
}
const dayMonth = (iso: string | null): string => {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const cardAccentColor = (card: CreditCardSummary): string => {
  const avatar = resolveAccountAvatar(
    { id: card.id, name: card.name, type: 'credit', color_key: card.color_key, icon_key: card.icon_key },
    card.institution ? { brand_color: card.institution.brand_color, icon_type: null } : null,
  )
  return avatar.colorKey ? accountColors[avatar.colorKey] : (avatar.colorOverride ?? accountColors.slate)
}

export const Wallet = ({ cards, networkNames }: Props) => {
  const t = useT()
  // Two separate controls: the view mode groups or flattens, the filter narrows
  // the flat list. Keeping the filter across a round trip to "Por banco" means
  // peeking at the grouped view doesn't cost the user their selection.
  const [mode, setMode] = useState<ViewMode>('by-bank')
  const [filter, setFilter] = useState<CardPredicateFilter>('all')

  const groups = useMemo(() => groupCardsByBank(cards), [cards])
  const counts = useMemo(() => countByFilter(cards), [cards])

  // A refetch can empty the active filter; fall back rather than strand the
  // user on a list with no rows and no obvious way back.
  useEffect(() => {
    if (counts[filter] === 0) setFilter('all')
  }, [counts, filter])

  const networkLabel = (card: CreditCardSummary): string | null =>
    card.network_id ? (networkNames[card.network_id] ?? card.other_network_name) : card.other_network_name

  if (cards.length === 0) {
    return (
      <View className="items-center rounded-xl border border-dashed border-border p-8">
        <Text className="text-center text-sm text-text-muted">{t('cards.list.carousel_empty')}</Text>
      </View>
    )
  }

  const modeOptions = VIEW_MODES.map((value) => ({
    value,
    label: t(`cards.compact.filters.${VIEW_MODE_KEY[value]}`),
  }))

  return (
    <View className="flex-col gap-3">
      <Segmented
        value={mode}
        options={modeOptions}
        onValueChange={(next) => setMode(next as ViewMode)}
        ariaLabel={t('cards.compact.filters.by_bank')}
      />

      {mode === 'by-bank' ? (
        <View className="flex-col gap-3">
          {groups.map((group) => (
            <BankGroupMobile key={group.key} group={group} networkLabel={networkLabel} />
          ))}
        </View>
      ) : (
        <>
          <WalletFilterChips value={filter} counts={counts} onValueChange={setFilter} />
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {sortCardsByDue(applyFilter(cards, filter)).map((card, i) => (
              <CompactRowMobile key={card.id} card={card} networkLabel={networkLabel} isFirst={i === 0} />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

// ── Bank group (collapsible) ───────────────────────────────────────────────────

type GroupProps = {
  group: BankGroup
  networkLabel: (card: CreditCardSummary) => string | null
}

const BankGroupMobile = ({ group, networkLabel }: GroupProps) => {
  const t = useT()
  const showCents = useShowCents()
  const { masked } = useEyeMask()
  const [collapsed, setCollapsed] = useState(group.defaultCollapsed)

  // The chip only earns its width when there is urgency to report: "al día" is
  // already legible from the $0 total and the per-row dots.
  const showBadge = group.tone !== 'ok'
  const badgeText = group.nextDueDate
    ? t('cards.month_hero.upcoming_due', { date: dayMonth(group.nextDueDate) })
    : t('cards.pill.ok')

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Two lines: the header carries six pieces of information and a single
          row of them does not fit a phone width without crushing the text. */}
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        accessibilityRole="button"
        className="flex-row items-center gap-2.5 px-4 py-3"
      >
        <ChevronDown
          size={16}
          color="#8A94A3"
          style={{ transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}
        />

        <View className="min-w-0 flex-1 flex-col gap-1">
          <View className="flex-row items-center gap-2">
            <View
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: group.brandColor ?? accountColors.slate }}
            />
            <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-text">
              {group.name ?? t('cards.compact.group.no_bank')}
            </Text>
            {group.toPayARS > 0 && (
              <Text className="shrink-0 text-sm font-extrabold tabular-nums text-text">
                {masked ? MASK : formatARS(group.toPayARS, showCents)}
              </Text>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[11px] text-text-muted">
              {t('cards.compact.group.summary', { count: group.count, inUse: group.inUseCount })}
            </Text>
            {showBadge && (
              <View className={`shrink-0 rounded-full px-2.5 py-1 ${BADGE_BG[group.tone]}`}>
                <Text className={`text-[10px] font-bold ${BADGE_TEXT[group.tone]}`}>{badgeText}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {!collapsed && (
        <View className="border-t border-border">
          {group.cards.map((card, i) => (
            <CompactRowMobile key={card.id} card={card} networkLabel={networkLabel} isFirst={i === 0} />
          ))}
        </View>
      )}
    </View>
  )
}

// ── Compact 2-line row ──────────────────────────────────────────────────────────

/** A micro stacked label + value (CIERRE / 25/06) for the dense row's line 2. */
const MDateStat = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text className="text-[9px] font-bold uppercase tracking-wider text-text-soft">{label}</Text>
    <Text className="mt-0.5 text-[11px] font-semibold tabular-nums text-text-muted">{value}</Text>
  </View>
)

type RowProps = {
  card: CreditCardSummary
  networkLabel: (card: CreditCardSummary) => string | null
  isFirst: boolean
}

const CompactRowMobile = ({ card, networkLabel, isFirst }: RowProps) => {
  const t = useT()
  const router = useRouter()
  const showCents = useShowCents()
  const { masked } = useEyeMask()

  const period = card.activePeriod
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const tone = cardTone(card)
  const pct = cardUsePercent(card)
  const accent = cardAccentColor(card)
  const network = networkLabel(card)
  const monogram = (network?.trim()?.[0] ?? card.name.trim()?.[0] ?? '?').toUpperCase()

  return (
    <Pressable
      onPress={() => router.push(`/cards/${card.id}` as never)}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 px-4 py-3 ${isFirst ? '' : 'border-t border-border-soft'}`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: accent }}
      >
        <Text className="text-xs font-extrabold text-white">{monogram}</Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px] font-bold text-text">
          {card.name}
        </Text>
        <View className="mt-1.5 flex-row items-end gap-3.5">
          <MDateStat label={t('cards.compact.row.close_label')} value={dayMonth(period?.end_date ?? null)} />
          <MDateStat label={t('cards.compact.row.due_label')} value={dayMonth(period?.due_date ?? null)} />
          <MDateStat
            label={t('cards.compact.row.uso_label')}
            value={pct !== null ? `${pct}%` : t('cards.compact.row.no_limit')}
          />
        </View>
      </View>

      <View className="items-end">
        <Text className={`text-[13px] font-extrabold ${pendingARS === 0 ? 'text-text-soft' : 'text-text'}`}>
          {masked ? MASK : formatARS(pendingARS, showCents)}
        </Text>
        {hasUSD && pendingUSD !== 0 && (
          <Text className="text-[10px] font-bold text-text-muted">
            {masked ? MASK : formatUSD(pendingUSD, showCents)}
          </Text>
        )}
      </View>

      <View className={`h-2.5 w-2.5 rounded-full ${DOT_CLASS[tone]}`} />
    </Pressable>
  )
}
