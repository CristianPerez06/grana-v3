import { Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { FormScreen } from '../../../components/layout/FormScreen'
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
    <FormScreen
      title={t('cards.new.title')}
      backLink={{ href: '/(app)/cards', label: t('cards.title') }}
      contentClassName="px-6 py-6"
    >
      {pending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : failed ? (
        <Text className="text-center text-sm text-text-muted">{t('cards.route.wallet_error')}</Text>
      ) : (
        <CreateCardForm institutions={institutionsQ.data} networks={networksQ.data} />
      )}
    </FormScreen>
  )
}
