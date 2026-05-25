import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { TransactionDetailHeader } from './_components/transaction-detail-header'

type Props = {
  params: Promise<{ id: string; txId: string }>
  searchParams: Promise<{ from?: string }>
}

const TransactionDetailPage = async ({ params, searchParams }: Props) => {
  const { id, txId } = await params
  const { from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('transactions')

  const transaction = await getTransactionDetail(txId)
  const isOwner = transaction?.account_id === id
  const isDestination =
    transaction?.type === 'transfer' && transaction?.transfer_destination_account_id === id
  if (!transaction || (!isOwner && !isDestination)) notFound()

  // Load installment family when this is a credit card child transaction
  const installmentFamily =
    transaction.parent_id ? await getInstallmentFamily(transaction.parent_id) : null

  const cameFromGlobalMovements = from === 'transactions'
  const backHref = cameFromGlobalMovements
    ? '/transactions'
    : transaction.card_period_id
      ? `/cards/${id}/periods/${transaction.card_period_id}`
      : `/accounts/${id}`
  const backLabel = cameFromGlobalMovements
    ? `← ${t('back_label')}`
    : transaction.card_period_id
      ? `← ${t('summary_back_label')}`
      : `← ${t('account_back_label')}`

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
        returnHref={backHref}
        installmentParent={installmentFamily?.parent ?? null}
        installmentSiblings={installmentFamily?.children ?? null}
      />
    </div>
  )
}

export default TransactionDetailPage
