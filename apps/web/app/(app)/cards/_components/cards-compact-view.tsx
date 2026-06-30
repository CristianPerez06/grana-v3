'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import type { CreditCardSummary } from '@/lib/cards/queries'
import {
  groupCardsByBank,
  applyFilter,
  sortCardsByDue,
  cardUsePercent,
  cardTone,
  cardAccent,
  cardMonogram,
  formatDayMonth,
  type ViewFilter,
  type BankGroup,
  type CardTone,
} from '@grana/cards'
import { CardStatusPill } from './card-status-pill'

type Props = {
  cards: CreditCardSummary[]
  /** Map of network id → display name, for each row's monogram + meta. */
  networkNames: Record<string, string>
  showCents?: boolean
}

const FILTERS: ViewFilter[] = ['by-bank', 'all', 'in-use', 'due-soon', 'with-balance']
const FILTER_KEY: Record<ViewFilter, string> = {
  'by-bank': 'by_bank',
  all: 'all',
  'in-use': 'in_use',
  'due-soon': 'due_soon',
  'with-balance': 'with_balance',
}

const BADGE_TONE: Record<CardTone, string> = {
  due: 'bg-terracotta-soft text-terracotta',
  soon: 'bg-warning-soft text-warning-deep',
  ok: 'bg-emerald-soft text-emerald-deep',
}

export const CardsCompactView = ({ cards, networkNames, showCents = false }: Props) => {
  const t = useTranslations('cards')
  const [filter, setFilter] = useState<ViewFilter>('by-bank')

  const groups = useMemo(() => groupCardsByBank(cards), [cards])

  const segmentedOptions = FILTERS.map((value) => ({
    value,
    label: t(`compact.filters.${FILTER_KEY[value]}`),
  }))

  const networkLabel = (card: CreditCardSummary): string | null =>
    card.network_id ? (networkNames[card.network_id] ?? card.other_network_name) : card.other_network_name

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={filter}
        options={segmentedOptions}
        onValueChange={(next) => setFilter(next as ViewFilter)}
        ariaLabel={t('compact.filters.by_bank')}
      />

      {filter === 'by-bank' ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <BankGroupCard
              key={group.key}
              group={group}
              networkLabel={networkLabel}
              showCents={showCents}
            />
          ))}
        </div>
      ) : (
        <Card>
          <ul className="flex flex-col">
            {sortCardsByDue(applyFilter(cards, filter)).map((card) => (
              <li key={card.id} className="border-t border-border-soft first:border-t-0">
                <CompactCardRow card={card} networkLabel={networkLabel} showCents={showCents} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ── Bank group (collapsible) ───────────────────────────────────────────────────

type GroupProps = {
  group: BankGroup
  networkLabel: (card: CreditCardSummary) => string | null
  showCents: boolean
}

const BankGroupCard = ({ group, networkLabel, showCents }: GroupProps) => {
  const t = useTranslations('cards')
  const [collapsed, setCollapsed] = useState(group.defaultCollapsed)
  const bodyId = `bank-group-${group.key}`

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-border-soft/40"
      >
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-text-soft transition-transform', collapsed && '-rotate-90')}
          aria-hidden
        />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.brandColor ?? 'var(--account-slate)' }}
          aria-hidden
        />
        <span className="min-w-0 truncate font-bold">{group.name ?? t('compact.group.no_bank')}</span>
        <span className="hidden shrink-0 text-xs text-text-muted sm:inline">
          {t('compact.group.summary', { count: group.count, inUse: group.inUseCount })}
        </span>
        <span className="flex-1" />
        {group.toPayARS > 0 && (
          <span className="text-right text-sm font-extrabold tabular-nums">
            {formatARS(group.toPayARS, showCents)}
            <span className="block text-[10px] font-semibold text-text-soft">
              {t('compact.group.to_pay')}
            </span>
          </span>
        )}
        <GroupBadge group={group} />
      </button>

      {!collapsed && (
        <ul id={bodyId} className="flex flex-col border-t border-border">
          {group.cards.map((card) => (
            <li key={card.id} className="border-t border-border-soft first:border-t-0">
              <CompactCardRow card={card} networkLabel={networkLabel} showCents={showCents} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const GroupBadge = ({ group }: { group: BankGroup }) => {
  const t = useTranslations('cards')
  // Neutral groups show only the "al día" tone; due/soon groups show the
  // nearest due date so an urgent bank is legible even when collapsed.
  const showDate = group.tone !== 'ok' && group.nextDueDate !== null
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums',
        BADGE_TONE[group.tone],
      )}
    >
      {showDate
        ? t('month_hero.upcoming_due', { date: formatDayMonth(group.nextDueDate) })
        : t('pill.ok')}
    </span>
  )
}

// ── Compact 2-row card ─────────────────────────────────────────────────────────

/** A micro stacked label + value (CIERRE / 25·06) for the dense row's line 2. */
const DateStat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex shrink-0 flex-col leading-none">
    <span className="text-[10px] font-bold uppercase tracking-wider text-text-soft">{label}</span>
    <span className="mt-1 text-xs font-semibold tabular-nums text-text-muted">{value}</span>
  </div>
)

type RowProps = {
  card: CreditCardSummary
  networkLabel: (card: CreditCardSummary) => string | null
  showCents: boolean
}

const CompactCardRow = ({ card, networkLabel, showCents }: RowProps) => {
  const t = useTranslations('cards')
  const accent = cardAccent(card, card.institution)
  const period = card.activePeriod
  const pendingARS = period?.pendingAmountARS ?? 0
  const pendingUSD = period?.pendingAmountUSD ?? 0
  const hasUSD = card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)
  const tone = cardTone(card)
  const pct = cardUsePercent(card)
  const network = networkLabel(card)
  const monogram = (network?.trim()?.[0] ?? cardMonogram(card.name)).toUpperCase()

  return (
    <Link
      href={`/cards/${card.id}`}
      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-border-soft/40"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold text-white"
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        {monogram}
      </span>

      {/* Single responsive layout: name + amount/pill on the top line, the date
          stats on their own line below so they never get crushed on mobile. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate font-bold leading-tight">{card.name}</p>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right tabular-nums">
              <p className={cn('font-extrabold', pendingARS === 0 && 'text-text-soft')}>
                {formatARS(pendingARS, showCents)}
              </p>
              {hasUSD && pendingUSD !== 0 && (
                <p className="text-xs font-bold text-text-muted">{formatUSD(pendingUSD, showCents)}</p>
              )}
            </div>
            <CardStatusPill tone={tone} />
          </div>
        </div>
        <div className="mt-2 flex items-end gap-4">
          <DateStat label={t('compact.row.close_label')} value={formatDayMonth(period?.end_date ?? null)} />
          <DateStat label={t('compact.row.due_label')} value={formatDayMonth(period?.due_date ?? null)} />
          <DateStat
            label={t('compact.row.uso_label')}
            value={pct !== null ? `${pct}%` : t('compact.row.no_limit')}
          />
        </div>
      </div>
    </Link>
  )
}
