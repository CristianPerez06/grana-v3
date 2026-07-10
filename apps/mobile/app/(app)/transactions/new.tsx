import { useMemo } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import type { MovementFormAccount } from '@grana/movement-form'
import { PageHeader } from '../../../components/ui/PageHeader'
import { Spinner } from '../../../components/ui/Spinner'
import { MovementForm } from '../../../components/transactions/MovementForm'
import { useAccountsList } from '../../../lib/accounts/queries'
import { getAllCategories } from '../../../lib/categories'
import { getHousehold } from '../../../lib/shared/queries'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/locale-context'

// `/transactions/new` — the B-minimal alta screen. Loads the form's data inputs
// (cash-bank accounts, category tree, household) and hands them to the shared
// `useMovementForm` hook via <MovementForm>. Header chrome (back-link) is
// visible from the first paint; the form body waits for its data (mirror of
// accounts/new.tsx).
export default function NewMovementScreen() {
  const t = useT()
  const router = useRouter()

  const accountsQ = useAccountsList()
  const categoriesQ = useQuery({
    queryKey: ['categories', 'all'] as const,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user ? getAllCategories(user.id) : []
    },
  })
  const householdQ = useQuery({
    queryKey: ['household', 'form'] as const,
    queryFn: getHousehold,
  })

  // Project the grouped cash/bank accounts onto the form's account shape. Credit
  // cards are out of B-minimal scope, so the source list is cash/bank only.
  const accounts = useMemo<MovementFormAccount[]>(() => {
    const grouped = accountsQ.data
    if (!grouped) return []
    return [...grouped.cash, ...grouped.bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      activeCurrencies: a.currencies
        .filter((c) => c.is_active)
        .map((c) => c.currency_code),
      balances: a.balances,
      institutionId: a.institution_id,
      institutionName: a.institution?.name ?? null,
      avatar: a.avatar,
    }))
  }, [accountsQ.data])

  const ready = accountsQ.isSuccess && categoriesQ.isSuccess && householdQ.isSuccess
  const failed = accountsQ.isError || categoriesQ.isError || householdQ.isError

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('transactions.new.title')}
        backLink={{ href: '/(app)/transactions', label: t('nav.movements') }}
      />
      <ScrollView
        contentContainerClassName="px-6 py-6 pb-28"
        keyboardShouldPersistTaps="handled"
      >
        {failed ? (
          <Text className="text-center text-sm text-text-muted">
            {t('transactions.new.load_error')}
          </Text>
        ) : !ready ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : (
          <MovementForm
            accounts={accounts}
            categories={categoriesQ.data}
            household={householdQ.data}
            onDone={() => router.back()}
          />
        )}
      </ScrollView>
    </View>
  )
}
