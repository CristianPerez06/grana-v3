import { Text, View } from 'react-native'
import { ArrowDownLeft, Tag } from 'lucide-react-native'
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

// Fallback icon per kind when the movement has no category emoji. The card
// statement only produces `expense` (consumos / cuotas children) and
// `reimbursement` (reintegros recibidos), so those are the only two the row
// handles — the other 6 kinds never reach it.
const fallbackIcon: Partial<Record<MovementKind, typeof Tag>> = {
  expense: Tag,
  reimbursement: ArrowDownLeft,
}

const typeLabelKey: Partial<Record<MovementKind, string>> = {
  expense: 'transactions.types.expense',
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

type Props = {
  movement: FinancialMovement
  perspective: MovementPerspective
  /** Installment chip label (e.g. "Cuota 2 de 6"); rendered below the subtitle. */
  installmentChip?: string | null
}

/**
 * Native movement row, scoped to the card statement's kinds (`expense` /
 * `reimbursement`). Mirror of the web `MovementRow` (same name + public props),
 * RN-idiomatic. Derives amount/sign/currency via `resolveMovementView` +
 * `resolveTone` (shared with web). Omits the running balance, the recurrent/
 * review/shared badges, the account subtitle and the other 6 kinds — the card
 * mapper never produces them. Non-navigable (the caller renders it flat).
 */
export function MovementRow({ movement, perspective, installmentChip = null }: Props) {
  const t = useT()
  const showCents = useShowCents()

  const view = resolveMovementView(toMovementViewInput(movement), perspective)
  const typeLabel = t(typeLabelKey[movement.kind] ?? 'transactions.types.expense')

  // System categories/subcategories render localized; user-owned keep their name.
  const categoryLabel =
    movement.category_is_system && movement.category_canonical_name
      ? t(`categories.${movement.category_canonical_name}`)
      : movement.category_name
  const subcategoryLabel =
    movement.subcategory_is_system && movement.subcategory_canonical_name
      ? t(`subcategories.${movement.subcategory_canonical_name}`)
      : movement.subcategory_name

  const isPendingReimbursement =
    movement.kind === 'reimbursement' && movement.state !== 'received'

  // Primary line: what the user wrote; falls back to the category or type name.
  const fallbackLabel = view.isCategorized ? categoryLabel ?? typeLabel : typeLabel
  const primary = movement.description ?? fallbackLabel

  // Secondary line (taxonomy). When the description already takes the primary
  // slot, lead with "categoría › subcategoría"; otherwise the category is the
  // primary and the secondary leads with the subcategory (when set).
  const secondary = movement.description
    ? subcategoryLabel
      ? `${categoryLabel} › ${subcategoryLabel}`
      : categoryLabel
    : subcategoryLabel

  const toneClass = toneToClass(resolveTone(movement.kind, view.sign, isPendingReimbursement))

  const hasEmoji = view.isCategorized && movement.category_icon
  const FallbackIcon = fallbackIcon[movement.kind] ?? Tag

  return (
    <View className="flex-row items-center gap-2.5 px-4 py-3">
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
    </View>
  )
}
