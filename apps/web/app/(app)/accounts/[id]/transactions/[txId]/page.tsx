import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
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
  const isOwner = transaction?.account_id === id
  const isDestination =
    transaction?.type === 'transfer' && transaction?.transfer_destination_account_id === id
  if (!transaction || (!isOwner && !isDestination)) notFound()

  // Load installment family when this is a credit card child transaction
  const installmentFamily =
    transaction.parent_id ? await getInstallmentFamily(transaction.parent_id) : null

  const backHref = transaction.card_period_id
    ? `/cards/${id}/periods/${transaction.card_period_id}`
    : `/accounts/${id}`
  const backLabel = transaction.card_period_id ? '← Resumen' : '← Movimientos'

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {backLabel}
        </Link>
      </div>

      <TransactionDetailHeader
        transaction={transaction}
        accountId={id}
        periodId={transaction.card_period_id ?? null}
        installmentParent={installmentFamily?.parent ?? null}
        installmentSiblings={installmentFamily?.children ?? null}
      />
    </div>
  )
}

export default TransactionDetailPage
