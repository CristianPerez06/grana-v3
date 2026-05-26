import { ScrollView, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../components/ui/PageHeader'
import { CreditCardCarousel } from '../../components/cards/CreditCardCarousel'
import { SectionFallback } from '../../components/dashboard/SectionFallback'
import { Spinner } from '../../components/ui/Spinner'
import { getCreditCards } from '../../lib/cards/queries'
import { useT } from '../../lib/locale-context'

export default function TarjetasScreen() {
  const t = useT()
  const cards = useQuery({
    queryKey: ['cards'] as const,
    queryFn: () => getCreditCards({ includeArchived: false }),
  })

  return (
    <View className="flex-1 bg-background">
      <PageHeader title={t('nav.cards')} />
      <ScrollView contentContainerClassName="px-6 py-6">
        {cards.data ? (
          <CreditCardCarousel cards={cards.data} />
        ) : cards.error ? (
          <SectionFallback message={t('error.generic_title')} />
        ) : (
          <View className="items-center py-12">
            <Spinner size="lg" />
          </View>
        )}
      </ScrollView>
    </View>
  )
}
