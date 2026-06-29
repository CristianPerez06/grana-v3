import { ScrollView, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { CardsHeader } from '../../../components/cards/CardsHeader'
import { CardsMonthHero } from '../../../components/cards/CardsMonthHero'
import { Wallet } from '../../../components/cards/Wallet'
import { ArchivedCardsSection } from '../../../components/cards/ArchivedCardsSection'
import { SectionFallback } from '../../../components/dashboard/SectionFallback'
import { getCardNetworks, getCardsMonthSummary, getCreditCards } from '../../../lib/cards/queries'
import { useT } from '../../../lib/locale-context'

export default function TarjetasScreen() {
  return (
    <View className="flex-1 bg-background">
      <CardsHeader />
      <ScrollView contentContainerClassName="gap-6 px-6 py-6">
        <MonthHeroSection />
        <WalletSection />
        <ArchivedSection />
      </ScrollView>
    </View>
  )
}

const MonthHeroSection = () => {
  const t = useT()
  const query = useQuery({
    queryKey: ['cards', 'month-summary'] as const,
    queryFn: getCardsMonthSummary,
  })

  if (query.isPending)
    return <SectionFallback message={t('cards.route.hero_loading')} className="min-h-[14rem]" />
  if (query.isError)
    return <SectionFallback message={t('cards.route.hero_error')} className="min-h-[14rem]" />
  return <CardsMonthHero summary={query.data} />
}

const WalletSection = () => {
  const t = useT()
  const query = useQuery({
    queryKey: ['cards'] as const,
    queryFn: () => getCreditCards({ includeArchived: false }),
  })
  const networksQuery = useQuery({
    queryKey: ['cards', 'networks'] as const,
    queryFn: getCardNetworks,
  })

  if (query.isPending)
    return <SectionFallback message={t('cards.route.wallet_loading')} className="min-h-[18rem]" />
  if (query.isError)
    return <SectionFallback message={t('cards.route.wallet_error')} className="min-h-[18rem]" />
  if (query.data.length === 0) {
    return (
      <View className="rounded-xl border border-dashed border-border bg-card p-8">
        <Text className="text-center text-sm font-semibold text-text">
          {t('cards.wallet.empty_title')}
        </Text>
        <Text className="mt-1 text-center text-sm text-text-muted">
          {t('cards.wallet.empty_body')}
        </Text>
      </View>
    )
  }

  const networkNames: Record<string, string> = Object.fromEntries(
    (networksQuery.data ?? []).map((n) => [n.id, n.name]),
  )

  return (
    <View className="flex-col gap-3">
      <View className="flex-col gap-1 px-0.5">
        <Text className="text-xs font-bold uppercase tracking-widest text-text-soft">
          {t('cards.wallet.section_title')}
        </Text>
        <Text className="text-xs text-text-muted">{t('cards.wallet.section_hint')}</Text>
      </View>
      <Wallet cards={query.data} networkNames={networkNames} />
    </View>
  )
}

const ArchivedSection = () => {
  const t = useT()
  const query = useQuery({
    queryKey: ['cards', 'archived'] as const,
    queryFn: () => getCreditCards({ archivedOnly: true }),
  })

  if (query.isPending) return null
  if (query.isError)
    return <SectionFallback message={t('cards.route.archived_error')} className="min-h-[3rem]" />
  return <ArchivedCardsSection cards={query.data} />
}
