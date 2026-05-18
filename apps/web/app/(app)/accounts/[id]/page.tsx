import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getTransactions } from '@/lib/transactions/queries'
import { TransactionList } from '@/lib/transactions/components/transaction-list'
import { AccountDetailHeader } from './_components/account-detail-header'

type Props = {
  params: Promise<{ id: string }>
}

const AccountDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [account, transactions] = await Promise.all([
    getAccountDetail(id),
    getTransactions(id, { limit: 20 }),
  ])
  if (!account) notFound()

  const inactiveCurrencies = account.currencies.filter((c) => !c.is_active)
  const allCurrencyCodes = new Set(account.currencies.map((c) => c.currency_code))
  const canAddCurrency =
    !allCurrencyCodes.has('ARS') ||
    !allCurrencyCodes.has('USD') ||
    inactiveCurrencies.length > 0

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Cuentas
        </Link>
      </div>

      <AccountDetailHeader account={account} />

      {canAddCurrency && (
        <Link
          href={`/accounts/${account.id}/edit`}
          className="self-start text-sm text-primary hover:underline"
        >
          + Agregar moneda
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Movimientos
          </h2>
          <Link
            href={`/accounts/${account.id}/transactions/new`}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Agregar
          </Link>
        </div>
        <TransactionList transactions={transactions} accountId={account.id} />
      </section>
    </div>
  )
}

export default AccountDetailPage
