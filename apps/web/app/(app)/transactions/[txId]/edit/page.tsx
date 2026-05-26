import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTransactionDetail, getInstallmentFamily } from '@/lib/transactions/queries'
import { getAccountDetail } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getEditableFields } from '@grana/money-logic'
import { PageHeader } from '@/components/ui/page-header'
import { MovementForm, type MovementEditContext } from '../../new/_components/movement-form'

type Props = {
  params: Promise<{ txId: string }>
  searchParams: Promise<{ from?: string }>
}

const EditMovementPage = async ({ params, searchParams }: Props) => {
  const { txId } = await params
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

  const isParent = transaction.is_parent === true
  if (!isParent && !transaction.account_id) notFound()

  // Canonical detail keeps the perspective via `?from=`.
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''
  const detailHref = `/transactions/${txId}${fromQuery}`

  // Installment parent (madre): account_id is NULL; resolve a child's card
  // account and whether any child is paid (locks the amount).
  let accountId: string
  let hasPaidInstallment = false
  let cardName: string | null = null
  if (isParent) {
    const family = await getInstallmentFamily(transaction.id)
    accountId = family.children[0]?.account_id ?? ''
    hasPaidInstallment = family.children.some((c) => c.status === 'paid')
    cardName = family.children.find((c) => c.source_account)?.source_account?.name ?? null
    if (!accountId) notFound()
  } else {
    accountId = transaction.account_id as string
  }

  const isCardPayment =
    Array.isArray(transaction.period_payments) && transaction.period_payments.length > 0

  const editableFields = getEditableFields({
    type: transaction.type,
    status: transaction.status,
    isParent,
    isCardPayment,
    hasPaidInstallment,
  })

  // Available balance of the movement's own account, in the movement currency,
  // for the soft negative-balance warning. Parents (credit, off-ledger) skip it.
  const ownerDetail = transaction.account_id
    ? await getAccountDetail(transaction.account_id)
    : null
  const availableBalance = ownerDetail?.balances[transaction.currency_code] ?? 0

  const edit: MovementEditContext = {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    accountId,
    destinationAccountId: transaction.transfer_destination_account_id,
    isParent,
    amount: Math.abs(transaction.amount),
    signedAmount: transaction.amount,
    date: transaction.date,
    currencyCode: transaction.currency_code,
    destinationCurrency: transaction.destination_currency,
    destinationAmount: transaction.destination_amount,
    categoryId: transaction.category_id,
    subcategoryId: transaction.subcategory_id,
    description: transaction.description,
    installmentsTotal: transaction.installments_total,
    sourceAccountName: isParent ? cardName : transaction.source_account?.name ?? null,
    destinationAccountName: transaction.destination_account?.name ?? null,
    editableFields,
    availableBalance,
    returnHref: detailHref,
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('edit_title')}
        backLink={{ href: detailHref, label: t('detail_back_label') }}
      />

      <MovementForm accounts={[]} categories={categories} edit={edit} />
    </div>
  )
}

export default EditMovementPage
