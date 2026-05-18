import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getInstallmentFamily, getTransactionDetail } from '@/lib/transactions/queries'
import { TransactionDetailHeader } from '../../accounts/[id]/transactions/[txId]/_components/transaction-detail-header'

type Props = {
  params: Promise<{ txId: string }>
}

const GlobalTransactionDetailPage = async ({ params }: Props) => {
  const { txId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const transaction = await getTransactionDetail(txId)
  if (!transaction) notFound()

  if (!transaction.is_parent) {
    if (!transaction.account_id) notFound()
    redirect(`/accounts/${transaction.account_id}/transactions/${transaction.id}?from=transactions`)
  }

  const installmentFamily = await getInstallmentFamily(transaction.id)
  const firstChildAccountId = installmentFamily.children.find((child) => child.account_id)?.account_id ?? ''

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href="/transactions"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Movimientos
        </Link>
      </div>

      <TransactionDetailHeader
        transaction={transaction}
        accountId={firstChildAccountId}
        returnHref="/transactions"
        showActions={false}
        installmentParent={installmentFamily.parent ?? transaction}
        installmentSiblings={installmentFamily.children}
      />
    </div>
  )
}

export default GlobalTransactionDetailPage
