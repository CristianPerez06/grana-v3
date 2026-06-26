import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { PageHeader } from '../../../components/ui/PageHeader'
import { useT } from '../../../lib/locale-context'

// Destination for the "Recurrencias" action in the movements toolbar. The mobile
// recurrences module is not built yet — this is an intentional empty placeholder
// so the action has a real route to navigate to. The actual recurrences UI will
// land in a later change (likely promoted to a global /transactions location).
export default function AccountsRecurringScreen() {
  const t = useT()
  const router = useRouter()
  // Pop back to wherever the user came from (the account detail), not a fixed
  // route — the toolbar can push here from any account's movements list.
  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('transactions.header.see_recurrences')}
        backLink={{ href: '/(app)/accounts', label: t('common.back') }}
        onBackPress={() => router.back()}
      />
      <View className="flex-1 px-6 py-6" />
    </View>
  )
}
