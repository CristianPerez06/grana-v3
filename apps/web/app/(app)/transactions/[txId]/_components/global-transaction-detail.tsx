'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  Banknote,
  Calendar,
  CalendarClock,
  Coins,
  CreditCard,
  FileText,
  Hash,
  Info,
  Receipt,
  Scale,
  Tag,
  Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import type { FinancialMovement, MovementReviewFlag } from '@/lib/transactions/movements'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import type { ExpenseReimbursementVM } from '@/lib/transactions/queries'
import { resolveTone, toneToClass } from '@/lib/transactions/components/tone'
import { resolveContextVariant } from '@/lib/transactions/components/resolve-context-variant'
import { TxHeader } from './tx-header'
import { TxHero } from './tx-hero'
import { TxContextNote } from './tx-context-note'
import { TxDetailGroup } from './tx-detail-group'
import { TxDetailRow } from './tx-detail-row'
import { TxInstallmentRows } from './tx-installment-rows'
import { TxActionsMenu } from './tx-actions-menu'
import { Drawer } from '@/components/ui/drawer'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import {
  MovementForm,
  type MovementEditContext,
} from '../../new/_components/movement-form'

const formatBalance = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(Math.abs(amount), showCents) : formatUSD(Math.abs(amount), showCents)

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const formatShortDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Match the column color to a CSS color string. The fallback gray is the same
// the row uses elsewhere when there's no category color.
const heroBgFor = (movement: FinancialMovement): string => {
  if (movement.category_color) return movement.category_color
  // Structural movements (transfer, exchange, adjustment, card_payment) and
  // categorizable movements without a category color fall back to slate.
  return '#3A6B8A'
}

const heroIconFor = (movement: FinancialMovement): ReactNode => {
  // Categorized movements with an emoji use the emoji; otherwise a lucide
  // icon picked by kind.
  if (movement.category_icon) return <span style={{ fontSize: 28 }}>{movement.category_icon}</span>
  switch (movement.kind) {
    case 'transfer':
      return <ArrowLeftRight size={28} strokeWidth={1.8} />
    case 'exchange':
      return <Coins size={28} strokeWidth={1.8} />
    case 'adjustment':
      return <Scale size={28} strokeWidth={1.8} />
    case 'card_payment':
      return <CreditCard size={28} strokeWidth={1.8} />
    case 'income':
      return <ArrowDownLeft size={28} strokeWidth={1.8} />
    case 'reimbursement':
      return <Receipt size={28} strokeWidth={1.8} />
    case 'installment_purchase':
      return <CreditCard size={28} strokeWidth={1.8} />
    default:
      return <Tag size={28} strokeWidth={1.8} />
  }
}

// Lucide icon by label key. Keeps the per-row icon picking out of the JSX
// salad below.
const iconFor = (labelKey: string): ReactNode => {
  switch (labelKey) {
    case 'date':
      return <Calendar size={16} strokeWidth={2} />
    case 'account':
    case 'destination_account':
    case 'source_account':
      return <Wallet size={16} strokeWidth={2} />
    case 'category':
    case 'subcategory':
      return <Tag size={16} strokeWidth={2} />
    case 'card':
      return <CreditCard size={16} strokeWidth={2} />
    case 'period':
    case 'due_date':
    case 'first_payment':
      return <CalendarClock size={16} strokeWidth={2} />
    case 'fx_rate':
      return <Hash size={16} strokeWidth={2} />
    case 'description':
      return <FileText size={16} strokeWidth={2} />
    case 'amount':
    case 'estimated_amount':
      return <Banknote size={16} strokeWidth={2} />
    default:
      return <Info size={16} strokeWidth={2} />
  }
}

// Period label for the in-context note ("Mayo 2026"). Falls back to the raw
// range when start/end aren't from the same month.
const formatPeriodLabel = (period: { start_date: string; end_date: string } | null | undefined): string => {
  if (!period) return ''
  const start = new Date(period.start_date)
  const end = new Date(period.end_date)
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  }
  return `${formatShortDate(period.start_date)} – ${formatShortDate(period.end_date)}`
}

type Props = {
  transaction: TransactionWithDetails
  movement: FinancialMovement
  installmentParent?: TransactionWithDetails | null
  installmentSiblings?: TransactionWithDetails[] | null
  reimbursements?: ExpenseReimbursementVM[]
  /** Perspective origin (`account:<id>` / `card:<id>` / undefined). */
  from?: string
  /** Where the back arrow takes the user. Resolved by page.tsx. */
  backHref: string
  /**
   * Edit context + categories for the in-context edit drawer. When present, the
   * "Editar" action opens the drawer instead of navigating to the `/edit` page.
   */
  edit?: MovementEditContext | null
  editCategories?: CategoryWithSubcategories[]
}

export const GlobalTransactionDetail = ({
  transaction,
  movement,
  installmentParent,
  installmentSiblings,
  reimbursements = [],
  from,
  backHref,
  edit,
  editCategories,
}: Props) => {
  const showCents = useShowCents()
  const t = useTranslations('transactions')
  const [editOpen, setEditOpen] = useState(false)
  const canUseEditDrawer = edit != null && editCategories != null

  const reviewLabel: Record<MovementReviewFlag, string> = {
    missing_category: t('review_flags.missing_category'),
    missing_fx_rate: t('review_flags.missing_fx_rate'),
  }

  const isPendingReimbursement =
    movement.kind === 'reimbursement' && movement.state !== 'received'
  const tone = resolveTone(movement.kind, movement.sign, isPendingReimbursement)

  // Account used to delete (revalidation). For a normal movement it's its own
  // account; for an installment parent (account_id=NULL) it's a child's card
  // account.
  const actionAccountId = transaction.account_id ?? installmentSiblings?.[0]?.account_id ?? null
  const canEdit = actionAccountId != null && transaction.status !== 'paid'
  const canDelete = actionAccountId != null && !transaction.parent_id && transaction.status !== 'paid'

  // Hero: description carries the narrative; the context line carries date +
  // (when relevant) a second piece of identity.
  const heroDesc =
    movement.description ??
    movement.title ??
    transaction.category?.name ??
    t(`types.${transaction.type}`)
  const heroContext: ReactNode = (
    <>
      {formatDate(movement.date)}
      {movement.account_name ? <> · {movement.account_name}</> : null}
    </>
  )

  // In-context note variant + i18n copy with the period interpolated when it
  // applies. The note lives BELOW the hero, above the first DetailGroup.
  const contextVariant = resolveContextVariant(movement, transaction)
  const payment = transaction.period_payments?.[0]
  const periodLabel = formatPeriodLabel(payment?.period ?? null)
  const contextCopy = contextVariant
    ? t(`detail.context.${contextVariant.replace(/-/g, '_')}`, { periodo: periodLabel })
    : null

  // Detail rows: filtered to the keys + values that apply for this kind.
  type Row = { key: string; label: string; value: string | null; valueNode?: ReactNode }
  const rows: Row[] = []

  if (movement.kind === 'transfer') {
    rows.push(
      { key: 'source_account', label: t('labels.source_account'), value: movement.account_name },
      { key: 'destination_account', label: t('labels.destination_account'), value: movement.destination_account_name },
    )
  } else if (movement.kind === 'exchange') {
    rows.push(
      { key: 'source_account', label: t('labels.source_account'), value: movement.account_name },
      { key: 'destination_account', label: t('labels.destination_account'), value: movement.destination_account_name },
      {
        key: 'destination_amount',
        label: t('labels.exchange_received'),
        value: null,
        valueNode: (
          <span className="text-income tabular-nums">
            +{formatBalance(movement.destination_amount, movement.destination_currency, showCents)}
          </span>
        ),
      },
    )
    if (movement.destination_amount > 0) {
      rows.push({
        key: 'fx_rate',
        label: t('labels.fx_rate'),
        value: `1 ${movement.destination_currency} = ${formatBalance(movement.amount / movement.destination_amount, movement.currency_code, showCents)}`,
      })
    }
  } else if (movement.kind === 'adjustment') {
    rows.push(
      {
        key: 'adjustment_type',
        label: t('labels.adjustment_type'),
        value: transaction.amount > 0 ? t('directions.increase_full') : t('directions.decrease_full'),
      },
      { key: 'account', label: t('labels.account'), value: movement.account_name },
    )
  } else if (movement.kind === 'card_payment') {
    rows.push(
      { key: 'account', label: t('detail.labels.account'), value: movement.account_name },
      { key: 'card', label: t('detail.labels.card'), value: payment?.period?.account?.name ?? null },
      {
        key: 'period',
        label: t('detail.labels.period'),
        value: payment?.period
          ? `${formatShortDate(payment.period.start_date)} – ${formatShortDate(payment.period.end_date)}`
          : null,
      },
      {
        key: 'due_date',
        label: t('detail.labels.due_date'),
        value: payment?.period?.due_date ? formatShortDate(payment.period.due_date) : null,
      },
    )
  } else if (movement.kind === 'installment_purchase') {
    const cardName = installmentSiblings?.find((s) => s.source_account)?.source_account?.name ?? null
    rows.push(
      { key: 'card', label: t('detail.labels.card'), value: cardName },
      { key: 'category', label: t('detail.labels.category'), value: transaction.category?.name ?? null },
      { key: 'subcategory', label: t('detail.labels.subcategory'), value: transaction.subcategory?.name ?? null },
    )
  } else if (movement.kind === 'reimbursement') {
    rows.push(
      {
        key: 'reimbursement_target',
        label: t('detail.labels.reimbursement_target'),
        value: transaction.reimbursement_target
          ? t(`reimbursement.target.${transaction.reimbursement_target}`)
          : null,
      },
      { key: 'account', label: t('detail.labels.account'), value: movement.account_name },
      { key: 'category', label: t('detail.labels.category'), value: movement.category_name },
    )
    if (
      transaction.estimated_amount != null &&
      transaction.received_at != null &&
      Math.abs(transaction.estimated_amount - transaction.amount) > 0.005
    ) {
      rows.push({
        key: 'estimated_amount',
        label: t('reimbursement.estimated_label'),
        value: formatBalance(transaction.estimated_amount, movement.currency_code, showCents),
      })
    }
  } else {
    // income / expense
    rows.push(
      { key: 'account', label: t('detail.labels.account'), value: movement.account_name },
      { key: 'category', label: t('detail.labels.category'), value: transaction.category?.name ?? null },
      { key: 'subcategory', label: t('detail.labels.subcategory'), value: transaction.subcategory?.name ?? null },
    )
  }

  if (transaction.fx_rate_to_ars) {
    rows.push({
      key: 'fx_rate',
      label: t('detail.labels.fx_rate'),
      value: t('fx_rate_template', { rate: transaction.fx_rate_to_ars }),
    })
  }

  const filteredRows = rows.filter((r) => r.value != null || r.valueNode != null)

  return (
    <div className="flex flex-col gap-4">
      {canUseEditDrawer && (
        <Drawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          ariaLabel={t('edit_title')}
        >
          <MovementForm
            variant="drawer"
            accounts={[]}
            categories={editCategories!}
            edit={edit!}
            onClose={() => setEditOpen(false)}
            onSuccess={() => setEditOpen(false)}
          />
        </Drawer>
      )}
      <TxHeader
        backHref={backHref}
        backLabel={t('back_label')}
        actions={
          actionAccountId && (
            <TxActionsMenu
              transactionId={transaction.id}
              accountId={actionAccountId}
              canEdit={canEdit}
              canDelete={canDelete}
              isParent={transaction.is_parent}
              isCardPayment={!!payment}
              onEdit={canUseEditDrawer ? () => setEditOpen(true) : undefined}
            />
          )
        }
      />

      <TxHero
        iconBg={heroBgFor(movement)}
        icon={heroIconFor(movement)}
        amount={movement.amount}
        currency={movement.currency_code}
        tone={tone}
        desc={heroDesc}
        context={heroContext}
      />

      <TxContextNote copy={contextCopy} />

      {movement.review_flags.length > 0 && (
        <div className="mx-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <div>
            <p className="font-medium">{t('review_alert_title')}</p>
            <p>{movement.review_flags.map((flag) => reviewLabel[flag]).join(' · ')}</p>
          </div>
        </div>
      )}

      <TxDetailGroup title={t('detail.groups.details')}>
        <TxDetailRow icon={iconFor('date')} label={t('detail.labels.date')} value={formatDate(movement.date)} />
        {filteredRows.map((row) => (
          <TxDetailRow
            key={row.key}
            icon={iconFor(row.key)}
            label={row.label}
            value={row.valueNode ? undefined : (row.value ?? undefined)}
            valueNode={row.valueNode}
          />
        ))}
        {transaction.description && (
          <TxDetailRow
            icon={iconFor('description')}
            label={t('detail.labels.description') ?? 'Descripción'}
            value={transaction.description}
          />
        )}
      </TxDetailGroup>

      {movement.kind === 'reimbursement' && transaction.linked_expense && (
        <TxDetailGroup title={t('reimbursement.linked_expense_title')}>
          <Link
            href={`/transactions/${transaction.linked_expense.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
          >
            <span className="min-w-0 truncate text-text">
              {transaction.linked_expense.description ??
                transaction.linked_expense.category?.name ??
                t('types.expense')}
            </span>
            <span className="shrink-0 tabular-nums text-expense">
              −{formatBalance(transaction.linked_expense.amount, transaction.linked_expense.currency_code, showCents)}
            </span>
          </Link>
        </TxDetailGroup>
      )}

      {installmentParent && installmentSiblings && installmentSiblings.length > 0 && (
        <TxDetailGroup title={t('detail.groups.installments')}>
          <TxInstallmentRows
            installments={installmentSiblings}
            currentId={transaction.id}
            from={from}
          />
        </TxDetailGroup>
      )}

      {reimbursements.length > 0 && (
        <TxDetailGroup title={t('detail.groups.reimbursements')}>
          {reimbursements.map((r) => (
            <Link
              key={r.id}
              href={`/transactions/${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                    r.state === 'received'
                      ? 'bg-emerald-soft text-emerald-deep'
                      : r.state === 'cancelled'
                        ? 'bg-muted text-muted-foreground line-through'
                        : 'bg-warning-soft text-warning-deep'
                  }`}
                >
                  {t(`reimbursement.state.${r.state}`)}
                </span>
                <span className="truncate text-text-muted">
                  {t(`reimbursement.target.${r.target}`)}
                </span>
              </span>
              <span
                className={`shrink-0 tabular-nums ${
                  r.state === 'cancelled' ? 'text-muted-foreground line-through' : toneToClass('income')
                }`}
              >
                +{formatBalance(r.amount, r.currencyCode, showCents)}
              </span>
            </Link>
          ))}
        </TxDetailGroup>
      )}
    </div>
  )
}
