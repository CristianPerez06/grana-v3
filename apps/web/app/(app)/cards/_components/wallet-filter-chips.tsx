'use client'

import { useTranslations } from 'next-intl'
import { CARD_PREDICATE_FILTERS, type CardPredicateFilter } from '@grana/cards'
import { cn } from '@/lib/utils'

const FILTER_KEY: Record<CardPredicateFilter, string> = {
  all: 'all',
  'in-use': 'in_use',
  'due-soon': 'due_soon',
  'with-balance': 'with_balance',
}

type Props = {
  value: CardPredicateFilter
  /** Result count per filter, so an empty filter is visible before clicking it. */
  counts: Record<CardPredicateFilter, number>
  onValueChange: (next: CardPredicateFilter) => void
}

/**
 * Predicate filters for the flat wallet list. Chips are sized to their content
 * and scroll horizontally: four labels with counts don't fit a phone width, and
 * splitting the row evenly (the way `Segmented` does) crushes the long ones —
 * which is why this is not a `Segmented`. A filter with no results is rendered
 * disabled; it only leads to an empty list.
 *
 * Mirror of `apps/mobile/components/cards/WalletFilterChips.tsx` by name and
 * props, not by JSX.
 */
export const WalletFilterChips = ({ value, counts, onValueChange }: Props) => {
  const t = useTranslations('cards')

  return (
    <div
      role="radiogroup"
      aria-label={t('compact.filters.list')}
      className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1"
    >
      {CARD_PREDICATE_FILTERS.map((filter) => {
        const active = filter === value
        const count = counts[filter]
        const disabled = count === 0
        return (
          <button
            key={filter}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onValueChange(filter)}
            className={cn(
              'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors',
              active
                ? 'border-navy bg-navy text-white'
                : 'border-border bg-card text-text-muted hover:border-[#C9CFD7] hover:text-text',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted',
            )}
          >
            {t(`compact.filters.${FILTER_KEY[filter]}`)}
            <span className={cn('text-[11px] tabular-nums', active ? 'text-navy-muted' : 'text-text-soft')}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
