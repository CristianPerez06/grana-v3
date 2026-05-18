import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail } from '@/lib/transactions/queries'
import { TransactionDetailHeader } from './_components/transaction-detail-header'

type Props = {
  params: Promise<{ id: string; txId: string }>
}

const TransactionDetailPage = async ({ params }: Props) => {
  const { id, txId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const transaction = await getTransactionDetail(txId)
  if (!transaction || transaction.account_id !== id) notFound()

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Movimientos
        </Link>
      </div>

      <TransactionDetailHeader transaction={transaction} accountId={id} />
    </div>
  )
}

export default TransactionDetailPage
