import { getLocale, getTranslations } from 'next-intl/server'
import {
  getCardNetworks,
  getCreditCards,
  type CardNetwork,
  type CreditCardSummary,
} from '@/lib/cards/queries'
import { getShowCents } from '@/lib/preferences'
import { getTodayAR } from '@/lib/date'
import { Wallet } from './wallet'
import { WalletSection } from './wallet-section'
import { SectionFallback } from '@/components/ui/section-fallback'
import { createClient } from '@/lib/supabase/server'

export const WalletContainer = async () => {
  let activeCards: CreditCardSummary[]
  let networks: CardNetwork[]
  let showCents: boolean
  let locale: string
  try {
    ;[activeCards, networks, showCents, locale] = await Promise.all([
      getCreditCards(await createClient(), {}),
      getCardNetworks(await createClient()),
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
    <WalletSection hasCards={activeCards.length > 0}>
      <Wallet
        cards={activeCards}
        networkNames={networkNames}
        monthLabel={monthShort}
        showCents={showCents}
      />
    </WalletSection>
  )
}
