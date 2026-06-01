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

export const WalletGrid = ({ cards, networkNames, monthLabel, showCents = false }: Props) => {
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
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {cards.map((card) => (
        <WalletCard
          key={card.id}
          card={card}
          networkName={card.network_id ? (networkNames[card.network_id] ?? card.other_network_name) : card.other_network_name}
          monthLabel={monthLabel}
          showCents={showCents}
        />
      ))}
    </div>
  )
}
