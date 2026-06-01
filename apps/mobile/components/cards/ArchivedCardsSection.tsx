import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { CreditCardSummary } from '../../lib/cards/queries'
import { useT } from '../../lib/locale-context'

type Props = {
  cards: CreditCardSummary[]
}

const monogram = (name: string): string => {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '·'
}

export const ArchivedCardsSection = ({ cards }: Props) => {
  const t = useT()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)

  if (cards.length === 0) return null

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        className="flex-row items-center justify-between px-5 py-4"
      >
        <Text className="text-sm font-semibold text-text-muted">
          {t('cards.status.archived')} ({cards.length})
        </Text>
        <Text className="text-sm text-text-muted">{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && (
        <View className="flex-col border-t border-border">
          {cards.map((card, index) => (
            <Pressable
              key={card.id}
              onPress={() => router.push(`/cards/${card.id}` as never)}
              accessibilityRole="button"
              className={`flex-row items-center gap-3 px-5 py-3 ${
                index < cards.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-md bg-border-soft">
                <Text className="text-xs font-extrabold text-text-muted">
                  {monogram(card.name)}
                </Text>
              </View>
              <Text numberOfLines={1} className="flex-1 text-sm font-medium text-text">
                {card.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}
