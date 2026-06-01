import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import type { CreditCardSummary } from '@/lib/cards/queries'
import { cardAccent, cardMonogram } from './card-presentation'

type Props = {
  cards: CreditCardSummary[]
}

/**
 * Collapsible "Archivadas" section below the wallet. Renders nothing when there
 * are no archived cards. Uses native `<details>` (no client JS) — each item
 * links to the card detail, where `[Reactivar]` lives.
 */
export const ArchivedCardsSection = ({ cards }: Props) => {
  const t = useTranslations('cards')
  if (cards.length === 0) return null

  return (
    <Card asChild>
    <details>
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-text-muted transition-colors hover:text-text [&::-webkit-details-marker]:hidden">
        {t('status.archived')} ({cards.length})
      </summary>
      <ul className="flex flex-col border-t border-border">
        {cards.map((card) => {
          const accent = cardAccent(card)
          return (
            <li key={card.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/cards/${card.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-border-soft/50"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-extrabold text-white opacity-60"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                >
                  {cardMonogram(card.name)}
                </span>
                <span className="truncate text-sm font-medium">{card.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </details>
    </Card>
  )
}
