import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail } from '@/lib/transactions/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { PageHeader } from '@/components/ui/page-header'
import { EditTransactionForm } from './_components/edit-transaction-form'

type Props = {
  params: Promise<{ id: string; txId: string }>
}

const EditTransactionPage = async ({ params }: Props) => {
  const { id, txId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [transaction, categories] = await Promise.all([
    getTransactionDetail(txId),
    getAllCategories(user.id),
  ])
  const isOwner = transaction?.account_id === id
  const isDestination =
    transaction?.type === 'transfer' && transaction?.transfer_destination_account_id === id
  if (!transaction || (!isOwner && !isDestination)) notFound()
  if (!transaction.account_id) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title="Editar movimiento"
        backLink={{ href: `/accounts/${id}/transactions/${txId}`, label: 'Detalle' }}
      />

      <EditTransactionForm
        transaction={transaction}
        accountId={transaction.account_id}
        categories={categories}
      />
    </div>
  )
}

export default EditTransactionPage
