import Link from 'next/link'
import type { CreditCardSummary } from '@/lib/cards/queries'

type Props = {
  cards: CreditCardSummary[]
}

export const ArchivedCardsSection = ({ cards }: Props) => {
  if (cards.length === 0) return null

  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        Archivadas ({cards.length})
      </summary>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/cards/${card.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span>{card.name}</span>
              <span className="text-xs text-muted-foreground">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
