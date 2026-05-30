import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { MovementForm, type MovementFormAccount } from './_components/movement-form'

const activeCodes = (
  currencies: Array<{ currency_code: string; is_active: boolean }>,
): ('ARS' | 'USD')[] =>
  currencies
    .filter((c) => c.is_active && (c.currency_code === 'ARS' || c.currency_code === 'USD'))
    .map((c) => c.currency_code as 'ARS' | 'USD')

type Props = {
  searchParams: Promise<{ account?: string; from?: string }>
}

// Resolve where to return after saving from the optional `?from=` origin:
// `account:<id>` → the account, `card:<id>` → the card, otherwise the list.
const resolveReturnHref = (from?: string): string => {
  if (from?.startsWith('account:')) return `/accounts/${from.slice('account:'.length)}`
  if (from?.startsWith('card:')) return `/cards/${from.slice('card:'.length)}`
  return '/transactions'
}

/**
 * Canonical entry point to register a movement. The account is a field inside
 * the form (chosen while loading the movement), optionally pre-selected via
 * `?account=` when arriving from a specific account or card. Cash/bank accounts
 * show the income/expense/transfer/adjustment form; credit cards switch to the
 * consumo form.
 */
const NewMovementPage = async ({ searchParams }: Props) => {
  const { account: preselectAccountId, from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('transactions')

  const [{ cash, bank, credit }, categories] = await Promise.all([
    getAccounts(),
    getAllCategories(user.id),
  ])

  const accounts: MovementFormAccount[] = [
    ...[...cash, ...bank].map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as 'cash' | 'bank',
      activeCurrencies: activeCodes(a.currencies),
      balances: a.balances,
      institutionId: a.institution_id ?? null,
      avatar: a.avatar,
    })),
    ...credit.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'credit' as const,
      activeCurrencies: activeCodes(c.currencies),
      balances: { ARS: 0, USD: 0 },
      institutionId: c.institution_id ?? null,
    })),
  ]

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('actions.register_movement')}
        backLink={{ href: '/transactions', label: t('back_label') }}
      />

      <MovementForm
        accounts={accounts}
        categories={categories}
        preselectAccountId={preselectAccountId}
        createReturnHref={resolveReturnHref(from)}
      />
    </div>
  )
}

export default NewMovementPage
