import { useMemo } from 'react'
import { Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { MovementFormAccount } from '@grana/movement-form'
import { FormScreen } from '../../../../components/layout/FormScreen'
import { RecurrenceForm } from '../../../../components/recurrences/RecurrenceForm'
import { RecurrenceFormSkeleton } from '../../../../components/recurrences/RecurrenceFormSkeleton'
import { getAllCategories } from '../../../../lib/categories'
import { getHousehold } from '../../../../lib/shared/queries'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/locale-context'

type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

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
  const accounts = useMemo<MovementFormAccount[]>(() => {
    const grouped = accountsQ.data
    if (!grouped) return []
    return [
      ...[...grouped.cash, ...grouped.bank].map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as 'cash' | 'bank',
        activeCurrencies: activeCodes(a.currencies),
        balances: a.balances,
        institutionId: a.institution_id ?? null,
        institutionName: a.institution?.name ?? null,
        avatar: a.avatar,
      })),
      ...grouped.credit.map((c) => ({
        id: c.id,
        name: c.name,
        type: 'credit' as const,
        activeCurrencies: activeCodes(c.currencies),
        balances: { ARS: 0, USD: 0 },
        institutionId: c.institution_id ?? null,
        institutionName: c.institution?.name ?? null,
        avatar: resolveAccountAvatar(
          { id: c.id, name: c.name, type: 'credit', color_key: c.color_key, icon_key: c.icon_key },
          c.institution,
        ),
      })),
    ]
  }, [accountsQ.data])

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
