import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Repeat } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  getInstallmentFamily,
  getMonthCategoryBreakdown,
  getMonthIncomeBreakdown,
  getReimbursementsForExpense,
  getTransactionDetail,
} from '@/lib/transactions/queries'
import { toFinancialMovement } from '@/lib/transactions/movements'
import { getCardPeriodDetail } from '@/lib/cards/queries'
import { getRecurrenceDetail, getRecurrenceLinkForTransaction } from '@/lib/recurrences/queries'
import { getMovementSharedInfo } from '@/lib/shared/queries'
import { buildMovementEditContext } from '@/lib/transactions/edit-context'
import { GlobalTransactionDetail } from './_components/global-transaction-detail'
import { summarizeRecurrence } from './_components/detail/recurrence-summary'
import { formatPeriodLabel } from './_components/detail/helpers'
import type { CategorySliceInput } from '@grana/money-logic'

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

  const transaction = await getTransactionDetail(supabase, txId)
  if (!transaction) notFound()

  const t = await getTranslations('transactions')
  const tRec = await getTranslations('recurrences')

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

  const detailHref = `/transactions/${txId}${from ? `?from=${encodeURIComponent(from)}` : ''}`

  const [installmentFamily, recurrenceLink, reimbursements, editData] =
    await Promise.all([
      transaction.is_parent
        ? getInstallmentFamily(supabase, transaction.id)
        : transaction.parent_id
          ? getInstallmentFamily(supabase, transaction.parent_id)
          : Promise.resolve(null),
      getRecurrenceLinkForTransaction(supabase, transaction.id),
      reimbursementExpenseId
        ? getReimbursementsForExpense(supabase, reimbursementExpenseId)
        : Promise.resolve([]),
      buildMovementEditContext(txId, detailHref),
    ])
  const movement = toFinancialMovement(transaction)
  const sharedInfo = transaction.is_shared
    ? await getMovementSharedInfo(supabase, transaction.id, transaction.is_parent)
    : null

  // "Peso en el mes": slices del mes del movimiento para su moneda. Solo aplica a
  // gastos (incl. cuotas) e ingresos categorizables — reusa el breakdown del dashboard.
  const month = movement.date.slice(0, 7)
  let monthWeightSlices: CategorySliceInput[] | null = null
  if (movement.kind === 'income') {
    const breakdown = await getMonthIncomeBreakdown(supabase, month)
    monthWeightSlices = breakdown[movement.currency_code]
  } else if (movement.kind === 'expense' || movement.kind === 'installment_purchase') {
    const breakdown = await getMonthCategoryBreakdown(supabase, month)
    monthWeightSlices = breakdown[movement.currency_code]
  }

  // Período de tarjeta para la nota contextual. En un pago de resumen viene en
  // `period_payments`; en un consumo/cuota de tarjeta el período está en
  // `card_period_id` (period_payments está vacío), así que lo buscamos.
  let contextPeriodLabel = formatPeriodLabel(transaction.period_payments?.[0]?.period ?? null)
  if (!contextPeriodLabel && transaction.card_period_id) {
    const { data: period } = await supabase
      .from('card_periods')
      .select('start_date, end_date')
      .eq('id', transaction.card_period_id)
      .maybeSingle()
    contextPeriodLabel = formatPeriodLabel(period)
  }

  // Detalle de la recurrencia (próximo/desde/nº cobros/acumulado/historial) cuando
  // el movimiento fue generado por una regla.
  const recurrenceSummary = recurrenceLink
    ? await getRecurrenceDetail(supabase, recurrenceLink.recurrence_id).then((detail) =>
        detail ? summarizeRecurrence(detail) : null,
      )
    : null

  // Card payments show the statement composition (ARS + USD portions) instead
  // of repeating the period info the context note already carries.
  let paymentComposition: { paidARS: number; paidUSD: number } | null = null
  if (movement.kind === 'card_payment') {
    const periodDetail = await getCardPeriodDetail(supabase, movement.period_id)
    if (periodDetail) {
      paymentComposition = {
        paidARS: periodDetail.paidAmountARS,
        paidUSD: periodDetail.paidAmountUSD,
      }
    }
  }

  return (
    <>
      {recurrenceLink && (
        <Link
          href={`/transactions/recurring/${recurrenceLink.recurrence_id}`}
          className="mx-4 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted/50 transition-colors"
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
        edit={editData?.edit ?? null}
        editCategories={editData?.categories}
        editHousehold={editData?.household ?? null}
        sharedInfo={sharedInfo}
        paymentComposition={paymentComposition}
        monthWeightSlices={monthWeightSlices}
        recurrence={recurrenceSummary}
        contextPeriodLabel={contextPeriodLabel}
      />
    </>
  )
}

export default GlobalTransactionDetailPage
