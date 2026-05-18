import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail } from '@/lib/transactions/queries'
import { getAllCategories } from '@/lib/categories/queries'
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
  if (!transaction || transaction.account_id !== id) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${id}/transactions/${txId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Detalle
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Editar movimiento</h1>

      <EditTransactionForm
        transaction={transaction}
        accountId={id}
        categories={categories}
      />
    </div>
  )
}

export default EditTransactionPage
