import { Pressable, Text, View } from 'react-native'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  Coins,
  CreditCard,
  Scale,
  Tag,
  Users,
} from 'lucide-react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  resolveMovementView,
  type MovementKind,
  type MovementPerspective,
} from '@grana/money-logic'
import {
  resolveTone,
  toMovementViewInput,
  type FinancialMovement,
  type ReimbursementState,
} from '@grana/transactions'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { toneToClass } from './tone'

/** Lucide icon for the "structure" family (movements with no category). */
const structureIcon: Partial<Record<MovementKind, typeof Tag>> = {
  transfer: ArrowLeftRight,
  exchange: Coins,
  adjustment: Scale,
  card_payment: CreditCard,
}

/** Fallback icon for categorized movements without a category emoji. */
const categorizedFallbackIcon: Partial<Record<MovementKind, typeof Tag>> = {
  income: ArrowDownLeft,
  expense: Tag,
  installment_purchase: CreditCard,
  reimbursement: ArrowDownLeft,
}

const typeLabelKey: Record<MovementKind, string> = {
  income: 'transactions.types.income',
  expense: 'transactions.types.expense',
  transfer: 'transactions.types.transfer',
  adjustment: 'transactions.types.adjustment',
  exchange: 'transactions.types.exchange',
  card_payment: 'transactions.card_payment_label',
  installment_purchase: 'transactions.installment_purchase_label',
  reimbursement: 'transactions.reimbursement.label',
}

const formatAmount = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

// Reimbursement state → [container bg, text color] classes for the state pill.
const reimbursementBadgeCls: Record<ReimbursementState, { bg: string; text: string }> = {
  received: { bg: 'bg-emerald-soft', text: 'text-emerald-deep' },
  pending: { bg: 'bg-warning-soft', text: 'text-warning-deep' },
  cancelled: { bg: 'bg-border-soft', text: 'text-text-muted line-through' },
}

// Account display: institution leads, the account's own name is the fallback
// (cash/wallet accounts have no institution).
const accountLabel = (name: string | null, institutionName: string | null | undefined): string =>
  institutionName?.trim() || name || '?'

type Props = {
  movement: FinancialMovement
  perspective: MovementPerspective
  /** Installment chip label (e.g. "Cuota 2 de 6"); rendered below the subtitle (card statement). */
  installmentChip?: string | null
  /** Show the owning account in the subtitle — the global feed spans accounts. */
  showAccount?: boolean
  /** Show the feed-only badges ("Revisar" for review flags, "Compartido" for shared). */
  showFeedBadges?: boolean
  /** Navigate to the movement detail on tap. Absent ⇒ the row renders flat
   *  (non-navigable) — the account/card panes keep their inert rows. */
  onPress?: () => void
}

/**
 * Native movement row — mirror of the web `MovementRow` (same name + public
 * props), RN-idiomatic. Handles all 8 movement kinds: amount/sign/currency come
 * from `resolveMovementView` + `resolveTone` (shared with web). The feed-only
 * enrichments (`showAccount`, `showFeedBadges`) are opt-in and off by default, so
 * the card statement pane — which passes neither — renders its lean 2-kind look
 * unchanged. Navigable when the caller passes `onPress` (the global feed opens
 * the movement detail); flat otherwise (account/card panes); no running balance.
 */
export function MovementRow({
  movement,
  perspective,
  installmentChip = null,
  showAccount = false,
  showFeedBadges = false,
  onPress,
}: Props) {
  const t = useT()
  const showCents = useShowCents()

  const view = resolveMovementView(toMovementViewInput(movement), perspective)
  const typeLabel = t(typeLabelKey[movement.kind])

  // System categories/subcategories render localized; user-owned keep their name.
  const categoryLabel =
    movement.category_is_system && movement.category_canonical_name
      ? t(`categories.${movement.category_canonical_name}`)
      : movement.category_name
  const subcategoryLabel =
    movement.subcategory_is_system && movement.subcategory_canonical_name
      ? t(`subcategories.${movement.subcategory_canonical_name}`)
      : movement.subcategory_name

  // Installment purchases carry their cuotas count as an inline chip so the list
  // says "en cuotas"; card-statement children get "Cuota X de Y" below instead.
  const inlineChip =
    movement.kind === 'installment_purchase' && movement.installments_total
      ? t('transactions.installments_count', { count: movement.installments_total })
      : null

  const isPendingReimbursement =
    movement.kind === 'reimbursement' && movement.state !== 'received'

  // Primary line: what the user wrote; falls back to the category or type name.
  // Adjustments carry a meaningful title (real "Ajuste", or a settlement label),
  // so prefer it over the generic type label.
  const fallbackLabel = view.isCategorized ? categoryLabel ?? typeLabel : typeLabel
  const primary =
    movement.description ?? (movement.kind === 'adjustment' ? movement.title : fallbackLabel)

  // Secondary line depends on the family.
  const secondary = ((): string | null => {
    if (movement.kind === 'transfer' || movement.kind === 'exchange') {
      const sourceLabel = accountLabel(movement.account_name, movement.account_institution_name)
      const destLabel = accountLabel(
        movement.destination_account_name,
        movement.destination_account_institution_name,
      )
      if (view.counterpartyDirection === 'in') return `← ${sourceLabel}`
      if (view.counterpartyDirection === 'out' && perspective.kind === 'account') {
        return `→ ${destLabel}`
      }
      return `${sourceLabel} → ${destLabel}`
    }
    if (movement.kind === 'card_payment') {
      return movement.account_name
        ? t('transactions.list.card_payment_from', {
            accountName: accountLabel(movement.account_name, movement.account_institution_name),
          })
        : null
    }
    // Categorized line. The category only repeats here when the description
    // already takes the primary slot; otherwise it's already the primary and
    // the secondary leads with the subcategory (when set).
    const taxonomy = movement.description
      ? subcategoryLabel
        ? `${categoryLabel} › ${subcategoryLabel}`
        : categoryLabel
      : subcategoryLabel
    const parts: string[] = []
    if (taxonomy) parts.push(taxonomy)
    if (showAccount && movement.account_name) {
      parts.push(accountLabel(movement.account_name, movement.account_institution_name))
    }
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  const toneClass = toneToClass(resolveTone(movement.kind, view.sign, isPendingReimbursement))

  const hasEmoji = view.isCategorized && movement.category_icon
  const FallbackIcon =
    structureIcon[movement.kind] ?? categorizedFallbackIcon[movement.kind] ?? Tag

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="flex-row items-center gap-2.5 px-4 py-3"
    >
      {hasEmoji ? (
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${movement.category_color ?? colors.textMuted}1A` }}
        >
          <Text className="text-base">{movement.category_icon}</Text>
        </View>
      ) : (
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-border-soft">
          <FallbackIcon size={17} color={colors.textMuted} />
        </View>
      )}

      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text numberOfLines={1} className="text-[13px] font-extrabold text-text">
            {primary}
          </Text>
          {inlineChip && (
            <View className="rounded-full bg-border-soft px-1.5 py-0.5">
              <Text className="text-[11px] font-semibold text-text-muted">{inlineChip}</Text>
            </View>
          )}
          {showFeedBadges && movement.review_flags.length > 0 && (
            <View className="flex-row items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5">
              <AlertTriangle size={11} color={colors.warningDeep} />
              <Text className="text-[11px] font-medium text-warning-deep">
                {t('transactions.list.review_short')}
              </Text>
            </View>
          )}
          {showFeedBadges && movement.isShared && (
            <View className="flex-row items-center gap-1 rounded-full bg-border-soft px-1.5 py-0.5">
              <Users size={10} color={colors.textMuted} />
              <Text className="text-[11px] font-semibold text-text-muted">
                {t('transactions.list.shared_short')}
              </Text>
            </View>
          )}
          {movement.kind === 'reimbursement' && (
            <View className={`rounded-md px-1.5 py-0.5 ${reimbursementBadgeCls[movement.state].bg}`}>
              <Text
                className={`text-[11px] font-medium ${reimbursementBadgeCls[movement.state].text}`}
              >
                {t(`transactions.reimbursement.state.${movement.state}`)}
              </Text>
            </View>
          )}
        </View>
        {secondary && (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-text-muted">
            {secondary}
          </Text>
        )}
        {installmentChip && (
          <View className="mt-1.5 self-start rounded-full bg-border-soft px-2 py-0.5">
            <Text className="text-[11px] font-bold text-text-muted">{installmentChip}</Text>
          </View>
        )}
      </View>

      <View className="items-end">
        <Text className={`text-[14px] font-extrabold tabular-nums ${toneClass}`}>
          {view.sign}
          {formatAmount(view.amount, view.currencyCode, showCents)}
        </Text>
        {view.currencyCode === 'USD' && <Text className="text-[11px] text-text-muted">USD</Text>}
      </View>
    </Pressable>
  )
}
