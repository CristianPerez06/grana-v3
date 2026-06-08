import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { CreditCardSummary } from '@/lib/cards/queries'
import { WalletCard } from './wallet-card'

type Props = {
  cards: CreditCardSummary[]
  /** Map of network id → display name, for each card's meta line. */
  networkNames: Record<string, string>
  monthLabel: string
  showCents?: boolean
}

export const Wallet = ({ cards, networkNames, monthLabel, showCents = false }: Props) => {
  const t = useTranslations('cards')

  if (cards.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-border p-12 text-center">
        <p className="text-sm font-semibold text-text">{t('wallet.empty_title')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('wallet.empty_body')}</p>
        <Button asChild className="mx-auto mt-4 w-auto">
          <Link href="/cards/new">{t('wallet.empty_cta')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div
      // Bimodal layout: contained horizontal carousel under `< md`, 2-col grid
      // at `md+`. The carousel stays inside the route shell's px-8 padding —
      // no negative margin gymnastics.
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:gap-5 md:overflow-x-visible md:pb-0"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="w-[70vw] max-w-[280px] shrink-0 snap-start md:w-auto md:max-w-none md:shrink"
        >
          <WalletCard
            card={card}
            networkName={card.network_id ? (networkNames[card.network_id] ?? card.other_network_name) : card.other_network_name}
            monthLabel={monthLabel}
            showCents={showCents}
          />
        </div>
      ))}
    </div>
  )
}
