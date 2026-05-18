import Link from 'next/link'
import type { CreditCardSummary } from '@/lib/cards/queries'
import { CreditCardItem } from './credit-card-item'

type Props = {
  cards: CreditCardSummary[]
}

export const CreditCardCarousel = ({ cards }: Props) => {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No tenés tarjetas de crédito registradas.
        </p>
        <Link
          href="/cards/new"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Agregar tarjeta
        </Link>
      </div>
    )
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
      style={{ scrollbarWidth: 'none' }}
    >
      {cards.map((card) => (
        <CreditCardItem key={card.id} card={card} />
      ))}
      <Link
        href="/cards/new"
        className="flex items-center justify-center min-w-[140px] snap-start rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        + Agregar
      </Link>
    </div>
  )
}
