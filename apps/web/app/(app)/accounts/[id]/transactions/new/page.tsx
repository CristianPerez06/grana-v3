import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail, getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { PageHeader } from '@/components/ui/page-header'
import { TransactionForm } from './_components/transaction-form'
import { RegisterCardPurchaseForm } from './_components/register-card-purchase-form'

type Props = {
  params: Promise<{ id: string }>
}

const NewTransactionPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('transactions')

  const [account, categories, accountGroups] = await Promise.all([
    getAccountDetail(id),
    getAllCategories(user.id),
    getAccounts(),
  ])

  if (!account) notFound()

  const activeCurrencies = account.currencies
    .filter((c) => c.is_active)
    .map((c) => c.currency_code as 'ARS' | 'USD')

  const isCredit = account.type === 'credit'

  const backHref = isCredit ? `/cards/${id}` : `/accounts/${id}`
  const backLabel = account.name

  // All active cash/bank accounts except the current one, for transfer destination
  const otherAccounts = [
    ...accountGroups.cash,
    ...accountGroups.bank,
  ].filter((a) => a.id !== id && a.is_active)

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={isCredit ? t('register_purchase_title') : t('new_title')}
        backLink={{ href: backHref, label: backLabel }}
      />

      {isCredit ? (
        <RegisterCardPurchaseForm
          accountId={id}
          activeCurrencies={activeCurrencies}
          categories={categories}
        />
      ) : (
        <TransactionForm
          accountId={id}
          activeCurrencies={activeCurrencies}
          categories={categories}
          availableBalances={account.balances}
          otherAccounts={otherAccounts.map((a) => ({
            id: a.id,
            name: a.name,
            currencies: a.currencies
              .filter((c) => c.is_active)
              .map((c) => c.currency_code as 'ARS' | 'USD'),
          }))}
        />
      )}
    </div>
  )
}

export default NewTransactionPage
