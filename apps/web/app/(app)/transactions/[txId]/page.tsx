import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInstallmentFamily, getTransactionDetail } from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import { GlobalTransactionDetail } from './_components/global-transaction-detail'

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

  const installmentFamily = transaction.is_parent
    ? await getInstallmentFamily(transaction.id)
    : transaction.parent_id
      ? await getInstallmentFamily(transaction.parent_id)
      : null
  const movement = toFinancialMovement(transaction)

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

      <GlobalTransactionDetail
        transaction={transaction}
        movement={movement}
        installmentParent={installmentFamily?.parent ?? null}
        installmentSiblings={installmentFamily?.children ?? null}
      />
    </div>
  )
}

export default GlobalTransactionDetailPage
