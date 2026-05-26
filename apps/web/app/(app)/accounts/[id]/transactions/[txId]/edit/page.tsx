import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { PageHeader } from '@/components/ui/page-header'
import { EditTransactionForm } from './_components/edit-transaction-form'
import { EditExchangeForm } from './_components/edit-exchange-form'

type Props = {
  params: Promise<{ id: string; txId: string }>
  searchParams: Promise<{ from?: string }>
}

const EditTransactionPage = async ({ params, searchParams }: Props) => {
  const { id, txId } = await params
  const { from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('transactions')

  const [transaction, categories] = await Promise.all([
    getTransactionDetail(txId),
    getAllCategories(user.id),
  ])
  if (!transaction) notFound()

  // An installment parent (madre) has account_id=NULL and is reached from the
  // global detail with `id` = a child's card account. Ownership is enforced by
  // RLS in getTransactionDetail; for non-parents we still check the account.
  const isParent = transaction.is_parent === true
  const isOwner = transaction.account_id === id
  const isDestination =
    (transaction.type === 'transfer' || transaction.type === 'exchange') &&
    transaction.transfer_destination_account_id === id
  if (!isParent && !isOwner && !isDestination) notFound()
  if (!isParent && !transaction.account_id) notFound()

  const cameFromGlobal = from === 'transactions'
  const detailHref = cameFromGlobal
    ? `/transactions/${txId}`
    : `/accounts/${id}/transactions/${txId}`

  // Current available balance of the movement's own account (source account for
  // a transfer), per currency, for the soft negative-balance warning. Parents
  // (credit, off-ledger) have no account and never warn.
  const ownerDetail = transaction.account_id
    ? await getAccountDetail(transaction.account_id)
    : null
  const availableBalances = ownerDetail?.balances ?? { ARS: 0, USD: 0 }

  // The amount is editable unless it's a paid credit-card purchase: a paid
  // single consumption, or an installment purchase with at least one paid
  // installment. Editing a normal movement or an unpaid card purchase is fine
  // (for an installment parent the amount re-splits across its children).
  let amountEditable: boolean
  if (isParent) {
    const family = await getInstallmentFamily(transaction.id)
    amountEditable = !(family?.children ?? []).some((c) => c.status === 'paid')
  } else {
    amountEditable = transaction.status !== 'paid'
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('edit_title')}
        backLink={{ href: detailHref, label: t('detail_back_label') }}
      />

      {transaction.type === 'exchange' ? (
        <EditExchangeForm
          transaction={transaction}
          returnHref={detailHref}
          availableBalances={availableBalances}
        />
      ) : (
        <EditTransactionForm
          transaction={transaction}
          accountId={transaction.account_id ?? id}
          categories={categories}
          returnHref={detailHref}
          availableBalances={availableBalances}
          amountEditable={amountEditable}
        />
      )}
    </div>
  )
}

export default EditTransactionPage
