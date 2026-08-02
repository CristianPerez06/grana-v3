import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { FormScreen } from '../../../../components/layout/FormScreen'
import { Spinner } from '../../../../components/ui/Spinner'
import { EditAccountForm } from '../../../../components/accounts/EditAccountForm'
import { useAccountDetail, useInstitutions } from '../../../../lib/accounts/queries'
import { useT } from '../../../../lib/locale-context'

export default function EditAccountScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()
  const accountQ = useAccountDetail(id)
  const institutionsQ = useInstitutions()

  const ready = accountQ.data && institutionsQ.data

  return (
    <FormScreen
      title={t('accounts.edit_title')}
      backLink={{ href: `/(app)/accounts/${id}`, label: accountQ.data?.name ?? t('accounts.title') }}
      contentClassName="px-6 py-6"
    >
      {accountQ.isPending || institutionsQ.isPending ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : accountQ.isError || !ready ? (
        <Text className="text-center text-sm text-text-muted">
          {t('accounts.errors.account_not_found')}
        </Text>
      ) : (
        <EditAccountForm account={accountQ.data!} institutions={institutionsQ.data!} />
      )}
    </FormScreen>
  )
}
