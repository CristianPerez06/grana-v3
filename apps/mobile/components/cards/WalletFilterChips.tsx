import { Pressable, ScrollView, Text } from 'react-native'
import { CARD_PREDICATE_FILTERS, type CardPredicateFilter } from '@grana/cards'
import { useT } from '../../lib/locale-context'

const FILTER_KEY: Record<CardPredicateFilter, string> = {
  all: 'all',
  'in-use': 'in_use',
  'due-soon': 'due_soon',
  'with-balance': 'with_balance',
}

type Props = {
  value: CardPredicateFilter
  /** Result count per filter, so an empty filter is visible before tapping it. */
  counts: Record<CardPredicateFilter, number>
  onValueChange: (next: CardPredicateFilter) => void
}

/**
 * Predicate filters for the flat wallet list. Chips are sized to their content
 * and scroll horizontally: four labels with counts don't fit a phone width, and
 * splitting the row evenly (the way `Segmented` does) crushes the long ones.
 * A filter with no results is rendered disabled — it only leads to an empty list.
 */
export const WalletFilterChips = ({ value, counts, onValueChange }: Props) => {
  const t = useT()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      contentContainerClassName="flex-row items-center gap-2 pr-4"
    >
      {CARD_PREDICATE_FILTERS.map((filter) => {
        const active = filter === value
        const count = counts[filter]
        const disabled = count === 0
        return (
          <Pressable
            key={filter}
            disabled={disabled}
            onPress={() => {
              if (!disabled) onValueChange(filter)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              active ? 'border-navy bg-navy' : 'border-border bg-card'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Text className={`text-[13px] font-bold ${active ? 'text-white' : 'text-text-muted'}`}>
              {t(`cards.compact.filters.${FILTER_KEY[filter]}`)}
            </Text>
            <Text
              className={`text-[11px] font-bold tabular-nums ${active ? 'text-navy-muted' : 'text-text-soft'}`}
            >
              {count}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
