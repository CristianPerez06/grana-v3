import { useCallback, useMemo, useRef, useState } from 'react'
import { Text } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import type { MovementFormAccount } from '@grana/movement-form'
import { toMovementFormAccounts } from '../../../lib/accounts/form-accounts'
import { FormScreen } from '../../../components/layout/FormScreen'
import { MovementForm } from '../../../components/transactions/MovementForm'
import { MovementFormSkeleton } from '../../../components/transactions/MovementFormSkeleton'
import { getAllCategories } from '../../../lib/categories'
import { getFrequentClassifications } from '../../../lib/transactions/frequent-classifications'
import { getHousehold } from '../../../lib/shared/queries'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/locale-context'

// `/transactions/new` — the alta screen. Loads the form's data inputs (all
// accounts incl. credit, category tree, household) and hands them to the shared
// `useMovementForm` hook via <MovementForm>. Header chrome (back-link) is
// visible from the first paint; the form body waits for its data (mirror of
// accounts/new.tsx).
export default function NewMovementScreen() {
  const t = useT()
  const router = useRouter()
  // Deep-link preselection (e.g. register-first-purchase from a card detail).
  const { presetAccount } = useLocalSearchParams<{ presetAccount?: string }>()

  // Form-scoped key OUTSIDE the ['accounts'] prefix: the accounts screens cache
  // cash/bank-only under `accountKeys.list` (different shape), and the
  // post-submit invalidation sweeps ['accounts'] — this heavy all-accounts read
  // (credit cards + period math) must not refetch on every submit. Staleness is
  // covered by staleTime on the next screen mount.
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
  // Non-critical accelerator (#31 item 1): kept out of the `ready` gate so it
  // never delays the form.
  const frequentQ = useQuery({
    queryKey: ['movement-form', 'frequent-classifications'] as const,
    queryFn: getFrequentClassifications,
  })

  // Project the grouped accounts onto the form's account shape — mirror of the
  // web movement-drawer-loader. Credit cards are off-ledger, so their balances
  // are {0,0} and the negative-balance warning never applies to them.
  const accounts = useMemo<MovementFormAccount[]>(
    () => toMovementFormAccounts(accountsQ.data),
    [accountsQ.data],
  )

  const ready = accountsQ.isSuccess && categoriesQ.isSuccess && householdQ.isSuccess
  const failed = accountsQ.isError || categoriesQ.isError || householdQ.isError

  // Force a fresh form on every entry. On the fast path — submit pops the screen,
  // then a quick "+" re-pushes it before react-native-screens has torn the old
  // one down — the frozen instance is re-revealed with the last movement's data
  // still in the hook's state. Remounting <MovementForm> on re-focus resets it;
  // the ref skips the initial focus so the first mount isn't double-rendered.
  const [formKey, setFormKey] = useState(0)
  const firstFocus = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      setFormKey((k) => k + 1)
    }, []),
  )

  return (
    <FormScreen
      title={t('transactions.new.title')}
      backLink={{ href: '/(app)/transactions', label: t('nav.movements') }}
    >
      {failed ? (
        <Text className="text-center text-sm text-text-muted">
          {t('transactions.new.load_error')}
        </Text>
      ) : !ready ? (
        <MovementFormSkeleton />
      ) : (
        <MovementForm
          key={formKey}
          accounts={accounts}
          categories={categoriesQ.data}
          frequentClassifications={frequentQ.data ?? undefined}
          household={householdQ.data}
          preselectAccountId={presetAccount}
          onDone={() => router.back()}
        />
      )}
    </FormScreen>
  )
}
