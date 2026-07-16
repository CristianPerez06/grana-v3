import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Calendar,
  Check,
  Coins,
  CreditCard,
  Hash,
  Receipt,
  Scale,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { resolveMovementView, type MovementKind } from '@grana/money-logic'
import {
  resolveTone,
  toMovementViewInput,
  type FinancialMovement,
  type TransactionWithDetails,
  type ExpenseReimbursementVM,
} from '@grana/transactions'
import type { MovementSharedInfo } from '../../../lib/shared/queries'
import { useLocale, useT } from '../../../lib/locale-context'
import { useShowCents } from '../../../lib/preferences-context'
import { colors } from '../../../lib/colors'
import { Chip, StatusDot } from './primitives'
import { formatLongDate, formatShortDate, toneClasses } from './format'
import {
  TileDetail,
  TileDescription,
  TileDividedAmong,
  TileInstallments,
  TilePaymentMethod,
  TileReimbursementNet,
  TileShareYours,
  TileTransferCallout,
  TileTransferFlow,
  type DetailRowSpec,
} from './tiles'

// Orquestador RN del detalle de movimiento — mirror de web
// `global-transaction-detail.tsx`, read-only: hero tonal + tiles core por tipo.
// Los tiles de contexto (peso en el mes, recurrencia, composición de resumen)
// quedan fuera de este alcance; la pantalla degrada sin romper para esos kinds.

export type MovementDetailData = {
  transaction: TransactionWithDetails
  movement: FinancialMovement
  installmentParent: TransactionWithDetails | null
  installmentSiblings: TransactionWithDetails[] | null
  reimbursements: ExpenseReimbursementVM[]
  sharedInfo: MovementSharedInfo | null
}

const HERO_ICON: Partial<Record<MovementKind, LucideIcon>> = {
  transfer: ArrowLeftRight,
  exchange: ArrowLeftRight,
  adjustment: Scale,
  card_payment: CreditCard,
  reimbursement: Receipt,
}

export function MovementDetailView({ data }: { data: MovementDetailData }) {
  const { transaction, movement, installmentParent, installmentSiblings, reimbursements, sharedInfo } = data
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const router = useRouter()

  const view = resolveMovementView(toMovementViewInput(movement), { kind: 'global' })

  const isPendingReimbursement = movement.kind === 'reimbursement' && movement.state !== 'received'
  const tone = resolveTone(movement.kind, view.sign, isPendingReimbursement)
  const toneCls = toneClasses(tone)

  // System categories/subcategories render localized; user-owned keep their name.
  const categoryLabel =
    movement.category_is_system && movement.category_canonical_name
      ? t(`categories.${movement.category_canonical_name}`)
      : movement.category_name
  const subcategoryLabel =
    movement.subcategory_is_system && movement.subcategory_canonical_name
      ? t(`subcategories.${movement.subcategory_canonical_name}`)
      : movement.subcategory_name

  const money = (amount: number, currency: 'ARS' | 'USD' = movement.currency_code) =>
    currency === 'ARS' ? formatARS(Math.abs(amount), showCents) : formatUSD(Math.abs(amount), showCents)

  // ── Variant ─────────────────────────────────────────────────────────────────
  const isTransferLike = movement.kind === 'transfer' || movement.kind === 'exchange'
  const isInstallment =
    movement.kind === 'installment_purchase' ||
    (installmentSiblings != null && installmentSiblings.length > 0)
  const hasReimbursements = movement.kind === 'expense' && reimbursements.length > 0
  const isShared = sharedInfo != null && movement.kind === 'expense'
  const isIncome = movement.kind === 'income'

  // ── Hero ──────────────────────────────────────────────────────────────────
  const heroTitle =
    movement.description ?? movement.title ?? categoryLabel ?? t(`transactions.types.${transaction.type}`)

  const FallbackIcon = HERO_ICON[movement.kind] ?? Tag
  const hasEmoji = view.isCategorized && movement.category_icon

  const flowLine = (() => {
    if (isTransferLike) return t('transactions.detail.flow.transfer')
    if (isInstallment)
      return t('transactions.detail.flow.installments', {
        count:
          movement.kind === 'installment_purchase'
            ? movement.installments_total ?? installmentSiblings?.length ?? 0
            : installmentSiblings?.length ?? 0,
      })
    if (isShared) return t('transactions.detail.flow.shared', { count: sharedInfo!.bySplit.length + 1 })
    if (hasReimbursements) return t('transactions.detail.flow.reimbursement')
    if (isIncome) return t('transactions.detail.flow.income')
    if (movement.kind === 'expense') return t('transactions.detail.flow.expense')
    return null
  })()

  // ── Tiles by variant ────────────────────────────────────────────────────────
  const dateRow: DetailRowSpec = {
    key: 'date',
    icon: <Calendar size={16} strokeWidth={2} color={colors.slate} />,
    label: t('transactions.detail.labels.date'),
    value: formatLongDate(movement.date, locale),
  }

  const tiles: ReactNode[] = []

  if (isTransferLike) {
    tiles.push(
      <TileTransferFlow
        key="flow"
        source={transaction.source_account}
        destination={transaction.destination_account}
      />,
      <TileTransferCallout key="callout" />,
    )
    const rows: DetailRowSpec[] = [
      {
        key: 'amount',
        icon: <Banknote size={16} strokeWidth={2} color={colors.slate} />,
        label: t('transactions.labels.amount'),
        value: money(movement.amount),
      },
    ]
    if (movement.kind === 'exchange') {
      rows.push({
        key: 'received',
        icon: <Coins size={16} strokeWidth={2} color={colors.slate} />,
        label: t('transactions.labels.exchange_received'),
        value: (
          <Text className="text-[14.5px] font-bold tabular-nums text-positive">
            +{money(movement.destination_amount, movement.destination_currency)}
          </Text>
        ),
      })
    } else {
      rows.push({
        key: 'status',
        icon: <Check size={16} strokeWidth={2} color={colors.slate} />,
        label: t('transactions.labels.status'),
        value: <StatusDot label={t('transactions.detail.status.completed')} />,
      })
    }
    tiles.push(<TileDetail key="detail" rows={rows} />)
  } else if (isInstallment) {
    const parentAmount = installmentParent?.amount ?? movement.amount
    const siblings = installmentSiblings ?? []
    tiles.push(
      <TileInstallments
        key="cuotas"
        childrenRows={siblings.map((c) => ({
          id: c.id,
          amount: c.amount,
          status: c.status,
          date: c.date,
          installment_n: c.installment_n,
        }))}
        parentAmount={parentAmount}
        currency={movement.currency_code}
        currentN={transaction.installment_n}
        tone={tone}
      />,
      <TilePaymentMethod key="paid" account={transaction.source_account} />,
      <TileDetail
        key="detail"
        rows={[
          {
            key: 'total',
            icon: <Coins size={16} strokeWidth={2} color={colors.slate} />,
            label: t('transactions.card_purchase_total'),
            value: money(parentAmount),
            rightLabel: t('transactions.detail.installments.eyebrow'),
            rightValue:
              siblings.length > 0 ? `${siblings.length} × ${money(siblings[0]!.amount)}` : undefined,
          },
        ]}
      />,
    )
  } else if (hasReimbursements) {
    const received = reimbursements.some((r) => r.state === 'received')
    tiles.push(
      <TileReimbursementNet
        key="net"
        paid={movement.amount}
        currency={movement.currency_code}
        reimbursements={reimbursements}
      />,
      <TilePaymentMethod key="paid" account={transaction.source_account} />,
      <TileDetail
        key="detail"
        rows={[
          {
            key: 'status',
            icon: <Check size={16} strokeWidth={2} color={colors.slate} />,
            label: t('transactions.labels.status'),
            value: received ? (
              <StatusDot label={t('transactions.detail.status.reimbursed')} />
            ) : (
              <Text className="text-[14.5px] font-bold text-text-muted">
                {t('transactions.reimbursement.state.pending')}
              </Text>
            ),
          },
        ]}
      />,
    )
  } else if (isShared) {
    tiles.push(
      <TileShareYours key="yours" shared={sharedInfo!} total={movement.amount} currency={movement.currency_code} tone={tone} />,
      <TilePaymentMethod key="paid" account={transaction.source_account} />,
      <TileDividedAmong key="among" shared={sharedInfo!} currency={movement.currency_code} tone={tone} />,
      <TileDetail
        key="detail"
        rows={[
          {
            key: 'total',
            icon: <Coins size={16} strokeWidth={2} color={colors.slate} />,
            label: t('transactions.labels.amount'),
            value: money(movement.amount),
            rightLabel: t('transactions.detail.shared.your_share'),
            rightValue: money(sharedInfo!.ownShare),
          },
        ]}
      />,
    )
  } else if (isIncome) {
    tiles.push(
      <TilePaymentMethod
        key="paid"
        account={transaction.source_account}
        eyebrow={t('transactions.detail.groups.credited_to')}
      />,
      <TileDetail
        key="detail"
        rows={[
          dateRow,
          {
            key: 'status',
            icon: <Check size={16} strokeWidth={2} color={colors.slate} />,
            label: t('transactions.labels.status'),
            value: <StatusDot label={t('transactions.detail.status.credited')} />,
          },
        ]}
      />,
    )
  } else if (movement.kind === 'reimbursement') {
    tiles.push(
      <TilePaymentMethod key="paid" account={transaction.source_account} />,
      <TileDetail
        key="detail"
        rows={[
          dateRow,
          ...(transaction.linked_expense
            ? [
                {
                  key: 'linked',
                  icon: <Receipt size={16} strokeWidth={2} color={colors.slate} />,
                  label: t('transactions.reimbursement.linked_expense_title'),
                  value: (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/transactions/${transaction.linked_expense!.id}`)}
                    >
                      <Text className="text-[14.5px] font-bold text-slate">
                        {transaction.linked_expense.description ??
                          transaction.linked_expense.category?.name ??
                          t('transactions.types.expense')}
                      </Text>
                    </Pressable>
                  ),
                } satisfies DetailRowSpec,
              ]
            : []),
        ]}
      />,
    )
  } else {
    // generic: expense simple, card_payment, adjustment
    const rows: DetailRowSpec[] = [dateRow]
    if (transaction.fx_rate_to_ars) {
      rows.push({
        key: 'fx',
        icon: <Hash size={16} strokeWidth={2} color={colors.slate} />,
        label: t('transactions.detail.labels.fx_rate'),
        value: t('transactions.fx_rate_template', { rate: transaction.fx_rate_to_ars }),
      })
    }
    tiles.push(
      <TilePaymentMethod key="paid" account={transaction.source_account} />,
      <TileDetail key="detail" rows={rows} />,
    )
  }

  tiles.push(<TileDescription key="desc" description={transaction.description} />)

  const installmentParentId = transaction.parent_id

  return (
    <View className="flex-col gap-3.5">
      {/* Hero */}
      <View className="overflow-hidden rounded-3xl border border-border bg-card">
        <View className={`items-center px-6 pb-7 pt-8 ${toneCls.softBg}`}>
          <View className={`mb-3.5 h-[72px] w-[72px] items-center justify-center rounded-[22px] ${toneCls.softBg}`}>
            {hasEmoji ? (
              <Text className="text-[34px] leading-none">{movement.category_icon}</Text>
            ) : (
              <FallbackIcon size={34} strokeWidth={1.8} color={colors.slate} />
            )}
          </View>

          {isTransferLike && (
            <Text className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.13em] text-slate">
              {t('transactions.detail.transfer.internal')}
            </Text>
          )}

          <Text className="text-center text-[24px] font-extrabold leading-[1.05] text-text">
            {heroTitle}
          </Text>

          <View className="mt-3 flex-row items-baseline">
            <Text className={`text-[46px] font-extrabold leading-none tabular-nums ${toneCls.text}`}>
              {view.sign}
              {money(view.amount, view.currencyCode)}
            </Text>
          </View>
          {view.currencyCode === 'USD' && (
            <Text className="mt-1 text-[13px] font-bold text-text-muted">USD</Text>
          )}

          {flowLine && (
            <Text className="mt-1.5 text-[13.5px] font-semibold text-text-muted">{flowLine}</Text>
          )}
        </View>

        {/* Chips */}
        <View className="flex-row flex-wrap justify-center gap-1.5 border-t border-border px-4 pb-5 pt-4">
          <Chip>
            <Calendar size={14} strokeWidth={2} color={colors.text} />
            <Text className="text-[12.5px] font-bold text-text">{formatShortDate(movement.date, locale)}</Text>
          </Chip>
          {isTransferLike ? (
            <Chip toneClass={{ bg: toneCls.softBg, text: toneCls.text }}>
              <ArrowLeftRight size={14} strokeWidth={2} color={colors.slate} />
              <Text className={`text-[12.5px] font-bold ${toneCls.text}`}>
                {t('transactions.detail.transfer.internal')}
              </Text>
            </Chip>
          ) : (
            <>
              {movement.account_name && (
                <Chip toneClass={{ bg: toneCls.softBg, text: toneCls.text }}>
                  <Wallet size={14} strokeWidth={2} color={colors.slate} />
                  <Text className={`text-[12.5px] font-bold ${toneCls.text}`}>{movement.account_name}</Text>
                </Chip>
              )}
              {categoryLabel && <Chip>{categoryLabel}</Chip>}
              {subcategoryLabel && <Chip>{subcategoryLabel}</Chip>}
            </>
          )}
        </View>
      </View>

      {/* Nota de cuota hija → compra original */}
      {installmentParentId != null && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/transactions/${installmentParentId}`)}
          className="rounded-2xl border border-border bg-card px-4 py-3"
        >
          <Text className="text-[13px] font-medium text-text-muted">
            {t('transactions.detail.installment_child_note')}
          </Text>
          <Text className="mt-1 text-[13px] font-bold text-slate">
            {t('transactions.detail.installment_child_link')} →
          </Text>
        </Pressable>
      )}

      {/* Revisar (review flags) */}
      {movement.review_flags.length > 0 && (
        <View className="flex-row items-start gap-2 rounded-2xl border border-warning-soft bg-warning-bg px-3.5 py-3">
          <AlertTriangle size={16} color={colors.warningDeep} />
          <View className="flex-1">
            <Text className="text-[13.5px] font-bold text-warning-deep">
              {t('transactions.review_alert_title')}
            </Text>
            <Text className="text-[13px] font-medium text-warning-deep">
              {movement.review_flags
                .map((flag) => t(`transactions.review_flags.${flag}`))
                .join(' · ')}
            </Text>
          </View>
        </View>
      )}

      {tiles}
    </View>
  )
}
