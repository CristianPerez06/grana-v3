import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  getInstallmentFamily,
  getReimbursementsForExpense,
  getTransactionDetail,
} from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import { getRecurrenceLinkForTransaction } from '@/lib/recurrences/queries'
import { GlobalTransactionDetail } from './_components/global-transaction-detail'

type Props = {
  params: Promise<{ txId: string }>
  searchParams: Promise<{ from?: string }>
}

const GlobalTransactionDetailPage = async ({ params, searchParams }: Props) => {
  const { txId } = await params
  const { from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const transaction = await getTransactionDetail(txId)
  if (!transaction) notFound()

  // "Volver" respeta el origen: from=account:<id> regresa a la cuenta,
  // from=card:<id> a la tarjeta; si no, a Movimientos.
  const fromAccountId = from?.startsWith('account:') ? from.slice('account:'.length) : null
  const fromCardId = from?.startsWith('card:') ? from.slice('card:'.length) : null
  const backHref = fromAccountId
    ? `/accounts/${fromAccountId}`
    : fromCardId
      ? `/cards/${fromCardId}`
      : '/transactions'

  const t = await getTranslations('transactions')
  const tRec = await getTranslations('recurrences')

  const fromId = fromAccountId ?? fromCardId
  const backLabel =
    fromId && transaction.source_account?.id === fromId
      ? transaction.source_account.name
      : fromId && transaction.destination_account?.id === fromId
        ? (transaction.destination_account?.name ?? t('back_label'))
        : t('back_label')

  const getFrequencyLowerLabel = (freq: string) => {
    if (freq === 'weekly' || freq === 'biweekly' || freq === 'monthly' || freq === 'annual') {
      return tRec(`frequencies_lower.${freq}`)
    }
    return freq
  }

  // Reimbursements are linked to the simple expense or the installment parent
  // (madre). For a child row, look them up on the parent.
  const reimbursementExpenseId =
    transaction.type === 'expense' ? (transaction.parent_id ?? transaction.id) : null

  const [installmentFamily, recurrenceLink, reimbursements] = await Promise.all([
    transaction.is_parent
      ? getInstallmentFamily(transaction.id)
      : transaction.parent_id
        ? getInstallmentFamily(transaction.parent_id)
        : Promise.resolve(null),
    getRecurrenceLinkForTransaction(transaction.id),
    reimbursementExpenseId
      ? getReimbursementsForExpense(reimbursementExpenseId)
      : Promise.resolve([]),
  ])
  const movement = toFinancialMovement(transaction)

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {backLabel}
        </Link>
      </div>

      {recurrenceLink && (
        <Link
          href={`/transactions/recurring/${recurrenceLink.recurrence_id}`}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted/50 transition-colors"
        >
          <Repeat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">{t('generated_by_rule')}</span>{' '}
          <span className="font-medium">
            ({getFrequencyLowerLabel(recurrenceLink.frequency)})
          </span>
        </Link>
      )}

      <GlobalTransactionDetail
        transaction={transaction}
        movement={movement}
        installmentParent={installmentFamily?.parent ?? null}
        installmentSiblings={installmentFamily?.children ?? null}
        reimbursements={reimbursements}
        from={from}
      />
    </div>
  )
}

export default GlobalTransactionDetailPage
