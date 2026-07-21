import { useMemo } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { MovementFormAccount } from '@grana/movement-form'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { MovementForm } from '../../../../components/transactions/MovementForm'
import { MovementFormSkeleton } from '../../../../components/transactions/MovementFormSkeleton'
import { getAllCategories } from '../../../../lib/categories'
import { getHousehold } from '../../../../lib/shared/queries'
import { buildMovementEditContext } from '../../../../lib/transactions/edit-context'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/locale-context'

type AccountCurrency = { currency_code: string; is_active: boolean }

const activeCodes = (currencies: AccountCurrency[]): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

// `/transactions/[txId]/edit` — the edit screen. Mirror of `new.tsx`: loads the
// form's data inputs (all accounts incl. credit, category tree, household) plus
// the edit context (`buildMovementEditContext`), and hands them to the shared
// `useMovementForm` hook via <MovementForm edit={…}>. Header chrome (back-link)
// is visible from the first paint; the form body waits for its data. A null edit
// context (movement missing / not owned / not editable) renders the not-found
// state — same gate web's `/edit` page uses.
export default function EditMovementScreen() {
  const t = useT()
  const router = useRouter()
  const { txId, from } = useLocalSearchParams<{ txId: string; from?: string }>()
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''

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
  const editQ = useQuery({
    queryKey: ['transactions', 'edit-context', txId] as const,
    queryFn: () => buildMovementEditContext(txId),
  })

  // Project the grouped accounts onto the form's account shape — mirror of
  // new.tsx / the web movement-drawer-loader.
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

  const ready =
    accountsQ.isSuccess && categoriesQ.isSuccess && householdQ.isSuccess && editQ.isSuccess
  const failed = accountsQ.isError || categoriesQ.isError || householdQ.isError || editQ.isError
  const notFound = editQ.isSuccess && editQ.data === null

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(`/transactions/${txId}${fromQuery}`)
  }

  return (
    <View className="flex-1 bg-page">
      <PageHeader
        title={t('transactions.edit_title')}
        backLink={{ href: `/transactions/${txId}`, label: t('common.back') }}
        onBackPress={goBack}
      />
      <ScrollView contentContainerClassName="px-6 py-6 pb-28" keyboardShouldPersistTaps="handled">
        {failed ? (
          <Text className="text-center text-sm text-text-muted">
            {t('transactions.new.load_error')}
          </Text>
        ) : notFound ? (
          <View className="rounded-2xl border border-border-soft bg-card p-8">
            <Text className="text-center text-base font-bold text-text">
              {t('notFound.transactions.title')}
            </Text>
            <Text className="mt-1.5 text-center text-sm text-text-muted">
              {t('notFound.transactions.description')}
            </Text>
          </View>
        ) : !ready || !editQ.data ? (
          <MovementFormSkeleton variant="edit" />
        ) : (
          <MovementForm
            accounts={accounts}
            categories={categoriesQ.data}
            household={householdQ.data}
            edit={editQ.data}
            onDone={goBack}
          />
        )}
      </ScrollView>
    </View>
  )
}
