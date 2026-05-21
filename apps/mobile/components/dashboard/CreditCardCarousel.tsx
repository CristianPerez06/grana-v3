import { FlatList, useWindowDimensions } from 'react-native'
import type { CreditCardSummary } from '../../lib/cards/queries'
import { CreditCardItem } from './CreditCardItem'

type Props = {
  cards: CreditCardSummary[]
}

const CARD_MAX_WIDTH = 280
const HORIZONTAL_INSET = 24 // matches dashboard screen px-6
const PEEK = 24 // visible portion of the next card

export const CreditCardCarousel = ({ cards }: Props) => {
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = Math.min(CARD_MAX_WIDTH, screenWidth - HORIZONTAL_INSET * 2 - PEEK)
  // Card width + the right margin baked into CreditCardItem (mr-4 → 16px).
  const snapInterval = cardWidth + 16

  return (
    <FlatList
      data={cards}
      keyExtractor={(card) => card.id}
      renderItem={({ item }) => <CreditCardItem card={item} width={cardWidth} />}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={snapInterval}
      decelerationRate="fast"
      snapToAlignment="start"
    />
  )
}
