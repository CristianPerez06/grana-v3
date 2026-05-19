import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInstallmentFamily, getTransactionDetail } from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import { getRecurrenceLinkForTransaction } from '@/lib/recurrences/queries'
import { GlobalTransactionDetail } from './_components/global-transaction-detail'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'semanal',
  biweekly: 'quincenal',
  monthly: 'mensual',
  annual: 'anual',
}

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

  const [installmentFamily, recurrenceLink] = await Promise.all([
    transaction.is_parent
      ? getInstallmentFamily(transaction.id)
      : transaction.parent_id
        ? getInstallmentFamily(transaction.parent_id)
        : Promise.resolve(null),
    getRecurrenceLinkForTransaction(transaction.id),
  ])
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

      {recurrenceLink && (
        <Link
          href={`/transactions/recurring/${recurrenceLink.recurrence_id}`}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted/50 transition-colors"
        >
          <Repeat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Generado por una regla recurrente</span>{' '}
          <span className="font-medium">
            ({FREQUENCY_LABEL[recurrenceLink.frequency] ?? recurrenceLink.frequency})
          </span>
        </Link>
      )}

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
