import { ScrollView, Text, View } from 'react-native'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Spinner } from '../../../components/ui/Spinner'
import { CreateAccountForm } from '../../../components/accounts/CreateAccountForm'
import { useInstitutions } from '../../../lib/accounts/queries'
import { useT } from '../../../lib/locale-context'

export default function NewAccountScreen() {
  const t = useT()
  const institutionsQ = useInstitutions()

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('accounts.actions.create')}
        backLink={{ href: '/(app)/accounts', label: t('accounts.title') }}
      />
      <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
        {institutionsQ.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : institutionsQ.isError || !institutionsQ.data ? (
          <Text className="text-center text-sm text-text-muted">
            {t('accounts.route.active_error')}
          </Text>
        ) : (
          <CreateAccountForm institutions={institutionsQ.data} />
        )}
      </ScrollView>
    </View>
  )
}
