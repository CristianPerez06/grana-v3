import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { TransactionForm } from './_components/transaction-form'

type Props = {
  params: Promise<{ id: string }>
}

const NewTransactionPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const account = await getAccountDetail(id)
  if (!account) notFound()

  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const categories = await getAllCategories(user.id)

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {account.name}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>

      <TransactionForm
        accountId={id}
        activeCurrencies={activeCurrencies.map((c) => c.currency_code as 'ARS' | 'USD')}
        categories={categories}
      />
    </div>
  )
}

export default NewTransactionPage
