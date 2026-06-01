import { getLocale, getTranslations } from 'next-intl/server'
import {
  getCardNetworks,
  getCreditCards,
  type CardNetwork,
  type CreditCardSummary,
} from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { getTodayAR } from '@/lib/date'
import { WalletGrid } from './wallet-grid'
import { WalletGridSection } from './wallet-grid-section'
import { SectionFallback } from '../../dashboard/_components/section-fallback'

export const WalletGridContainer = async () => {
  let activeCards: CreditCardSummary[]
  let networks: CardNetwork[]
  let showCents: boolean
  let locale: string
  try {
    ;[activeCards, networks, showCents, locale] = await Promise.all([
      getCreditCards(),
      getCardNetworks(),
      getShowCents(),
      getLocale(),
    ])
  } catch {
    const t = await getTranslations('cards.route')
    return <SectionFallback message={t('wallet_error')} />
  }

  const networkNames: Record<string, string> = Object.fromEntries(
    networks.map((n) => [n.id, n.name]),
  )

  const monthShort = getTodayAR().toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long' },
  )

  return (
    <WalletGridSection hasCards={activeCards.length > 0}>
      <WalletGrid
        cards={activeCards}
        networkNames={networkNames}
        monthLabel={monthShort}
        showCents={showCents}
      />
    </WalletGridSection>
  )
}
