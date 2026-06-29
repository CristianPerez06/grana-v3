import { ScrollView, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Spinner } from '../../../components/ui/Spinner'
import { CreateCardForm } from '../../../components/cards/CreateCardForm'
import { useInstitutions } from '../../../lib/accounts/queries'
import { getCardNetworks } from '../../../lib/cards/queries'
import { useT } from '../../../lib/locale-context'

export default function NewCardScreen() {
  const t = useT()
  const institutionsQ = useInstitutions()
  const networksQ = useQuery({
    queryKey: ['cards', 'networks'] as const,
    queryFn: getCardNetworks,
  })

  const pending = institutionsQ.isPending || networksQ.isPending
  const failed = institutionsQ.isError || networksQ.isError || !institutionsQ.data || !networksQ.data

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('cards.new.title')}
        backLink={{ href: '/(app)/cards', label: t('cards.title') }}
      />
      <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
        {pending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : failed ? (
          <Text className="text-center text-sm text-text-muted">{t('cards.route.wallet_error')}</Text>
        ) : (
          <CreateCardForm institutions={institutionsQ.data} networks={networksQ.data} />
        )}
      </ScrollView>
    </View>
  )
}
