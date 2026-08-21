import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Spinner } from '../../../components/ui/Spinner'
import { Button } from '../../../components/ui/Button'
import { AccountSection } from '../../../components/accounts/AccountSection'
import { AccountsEmptyState } from '../../../components/accounts/AccountsEmptyState'
import { AccountsHint } from '../../../components/accounts/AccountsHint'
import {
  useAccountsList,
  useArchivedAccounts,
  useInstitutions,
} from '../../../lib/accounts/queries'
import { useT } from '../../../lib/locale-context'
import { colors } from '../../../lib/colors'

export default function AccountsScreen() {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const listQ = useAccountsList()
  const archivedQ = useArchivedAccounts()
  // The "Crear" action depends on institutions being loaded (the create form
  // needs the catalog), so it stays disabled until this resolves.
  const institutionsQ = useInstitutions()
  const [hintDismissed, setHintDismissed] = useState(false)

  const data = listQ.data
  const activeCount = data ? data.cash.length + data.bank.length : 0
  const archived = archivedQ.data ? [...archivedQ.data.cash, ...archivedQ.data.bank] : []

  const goCreate = () => router.push('/(app)/accounts/new')

  const onRefresh = useCallback(() => {
    void listQ.refetch()
    void archivedQ.refetch()
    void institutionsQ.refetch()
  }, [listQ, archivedQ, institutionsQ])

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('accounts.title')}
        backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}
        actions={
          <Pressable
            onPress={goCreate}
            disabled={!institutionsQ.isSuccess}
            accessibilityRole="button"
            accessibilityState={{ disabled: !institutionsQ.isSuccess }}
            className={`rounded-xl bg-emerald px-4 py-2 ${
              institutionsQ.isSuccess ? '' : 'opacity-50'
            }`}
          >
            <Text className="text-sm font-semibold text-white">
              {t('accounts.actions.create')}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerClassName="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={listQ.isRefetching || archivedQ.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.navy}
          />
        }
      >
        {listQ.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : listQ.isError ? (
          <View className="items-center gap-3 py-12">
            <Text className="text-center text-sm text-text-muted">
              {t('accounts.route.active_error')}
            </Text>
            <Button variant="secondary" size="sm" onPress={() => listQ.refetch()}>
              {t('error.retry_action')}
            </Button>
          </View>
        ) : activeCount === 0 ? (
          <AccountsEmptyState onCreate={goCreate} />
        ) : (
          <View className="gap-7">
            {activeCount === 1 && !hintDismissed && (
              <AccountsHint onDismiss={() => setHintDismissed(true)} />
            )}
            <AccountSection title={t('accounts.sections.cash')} accounts={data!.cash} />
            <AccountSection title={t('accounts.sections.bank')} accounts={data!.bank} />
            <AccountSection
              title={t('accounts.sections.archived')}
              accounts={archived}
              archived
            />
          </View>
        )}
      </ScrollView>
    </View>
  )
}
