import { useTranslations } from 'next-intl'
import type { CreditCardSummary, CardNetwork } from '@/lib/cards/queries'
import type { Institution } from '@/lib/accounts/types'
import { AddCardButton } from './add-card-button'
import { CardsCompactView } from './cards-compact-view'

type Props = {
  cards: CreditCardSummary[]
  /** Map of network id → display name, for each row's monogram + meta. */
  networkNames: Record<string, string>
  /** Catalogs for the empty-state "Agregar tarjeta" drawer (same as the header CTA). */
  institutions: Institution[]
  networks: CardNetwork[]
  showCents?: boolean
}

export const Wallet = ({
  cards,
  networkNames,
  institutions,
  networks,
  showCents = false,
}: Props) => {
  const t = useTranslations('cards')

  if (cards.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-border p-12 text-center">
        <p className="text-sm font-semibold text-text">{t('wallet.empty_title')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('wallet.empty_body')}</p>
        <div className="mt-4 flex justify-center">
          <AddCardButton institutions={institutions} networks={networks} />
        </div>
      </div>
    )
  }

  return <CardsCompactView cards={cards} networkNames={networkNames} showCents={showCents} />
}
