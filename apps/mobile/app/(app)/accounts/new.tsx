import { Text } from 'react-native'
import { FormScreen } from '../../../components/layout/FormScreen'
import { CreateAccountForm } from '../../../components/accounts/CreateAccountForm'
import { CreateAccountFormSkeleton } from '../../../components/accounts/CreateAccountFormSkeleton'
import { useInstitutions } from '../../../lib/accounts/queries'
import { useT } from '../../../lib/locale-context'

export default function NewAccountScreen() {
  const t = useT()
  const institutionsQ = useInstitutions()

  return (
    <FormScreen
      title={t('accounts.actions.create')}
      backLink={{ href: '/(app)/accounts', label: t('accounts.title') }}
      contentClassName="px-6 py-6"
    >
      {institutionsQ.isPending ? (
        <CreateAccountFormSkeleton />
      ) : institutionsQ.isError || !institutionsQ.data ? (
        <Text className="text-center text-sm text-text-muted">
          {t('accounts.route.active_error')}
        </Text>
      ) : (
        <CreateAccountForm institutions={institutionsQ.data} />
      )}
    </FormScreen>
  )
}
