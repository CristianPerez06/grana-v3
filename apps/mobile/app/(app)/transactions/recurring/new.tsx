import { useMemo } from 'react'
import { Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import type { MovementFormAccount } from '@grana/movement-form'
import { toMovementFormAccounts } from '../../../../lib/accounts/form-accounts'
import { FormScreen } from '../../../../components/layout/FormScreen'
import { RecurrenceForm } from '../../../../components/recurrences/RecurrenceForm'
import { RecurrenceFormSkeleton } from '../../../../components/recurrences/RecurrenceFormSkeleton'
import { getAllCategories } from '../../../../lib/categories'
import { getHousehold } from '../../../../lib/shared/queries'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/locale-context'

// `/transactions/recurring/new` — create a recurrence rule from scratch (no
// movement today). Loads the same inputs as the movement alta (all accounts incl.
// credit, the category tree, the household) and hands them to <RecurrenceForm>.
// Header chrome (back-link) is visible from the first paint; the form body waits
// for its data (mirror of transactions/new.tsx).
export default function NewRecurrenceScreen() {
  const t = useT()
  const router = useRouter()

  const accountsQ = useQuery({
    queryKey: ['movement-form', 'accounts'] as const,
    queryFn: () => getAccounts(supabase, { today: getTodayAR() }),
  })
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

  // Project the grouped accounts onto the form's account shape — mirror of
  // transactions/new.tsx. Credit balances are {0,0} (off-ledger).
  const accounts = useMemo<MovementFormAccount[]>(
    () => toMovementFormAccounts(accountsQ.data),
    [accountsQ.data],
  )

  const ready = accountsQ.isSuccess && categoriesQ.isSuccess && householdQ.isSuccess
  const failed = accountsQ.isError || categoriesQ.isError || householdQ.isError

  return (
    <FormScreen
      title={t('recurrences.create.title')}
      backLink={{ href: '/transactions/recurring', label: t('recurrences.back_label') }}
      onBackPress={() => (router.canGoBack() ? router.back() : router.push('/transactions/recurring'))}
    >
      {failed ? (
        <Text className="text-center text-sm text-text-muted">
          {t('transactions.new.load_error')}
        </Text>
      ) : !ready ? (
        <RecurrenceFormSkeleton />
      ) : (
        <RecurrenceForm
          accounts={accounts}
          categories={categoriesQ.data}
          household={householdQ.data}
          onDone={() => (router.canGoBack() ? router.back() : router.push('/transactions/recurring'))}
        />
      )}
    </FormScreen>
  )
}
