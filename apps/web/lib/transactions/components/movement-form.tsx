'use client'

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { invalidateAfterMovementMutation } from '@/lib/transactions/invalidation'
import { CoachmarkTour, type CoachmarkStep } from '@/components/ui/coachmark-tour'
import { GUIDANCE_IDS } from '@/lib/guidance/catalog'
import { useGuidance } from '@/lib/guidance/hooks'
import {
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Repeat,
  Scale,
  Tag,
  Undo2,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Popover } from '@/components/ui/popover'
import {
  createIncome,
  createExpense,
  createTransfer,
  createAdjustment,
  createExchange,
  updateTransaction,
  updateTransfer,
  updateAdjustment,
  updateExchange,
} from '@/app/_actions/transactions'
import {
  registerCardPurchase,
  registerInstallments,
  updateInstallmentParent,
} from '@/app/_actions/credit-cards'
import { createRecurrenceFromMovement } from '@/app/_actions/recurrences'
import { suggestCategoryFromHistory } from '@/app/_actions/category-suggestion'
import { Money, parseMoneyInput } from '@grana/validation'
import {
  formatDateISO,
  getTodayAR,
  type MovementType,
} from '@grana/money-logic'
import {
  useMovementForm,
  type MovementEditContext as PackageMovementEditContext,
  type MovementFormAccount as PackageMovementFormAccount,
  type Mutators,
  type Tab,
} from '@grana/movement-form'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { CategorySuggestionChip } from '@/lib/transactions/components/category-suggestion-chip'
import { CategorySuggestionHint } from '@/lib/transactions/components/category-suggestion-hint'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { getCategoryName, getSubcategoryName } from '@/lib/categories/display'
import type { Household } from '@/lib/shared/types'

const todayStr = (): string => formatDateISO(getTodayAR())

export type MovementFormAccount = PackageMovementFormAccount

/**
 * Edit context built by the server page from an existing transaction. Wraps
 * the cross-platform `MovementEditContext` with web-specific `returnHref` —
 * the navigation target used after a successful save from the edit *page*
 * (the edit drawer ignores it and uses `onSuccess` to close itself).
 */
export type MovementEditContext = PackageMovementEditContext & {
  returnHref: string
}

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  /** Edit mode when present. Absent ⇒ create mode. */
  edit?: MovementEditContext
  /** Create mode: pre-select this account (e.g. arriving from a card/account). */
  preselectAccountId?: string
  /**
   * When provided, the form is hosted in a drawer: after a successful save it
   * refreshes the route and calls `onSuccess` (to close the drawer) instead of
   * navigating to `edit.returnHref`. Required in create mode (the drawer is
   * the only host for creates); optional in edit mode (provided by the edit
   * drawer, omitted by the standalone `/edit` route which keeps navigating).
   */
  onSuccess?: () => void
  /**
   * Presentation chrome. `'drawer'` renders the hi-fi shell (fixed header with
   * eyebrow/title/close + scroll body + fixed footer CTA). `'page'` (default)
   * renders the same body inline for the standalone `/transactions/[txId]/edit`
   * route, where the page already provides its own header. The `'page'`
   * variant is edit-only — the create flow always renders inside the drawer.
   */
  variant?: 'page' | 'drawer'
  /** Drawer chrome: close handler for the header ✕ and footer cancel paths. */
  onClose?: () => void
  /** The user's household when it has two members — enables the "Compartir" toggle. */
  household?: Household | null
  /** Show inline guides for first-time users (no prior transactions). */
  showFirstMovementGuidance?: boolean
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24]

// Field-bg literal: the canonical drawer field surface (#FAFBFC sits between
// white card and the page bg; no token maps to it exactly — see HANDOFF tokens).
const FIELD_BG = '#FAFBFC'
const ROW_HOVER = '#FBFCFD'
const ROW_DIVIDER = '#F1F3F6'

const fmtBalance = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// One clickable row inside a field-group card: icon chip + label/value stack +
// optional trailing node + chevron affordance. Used as a Popover trigger, so it
// forwards the ref/props Radix injects.
type RowProps = {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: ReactNode
  trailing?: ReactNode
  disabled?: boolean
}
// Omit the native button `value` attr so our richer `value: ReactNode` wins.
const FieldRow = forwardRef<HTMLButtonElement, RowProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'>>(
  ({ icon, label, value, hint, trailing, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-[var(--row-hover)] disabled:cursor-default"
      style={{ '--row-hover': ROW_HOVER } as React.CSSProperties}
      {...rest}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
        style={{ backgroundColor: FIELD_BG }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">{label}</span>
        <span className="truncate text-[15px] font-semibold leading-snug text-text">{value}</span>
        {hint && <span className="text-xs leading-snug text-text-muted">{hint}</span>}
      </span>
      {trailing}
      {!disabled && (
        <ChevronRight className="size-4 shrink-0 text-text-soft/60" aria-hidden />
      )}
    </button>
  ),
)
FieldRow.displayName = 'FieldRow'

// Avatar + name (+ credit badge) + balance, used as the value of an account row
// and the rows inside the account popover.
const AccountValue = ({ account }: { account: MovementFormAccount | undefined }) => {
  if (!account) return <span className="text-text-soft">—</span>
  const avatar: ResolvedAccountAvatar = account.avatar ?? {
    colorKey: null,
    colorOverride: null,
    iconKey: account.type === 'credit' ? 'credit-card' : 'wallet',
    monogram: account.name.charAt(0).toUpperCase(),
  }
  return (
    <span className="flex items-center gap-2">
      <AccountAvatar {...avatar} size="sm" />
      <span className="truncate text-text">{account.name}</span>
    </span>
  )
}

export const MovementForm = ({
  accounts,
  categories,
  edit,
  preselectAccountId,
  onSuccess,
  variant = 'page',
  onClose,
  household,
  showFirstMovementGuidance = false,
}: Props) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const tRec = useTranslations('recurrences')
  const tShared = useTranslations('shared')
  const tTour = useTranslations('guidance.first_movement_tour')
  const tRoot = useTranslations()
  const isEdit = edit !== undefined
  const editable = edit?.editableFields

  const TAB_LABELS: Record<Tab, string> = {
    income: t('tabs.income'),
    expense: t('tabs.expense'),
    transfer: t('tabs.transfer'),
    adjustment: t('tabs.adjustment'),
    exchange: t('tabs.exchange'),
  }
  const TYPE_LABELS: Record<MovementType, string> = {
    income: t('types.income'),
    expense: t('types.expense'),
    transfer: t('types.transfer'),
    adjustment: t('types.adjustment'),
    exchange: t('types.exchange'),
  }
  // UI-only state owned by the form (popover open, drill, refs, autofocus).
  // All form domain state + cascades + submit dispatcher live in the hook.
  const isDrawer = variant === 'drawer'
  const [activePopover, setActivePopover] = useState<string | null>(null)
  const [catDrill, setCatDrill] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // First-movement guided tour (spotlight). Only the drawer create flow for a
  // user with no prior movements; persists completion/skip so it shows once.
  const tour = useGuidance(GUIDANCE_IDS.FIRST_MOVEMENT_TOUR)

  // Edit-only: where the form navigates after a successful page-mode save.
  // Drawer mode never reads this (uses `onSuccess` instead).
  const returnHref = edit?.returnHref ?? '/transactions'

  // Strip the web-only `returnHref` before handing the edit context to the hook
  // (the hook is cross-platform and routing belongs to the caller).
  const editForHook = edit
    ? ((): PackageMovementEditContext => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { returnHref: _ignored, ...rest } = edit
        return rest
      })()
    : undefined

  // Mutator bindings: server actions are directly assignable to the hook's
  // `Mutators` interface — same shape (input → ActionResult<T>).
  const mutators: Mutators = {
    createIncome,
    createExpense,
    createTransfer,
    createAdjustment,
    createExchange,
    updateTransaction,
    updateTransfer,
    updateAdjustment,
    updateExchange,
    updateInstallmentParent,
    registerCardPurchase,
    registerInstallments,
    createRecurrenceFromMovement,
    suggestCategoryFromHistory,
  }

  const form = useMovementForm({
    mutators,
    accounts,
    categories,
    edit: editForHook,
    preselectAccountId,
    household,
    today: getTodayAR(),
    translate: (key, values) =>
      values ? t(key, values as Record<string, string | number>) : t(key),
    onMutationSuccess: () => {
      invalidateAfterMovementMutation(queryClient)
      router.refresh()
    },
    onSuccess: () => {
      if (onSuccess) onSuccess()
      else router.push(returnHref)
    },
  })

  const {
    tab,
    accountId,
    currencyCode,
    amount,
    date,
    description,
    categoryId,
    subcategoryId,
    destinationAccountId,
    destinationAmount,
    adjustmentDirection,
    installments,
    isRecurrent,
    frequency,
    intervalCount,
    intervalUnit,
    recurrenceEndDate,
    reimbursementEnabled,
    reimbursementTarget,
    reimbursementAmount,
    reimbursementReceivedNow,
    reimbursementPercent,
    reimbursementCap,
    reimbursementAccountId,
    sharedEnabled,
    splitFirstPct,
    suggestion,
    descriptionHasNoHistory,
    setTab,
    setAccountId,
    setCurrencyCode,
    setAmount,
    setDate,
    setDescription,
    setSuggestion,
    setDescriptionHasNoHistory,
    setDestinationAccountId,
    setDestinationAmount,
    setAdjustmentDirection,
    setInstallments,
    setIsRecurrent,
    setFrequency,
    setIntervalCount,
    setIntervalUnit,
    setRecurrenceEndDate,
    setReimbursementEnabled,
    setReimbursementTarget,
    setReimbursementAmount,
    setReimbursementReceivedNow,
    setReimbursementPercent,
    setReimbursementCap,
    setReimbursementAccountId,
    setSharedEnabled,
    setSplitFirstPct,
    isInstallments,
    eligibleAccounts,
    selectedAccount,
    cashBankAccounts,
    otherAccounts,
    destinationAccount,
    exchangeDestAccount,
    exchangeDestCurrency,
    effectiveCurrency,
    currencyOptions,
    negativeWarning,
    isSubmitting: isPending,
    formError,
    onSubmit: hookSubmit,
    swapAccounts,
    pickCategory: hookPickCategory,
    applyReimbursementPercent,
    applySuggestion,
    fetchSuggestionForDescription,
  } = form
  const cashBank = cashBankAccounts
  // Categories are projected locally to keep the rich web type (icon, color,
  // canonical_name, is_system) — the hook only narrows to id+type.
  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  const isCredit = selectedAccount?.type === 'credit'
  const sharedMembers =
    household && household.members.length === 2 ? household.members : null

  // Autofocus the amount after the drawer slide-in settles (≈360ms), matching
  // the prototype. On the page variant focus lands immediately.
  useEffect(() => {
    if (amount !== '' && edit !== undefined) return
    const delay = isDrawer ? 360 : 0
    const id = setTimeout(() => amountRef.current?.focus(), delay)
    return () => clearTimeout(id)
    // Run once per mount (the drawer remounts the form on each open via `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (accounts.length === 0 && edit === undefined) {
    return (
      <p className="text-sm text-muted-foreground">{t('empty.no_accounts')}</p>
    )
  }

  // UI wrapper: hook owns category state; UI owns drill + popover.
  const pickCategory = (catId: string, subId: string) => {
    hookPickCategory(catId, subId)
    setCatDrill(null)
    setActivePopover(null)
  }

  // UI wrapper: blur handler that triggers the hook's suggestion fetch.
  const handleDescriptionBlur = () => {
    void fetchSuggestionForDescription()
  }

  // Default the credit-to account to the same-institution cash/bank.
  // Mirrored from `useMovementForm` for the UI-side toggle-on path.
  const pickReimbursementAccount = (expenseAccountId: string): string => {
    const expenseAccount = accounts.find((a) => a.id === expenseAccountId)
    const inst = expenseAccount?.institutionId ?? null
    const banks = accounts.filter((a) => a.type !== 'credit')
    const match = inst ? banks.find((a) => a.institutionId === inst) : undefined
    return match?.id ?? banks[0]?.id ?? ''
  }


  // Read-only context rows shown in edit mode (immutable fields).
  const contextRows: Array<{ label: string; value: string }> = isEdit && edit
    ? [
        {
          label: t('labels.type'),
          value: edit.isParent ? t('installment_purchase_label') : TYPE_LABELS[edit.type],
        },
        { label: t('labels.currency'), value: edit.currencyCode },
        ...(edit.isParent && edit.installmentsTotal
          ? [{ label: t('labels.installments'), value: t('installments_count', { count: edit.installmentsTotal }) }]
          : []),
        ...(edit.type === 'transfer' || edit.type === 'exchange'
          ? [
              { label: t('labels.source_account'), value: edit.sourceAccountName ?? edit.accountId },
              { label: t('labels.destination_account'), value: edit.destinationAccountName ?? '—' },
            ]
          : edit.sourceAccountName
            ? [{ label: t('labels.account'), value: edit.sourceAccountName }]
            : []),
      ]
    : []

  const formatBalance = (account: MovementFormAccount): string =>
    account.activeCurrencies
      .map((c) => `${CURRENCY_SYMBOL[c]}${account.balances[c].toLocaleString('es-AR')}`)
      .join(' · ')

  // ── Derived presentation values + handlers for the hi-fi shell ──────────────

  const eyebrow = isEdit ? t('drawer.eyebrow_edit') : t('drawer.eyebrow_new')
  const title = isEdit ? t('edit_title') : t('actions.register_movement')

  // Amount tint + leading sign by type.
  const amountColor = tab === 'income' ? 'text-emerald-deep' : 'text-text'
  const signChar =
    tab === 'income'
      ? '+'
      : tab === 'expense'
        ? '−'
        : tab === 'adjustment'
          ? adjustmentDirection === 'decrease' ? '−' : '+'
          : ''

  const ctaLabel = isPending
    ? tCommon('saving')
    : isEdit
      ? tCommon('save_changes')
      : isInstallments
        ? t('actions.register_installments', { count: parseInt(installments) })
        : t(`drawer.cta.${tab}`)

  // Account row label by type (HANDOFF: Desde / A la cuenta / Cuenta a ajustar).
  const accountLabel =
    tab === 'income'
      ? t('drawer.account_to')
      : tab === 'adjustment'
        ? t('drawer.account_to_adjust')
        : t('drawer.account_from')

  const avatarOf = (a: MovementFormAccount): ResolvedAccountAvatar =>
    a.avatar ?? {
      colorKey: null,
      colorOverride: null,
      iconKey: a.type === 'credit' ? 'credit-card' : 'wallet',
      monogram: a.name.charAt(0).toUpperCase(),
    }

  const selectedSubcategory =
    selectedCategory?.subcategories.find((s) => s.id === subcategoryId) ?? null
  const subcategoryName = selectedSubcategory
    ? getSubcategoryName(selectedSubcategory, tRoot)
    : null

  const handleSwap = () => swapAccounts()

  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    const idx = currencyOptions.indexOf(effectiveCurrency)
    const next = currencyOptions[(idx + 1) % currencyOptions.length]
    setCurrencyCode(next)
    setInstallments('1')
  }

  // ⌘/Ctrl+Enter submits from anywhere in the form.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const formatDateValue = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    const label = new Date(y, m - 1, day).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    return d === todayStr() ? `${t('drawer.today')} · ${label}` : label
  }

  // Adjustment balance preview (create only — edit lacks the live balance set).
  const adjustmentPreview = (() => {
    if (isEdit || tab !== 'adjustment' || !selectedAccount) return null
    const parsed = parseMoneyInput(amount)
    const current = selectedAccount.balances[currencyCode] ?? 0
    if (parsed === null) return { current, next: current }
    const next =
      adjustmentDirection === 'decrease'
        ? Money.toNumber(Money.subtract(Money.from(current), Money.from(parsed)))
        : Money.toNumber(Money.add(Money.from(current), Money.from(parsed)))
    return { current, next }
  })()

  // Per-installment breakdown for the cuotas card.
  const perInstallment = (() => {
    if (!isInstallments) return null
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null
    return Money.toNumber(Money.divide(Money.from(parsed), parseInt(installments)))
  })()

  // Account picker list content (origin / destination / exchange destination).
  const renderAccountPicker = (
    list: MovementFormAccount[],
    selectedId: string,
    onPick: (id: string) => void,
  ) => (
    <div className="flex flex-col gap-0.5">
      {list.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a.id)}
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
        >
          <AccountAvatar {...avatarOf(a)} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
              {a.name}
              {a.type === 'credit' && (
                <span className="rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta" style={{ backgroundColor: 'var(--terracotta-soft)' }}>
                  {t('drawer.credit_badge')}
                </span>
              )}
            </span>
            {a.type !== 'credit' && (
              <span className="text-xs tabular-nums text-text-muted">{formatBalance(a)}</span>
            )}
          </span>
          {selectedId === a.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
        </button>
      ))}
    </div>
  )

  // Category picker with one level of subcategory drill.
  const drillCategory = catDrill
    ? transactionCategories.find((c) => c.id === catDrill) ?? null
    : null
  const categoryPickerContent = drillCategory ? (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setCatDrill(null)}
        className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-text-muted transition-colors hover:bg-page"
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span>
          {drillCategory.icon ? `${drillCategory.icon} ` : ''}
          {getCategoryName(drillCategory, tRoot)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => pickCategory(drillCategory.id, '')}
        className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
      >
        <span className="flex-1 text-sm font-medium text-text">{t('drawer.whole_category')}</span>
        {categoryId === drillCategory.id && !subcategoryId && (
          <Check className="size-4 shrink-0 text-emerald" aria-hidden />
        )}
      </button>
      {drillCategory.subcategories.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => pickCategory(drillCategory.id, s.id)}
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
        >
          <span className="flex-1 truncate text-sm text-text">{getSubcategoryName(s, tRoot)}</span>
          {subcategoryId === s.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-0.5">
      {transactionCategories.map((c) => {
        const drillable = c.subcategories.length > 0
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => (drillable ? setCatDrill(c.id) : pickCategory(c.id, ''))}
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
          >
            <span className="flex-1 truncate text-sm font-medium text-text">
              {c.icon ? `${c.icon} ` : ''}
              {getCategoryName(c, tRoot)}
            </span>
            {drillable ? (
              <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
            ) : (
              categoryId === c.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )

  const categoryValue = selectedCategory ? (
    <span className="flex items-center gap-1.5">
      <span className="truncate">
        {selectedCategory.icon ? `${selectedCategory.icon} ` : ''}
        {getCategoryName(selectedCategory, tRoot)}
      </span>
      {subcategoryName && (
        <>
          <span className="text-text-soft">{'›'}</span>
          <span className="truncate text-text-muted">{subcategoryName}</span>
        </>
      )}
    </span>
  ) : (
    <span className="text-text-soft">{t('placeholders.category')}</span>
  )

  // ── Type selector (Segmented). Disabled in edit: type is immutable. ─────────
  const typeSelector = (
    <div className="flex flex-col gap-2">
      <Segmented
        ariaLabel={t('labels.type')}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        options={(['expense', 'income', 'transfer', 'adjustment', 'exchange'] as Tab[]).map((k) => ({
          value: k,
          label: TAB_LABELS[k],
          disabled: isEdit,
        }))}
      />
    </div>
  )

  // ── Amount hero ─────────────────────────────────────────────────────────────
  const showAmountHero = isEdit ? editable?.amount : true
  const hero = showAmountHero ? (
    <div
      data-tour="amount"
      className="rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
          {t('labels.amount')}
        </span>
        <button
          type="button"
          onClick={cycleCurrency}
          disabled={currencyOptions.length < 2}
          className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
          style={{ backgroundColor: FIELD_BG }}
        >
          {effectiveCurrency}
          {currencyOptions.length > 1 && <ChevronDown className="size-3" aria-hidden />}
        </button>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        {signChar && (
          <span className={`text-[46px] font-bold leading-none ${amountColor}`}>{signChar}</span>
        )}
        <span className={`text-[27px] font-semibold leading-none opacity-50 ${amountColor}`}>
          {CURRENCY_SYMBOL[effectiveCurrency]}
        </span>
        <MoneyAmountInput
          ref={amountRef}
          id="amount"
          required
          value={amount}
          onChange={setAmount}
          placeholder="0"
          className={`w-full min-w-0 bg-transparent text-[46px] font-bold leading-none tracking-[-0.045em] tabular-nums outline-none placeholder:text-text-soft/40 ${amountColor}`}
        />
      </div>
      {tab === 'income' && (
        <p className="mt-2.5 text-[12.5px] font-medium text-emerald-deep">{t('drawer.helper_income')}</p>
      )}
      {tab === 'adjustment' && (
        <p className="mt-2.5 text-[12.5px] text-text-muted">{t('drawer.helper_adjustment')}</p>
      )}
      {isEdit && edit?.isParent && (
        <p className="mt-2 text-xs text-text-muted">
          {t('installment_recalc_hint', { count: edit.installmentsTotal ?? 0 })}
        </p>
      )}
      {negativeWarning && (
        <div className="mt-3">
          <NegativeBalanceNotice projected={negativeWarning.projected} currency={negativeWarning.currency} />
        </div>
      )}
    </div>
  ) : null

  // ── Adjustment sign toggle + banner ─────────────────────────────────────────
  const showAdjustmentControls = isEdit ? !!editable?.adjustmentDirection : tab === 'adjustment'
  const adjustmentSign = showAdjustmentControls ? (
    <div className="grid grid-cols-2 gap-2">
      {(['increase', 'decrease'] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => setAdjustmentDirection(dir)}
          className={`rounded-[11px] border px-3 py-2.5 text-sm font-bold transition-colors ${
            adjustmentDirection === dir
              ? 'border-transparent bg-navy text-white'
              : 'border-border bg-card text-text-muted hover:text-text'
          }`}
        >
          {dir === 'increase' ? `${t('directions.increase')} (+)` : `${t('directions.decrease')} (−)`}
        </button>
      ))}
    </div>
  ) : null

  const adjustmentBanner = (isEdit ? edit?.type === 'adjustment' : tab === 'adjustment') ? (
    <div
      className="flex items-start gap-2.5 rounded-[13px] border px-3.5 py-3 text-[13px] leading-snug"
      style={{
        borderColor: 'rgba(196,154,60,0.35)',
        backgroundColor: 'var(--warning-bg)',
        color: 'var(--warning-deep)',
      }}
    >
      <Scale className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-bold">{t('drawer.adjust_banner_title')}</strong>{' '}
        {t('drawer.adjust_banner_body')}
      </span>
    </div>
  ) : null

  // ── Field group (clickable rows → popovers) ─────────────────────────────────
  const dateContent = (
    <div className="flex w-[252px] flex-col gap-2 p-1">
      <button
        type="button"
        onClick={() => {
          setDate(todayStr())
          setActivePopover(null)
        }}
        className="flex items-center justify-between rounded-[10px] px-2.5 py-2 text-sm font-semibold text-text transition-colors hover:bg-page"
      >
        {t('drawer.today')}
        {date === todayStr() && <Check className="size-4 text-emerald" aria-hidden />}
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )

  const categoryRow = (
    <Popover
      open={activePopover === 'category'}
      onOpenChange={(o) => {
        setActivePopover(o ? 'category' : null)
        if (!o) setCatDrill(null)
      }}
      trigger={
        <FieldRow icon={<Tag className="size-[18px]" />} label={t('labels.category')} value={categoryValue} />
      }
    >
      {categoryPickerContent}
    </Popover>
  )

  const dateRow = (
    <Popover
      open={activePopover === 'date'}
      onOpenChange={(o) => setActivePopover(o ? 'date' : null)}
      trigger={
        <FieldRow icon={<Calendar className="size-[18px]" />} label={t('labels.date')} value={formatDateValue(date)} />
      }
    >
      {dateContent}
    </Popover>
  )

  const fieldGroup = (
    <div className="overflow-hidden rounded-[15px] border border-border bg-card [&>*+*]:border-t [&>*+*]:border-[#F1F3F6]">
      {isEdit ? (
        <>
          {contextRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">{row.label}</span>
              <span className="truncate text-right text-[15px] font-semibold text-text">
                {row.value}
                <span className="ml-1.5 text-xs font-normal text-text-muted">{tCommon('not_editable')}</span>
              </span>
            </div>
          ))}
          {editable?.category && categoryRow}
          {editable?.date && dateRow}
        </>
      ) : (
        <>
          {/* Source account (+ swap for transfer) */}
          <div className="relative" data-tour="account">
            <Popover
              open={activePopover === 'account'}
              onOpenChange={(o) => setActivePopover(o ? 'account' : null)}
              trigger={
                <FieldRow
                  icon={isCredit ? <CreditCard className="size-[18px]" /> : <Wallet className="size-[18px]" />}
                  label={accountLabel}
                  value={<AccountValue account={selectedAccount} />}
                  hint={isCredit && tab === 'expense' ? t('drawer.credit_hint') : undefined}
                />
              }
            >
              {renderAccountPicker(eligibleAccounts, accountId, (id) => {
                setAccountId(id)
                setActivePopover(null)
              })}
            </Popover>
            {tab === 'transfer' && (
              <button
                type="button"
                onClick={handleSwap}
                aria-label={t('drawer.swap')}
                className="absolute bottom-0 right-4 z-10 flex size-8 translate-y-1/2 items-center justify-center rounded-full bg-navy text-white shadow-md transition-transform hover:rotate-180"
              >
                <ArrowLeftRight className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {/* Destination (transfer / exchange) */}
          {(tab === 'transfer' || tab === 'exchange') && (
            <Popover
              open={activePopover === 'destination'}
              onOpenChange={(o) => setActivePopover(o ? 'destination' : null)}
              trigger={
                <FieldRow
                  icon={<Wallet className="size-[18px]" />}
                  label={t('drawer.account_toward')}
                  value={<AccountValue account={tab === 'transfer' ? destinationAccount : exchangeDestAccount} />}
                />
              }
            >
              {tab === 'transfer'
                ? renderAccountPicker(otherAccounts, destinationAccountId, (id) => {
                    setDestinationAccountId(id)
                    setActivePopover(null)
                  })
                : renderAccountPicker(cashBank, destinationAccountId, (id) => {
                    setDestinationAccountId(id)
                    setActivePopover(null)
                  })}
            </Popover>
          )}

          {/* Category (income / expense) */}
          {(tab === 'income' || tab === 'expense') && (
            <div data-tour="category">{categoryRow}</div>
          )}

          {/* Date (always) */}
          {dateRow}
        </>
      )}
    </div>
  )

  // ── Exchange: no-other-currency hint + received amount ──────────────────────
  // Destination currency shown on the received-amount card.
  const receivedCurrency: 'ARS' | 'USD' =
    (isEdit ? edit?.destinationCurrency : exchangeDestCurrency) ?? 'USD'
  // Implicit rate "1 {received} = ${origin}", derived from both amounts (read-only).
  const exchangeRate = (() => {
    if (tab !== 'exchange') return null
    const src = parseMoneyInput(amount)
    const dst = parseMoneyInput(destinationAmount)
    if (src === null || dst === null || src <= 0 || dst <= 0) return null
    return Money.toNumber(Money.divide(Money.from(src), dst))
  })()
  const exchangeReceived =
    (!isEdit && tab === 'exchange' && exchangeDestCurrency) || (isEdit && editable?.destinationAmount) ? (
      <div className="rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
        <div className="flex items-center justify-between">
          <label htmlFor="exchange-dest-amount" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
            {t('labels.exchange_received')}
          </label>
          <span
            className="inline-flex items-center rounded-[9px] border border-border px-2.5 py-1 text-xs font-bold text-text"
            style={{ backgroundColor: FIELD_BG }}
          >
            {receivedCurrency}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[27px] font-semibold leading-none opacity-50 text-text">
            {CURRENCY_SYMBOL[receivedCurrency]}
          </span>
          <MoneyAmountInput
            id="exchange-dest-amount"
            required
            value={destinationAmount}
            onChange={setDestinationAmount}
            placeholder="0"
            className="w-full min-w-0 bg-transparent text-[46px] font-bold leading-none tracking-[-0.045em] tabular-nums text-text outline-none placeholder:text-text-soft/40"
          />
        </div>
        {exchangeRate !== null && (
          <p className="mt-2.5 text-[12.5px] text-text-muted tabular-nums">
            1 {receivedCurrency} = {CURRENCY_SYMBOL[currencyCode]}
            {fmtBalance(exchangeRate)} {currencyCode}
          </p>
        )}
      </div>
    ) : null

  const exchangeNoCurrencyHint =
    !isEdit && tab === 'exchange' && !exchangeDestCurrency ? (
      <p className="text-sm text-text-muted">
        {t('exchange.no_other_currency_hint', { currency: currencyCode === 'ARS' ? 'USD' : 'ARS' })}
      </p>
    ) : null

  // ── Cuotas card (create + Gasto + credit + ARS) ─────────────────────────────
  const cuotasCard =
    !isEdit && tab === 'expense' && isCredit && currencyCode === 'ARS' ? (
      <div className="rounded-[15px] border border-border bg-card p-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-9 items-center justify-center rounded-[11px] text-terracotta"
            style={{ backgroundColor: 'var(--terracotta-soft)' }}
          >
            <CreditCard className="size-[18px]" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-text">{t('labels.installments')}</span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {INSTALLMENT_OPTIONS.map((n) => {
            const active = installments === String(n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => setInstallments(String(n))}
                className={`shrink-0 rounded-[10px] px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  active ? 'bg-navy text-white' : 'text-text-muted'
                }`}
                style={active ? undefined : { backgroundColor: FIELD_BG }}
              >
                {n}×
              </button>
            )
          })}
        </div>
        {isInstallments && perInstallment !== null && (
          <div className="mt-3 rounded-[11px] px-3 py-2 text-[13px] text-text-muted" style={{ backgroundColor: FIELD_BG }}>
            {t('drawer.installments_breakdown', {
              count: parseInt(installments),
              amount: fmtBalance(perInstallment),
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-text-soft">{t('installments_options.ars_only_hint')}</p>
      </div>
    ) : null

  // ── Description ──────────────────────────────────────────────────────────────
  const isAdjustment = isEdit ? edit?.type === 'adjustment' : tab === 'adjustment'
  const descriptionField = (
    <div className="rounded-[15px] border border-border bg-card px-4 py-3" data-tour="description">
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
          style={{ backgroundColor: FIELD_BG }}
        >
          <FileText className="size-[18px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <label htmlFor="description" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
            {isAdjustment ? t('drawer.adjust_reason') : t('labels.description')}
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSuggestion(null)
              setDescriptionHasNoHistory(false)
            }}
            onBlur={handleDescriptionBlur}
            placeholder={isAdjustment ? t('drawer.adjust_reason_placeholder') : t('placeholders.description')}
            className="w-full bg-transparent text-[15px] font-semibold text-text outline-none placeholder:font-normal placeholder:text-text-soft/60"
          />
        </div>
      </div>
      {isAdjustment && <p className="mt-2 pl-12 text-xs text-text-muted">{t('drawer.adjust_reason_required')}</p>}
      {!isEdit && (tab === 'income' || tab === 'expense') && descriptionHasNoHistory && selectedCategory && (
        <div className="mt-2 pl-12">
          <CategorySuggestionHint
            description={description}
            categoryName={getCategoryName(selectedCategory, tRoot)}
          />
        </div>
      )}
    </div>
  )

  // ── Adjustment balance preview (create only) ────────────────────────────────
  const adjustmentPreviewRow = adjustmentPreview ? (
    <div className="flex items-center justify-between rounded-[15px] border border-border bg-card px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
        {t('drawer.balance_will_be')}
      </span>
      <span className="text-[15px] font-semibold tabular-nums text-text">
        <span className="text-text-soft">
          {CURRENCY_SYMBOL[currencyCode]}
          {fmtBalance(adjustmentPreview.current)}
        </span>
        <span className="mx-1.5 text-text-soft">→</span>
        {CURRENCY_SYMBOL[currencyCode]}
        {fmtBalance(adjustmentPreview.next)}
      </span>
    </div>
  ) : null

  // ── Category suggestion chip (create, income/expense, no category yet) ───────
  const suggestionChip =
    !isEdit && suggestion && !categoryId && (tab === 'income' || tab === 'expense') ? (
      <CategorySuggestionChip suggestion={suggestion} onApply={applySuggestion} />
    ) : null

  // ── Toggles: reintegro + repetir (create only) ──────────────────────────────
  const showReimbursementToggle = !isEdit && tab === 'expense' && !isInstallments
  const showSharedToggle = !isEdit && tab === 'expense' && !!sharedMembers
  const showRepeatToggle =
    !isEdit && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments

  const togglesGroup =
    showReimbursementToggle || showSharedToggle || showRepeatToggle ? (
      <div className="overflow-hidden rounded-[15px] border border-border bg-card [&>*+*]:border-t [&>*+*]:border-[#F1F3F6]">
        {showReimbursementToggle && (
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] transition-colors ${
                  reimbursementEnabled ? 'text-emerald-deep' : 'text-text-muted'
                }`}
                style={{ backgroundColor: reimbursementEnabled ? 'var(--emerald-soft)' : FIELD_BG }}
              >
                <Undo2 className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text">{t('reimbursement.toggle')}</p>
                <p className="text-xs text-text-muted">{t('reimbursement.pending_hint')}</p>
              </div>
              <Switch
                checked={reimbursementEnabled}
                ariaLabel={t('reimbursement.toggle')}
                onValueChange={(on) => {
                  setReimbursementEnabled(on)
                  if (on) setReimbursementAccountId(pickReimbursementAccount(accountId))
                }}
              />
            </div>
            {reimbursementEnabled && (
              <div className="mt-3.5 flex flex-col gap-3 border-t pt-3.5" style={{ borderColor: ROW_DIVIDER }}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reimb-amount" className="text-xs font-semibold text-text-muted">
                    {t('reimbursement.estimated_amount')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-soft">
                      {CURRENCY_SYMBOL[currencyCode]}
                    </span>
                    <MoneyAmountInput
                      id="reimb-amount"
                      value={reimbursementAmount}
                      onChange={setReimbursementAmount}
                      placeholder={t('placeholders.amount')}
                      className="w-full rounded-[10px] border border-border bg-card py-2 pl-9 pr-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: FIELD_BG }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-muted">{t('reimbursement.percent_hint')}</span>
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reimb-percent" className="text-[11px] text-text-muted">
                        {t('reimbursement.percent_label')}
                      </label>
                      <div className="relative">
                        <input
                          id="reimb-percent"
                          type="text"
                          inputMode="decimal"
                          value={reimbursementPercent}
                          onChange={(e) => {
                            const v = e.target.value.replace(',', '.')
                            setReimbursementPercent(v)
                            applyReimbursementPercent(v, reimbursementCap)
                          }}
                          placeholder="0"
                          className="w-20 rounded-[10px] border border-border py-1.5 pl-2.5 pr-6 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: FIELD_BG }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">%</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="reimb-cap" className="text-[11px] text-text-muted">
                        {t('reimbursement.cap_label')}
                      </label>
                      <MoneyAmountInput
                        id="reimb-cap"
                        value={reimbursementCap}
                        onChange={(v) => {
                          setReimbursementCap(v)
                          applyReimbursementPercent(reimbursementPercent, v)
                        }}
                        placeholder={t('placeholders.amount')}
                        className="w-28 rounded-[10px] border border-border px-2.5 py-1.5 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: FIELD_BG }}
                      />
                    </div>
                  </div>
                </div>

                {isCredit && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-muted">{t('reimbursement.target_label')}</span>
                    {(['account', 'statement'] as const).map((tg) => (
                      <label key={tg} className="flex items-center gap-2 text-sm text-text">
                        <input
                          type="radio"
                          name="reimb-target"
                          value={tg}
                          checked={reimbursementTarget === tg}
                          onChange={() => setReimbursementTarget(tg)}
                          className="accent-emerald"
                        />
                        {t(`reimbursement.target.${tg}`)}
                      </label>
                    ))}
                  </div>
                )}

                {(!isCredit || reimbursementTarget === 'account') && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reimb-account" className="text-xs text-text-muted">
                      {t('reimbursement.credit_to')}
                    </label>
                    <select
                      id="reimb-account"
                      value={reimbursementAccountId}
                      onChange={(e) => setReimbursementAccountId(e.target.value)}
                      className="rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{t('reimbursement.credit_to_placeholder')}</option>
                      {cashBank.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={reimbursementReceivedNow}
                    onChange={(e) => setReimbursementReceivedNow(e.target.checked)}
                    className="accent-emerald"
                  />
                  {t('reimbursement.received_now')}
                </label>
                <p className="text-xs text-text-muted">
                  {reimbursementReceivedNow ? t('reimbursement.received_now_hint') : t('reimbursement.pending_hint')}
                </p>
              </div>
            )}
          </div>
        )}

        {showSharedToggle && sharedMembers && (
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] transition-colors ${
                  sharedEnabled ? 'text-emerald-deep' : 'text-text-muted'
                }`}
                style={{ backgroundColor: sharedEnabled ? 'var(--emerald-soft)' : FIELD_BG }}
              >
                <Users className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text">{tShared('split.toggle_label')}</p>
                <p className="text-xs text-text-muted">
                  {tShared('split.toggle_hint', { name: sharedMembers[1].fullName })}
                </p>
              </div>
              <Switch
                checked={sharedEnabled}
                ariaLabel={tShared('split.toggle_label')}
                onValueChange={setSharedEnabled}
              />
            </div>
            {sharedEnabled && (
              <div
                className="mt-3.5 flex flex-col gap-2 border-t pt-3.5"
                style={{ borderColor: ROW_DIVIDER }}
              >
                <span className="text-xs text-text-muted">{tShared('split.title')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text">{sharedMembers[0].fullName}</span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(splitFirstPct)}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                        setSplitFirstPct(Number.isNaN(n) ? 1 : Math.max(1, Math.min(99, n)))
                      }}
                      aria-label={sharedMembers[0].fullName}
                      className="w-16 rounded-[10px] border border-border py-1.5 pl-2.5 pr-6 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ backgroundColor: FIELD_BG }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                      %
                    </span>
                  </div>
                  <span className="text-sm text-text-muted">
                    · {sharedMembers[1].fullName} {100 - splitFirstPct}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {showRepeatToggle && (
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] transition-colors ${
                  isRecurrent ? 'text-emerald-deep' : 'text-text-muted'
                }`}
                style={{ backgroundColor: isRecurrent ? 'var(--emerald-soft)' : FIELD_BG }}
              >
                <Repeat className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text">{t('labels.make_recurrent')}</p>
                <p className="text-xs text-text-muted">{t('drawer.repeat_note')}</p>
              </div>
              <Switch
                checked={isRecurrent}
                ariaLabel={t('labels.make_recurrent')}
                onValueChange={setIsRecurrent}
              />
            </div>
            {isRecurrent && (
              <div className="mt-3.5 flex flex-col gap-3 border-t pt-3.5" style={{ borderColor: ROW_DIVIDER }}>
                <span className="text-xs font-semibold text-text-muted">{t('drawer.repeat_question')}</span>
                <div className="flex flex-wrap gap-2">
                  {(['weekly', 'biweekly', 'monthly', 'annual', 'custom'] as const).map((f) => {
                    const active = frequency === f
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`rounded-[10px] px-3 py-1.5 text-sm font-bold transition-colors ${
                          active ? 'bg-navy text-white' : 'text-text-muted'
                        }`}
                        style={active ? undefined : { backgroundColor: FIELD_BG }}
                      >
                        {t(`frequencies.${f}`)}
                      </button>
                    )
                  })}
                </div>

                {frequency === 'custom' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{tRec('custom_interval.every')}</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={intervalCount}
                      onChange={(e) => setIntervalCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      aria-label={tRec('custom_interval.every')}
                      className="w-16 rounded-[10px] border border-border bg-card px-2 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) => setIntervalUnit(e.target.value as typeof intervalUnit)}
                      aria-label={t('labels.frequency')}
                      className="rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="day">{tRec('custom_interval.units.day', { count: intervalCount })}</option>
                      <option value="week">{tRec('custom_interval.units.week', { count: intervalCount })}</option>
                      <option value="month">{tRec('custom_interval.units.month', { count: intervalCount })}</option>
                      <option value="year">{tRec('custom_interval.units.year', { count: intervalCount })}</option>
                    </select>
                  </div>
                )}

                {/* Optional end date — applies to any frequency. */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="recurrence-until" className="text-xs text-text-muted">
                    {t('drawer.repeat_until')}
                  </label>
                  <input
                    id="recurrence-until"
                    type="date"
                    value={recurrenceEndDate}
                    min={date}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="w-44 rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ) : null

  // ── Shared body ──────────────────────────────────────────────────────────────
  const body = (
    <>
      {hero}
      {adjustmentSign}
      {adjustmentBanner}
      {exchangeNoCurrencyHint}
      {suggestionChip}
      {fieldGroup}
      {exchangeReceived}
      {cuotasCard}
      {descriptionField}
      {adjustmentPreviewRow}
      {togglesGroup}
    </>
  )

  // ── Footer buttons ───────────────────────────────────────────────────────────
  // Edit uses the library Button (primary emerald), matching the other edit
  // drawers (cuenta/tarjeta). Create keeps the handoff styling: emerald for
  // income, navy for the rest.
  const submitButton = isEdit ? (
    <Button
      type="submit"
      variant="primary"
      loading={isPending}
      className="h-[52px] flex-1 rounded-[14px] text-[15.5px] font-bold tracking-[-0.01em]"
    >
      {ctaLabel}
    </Button>
  ) : (
    <button
      type="submit"
      disabled={isPending}
      data-tour="submit"
      className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold text-white transition-opacity disabled:opacity-50 ${
        tab === 'income'
          ? 'bg-emerald shadow-[0_8px_20px_-4px_rgba(16,185,129,0.35)]'
          : 'bg-navy shadow-[0_8px_20px_-4px_rgba(11,26,43,0.30)]'
      }`}
    >
      {ctaLabel}
      <kbd className="hidden font-semibold opacity-70 sm:inline">⌘↵</kbd>
    </button>
  )

  // ── First-movement tour ─────────────────────────────────────────────────────
  // Auto-starts for a no-movements user opening the create drawer on an
  // expense/income tab. The other tabs don't share these fields, so it hides.
  const showTour =
    showFirstMovementGuidance &&
    isDrawer &&
    !isEdit &&
    !tour.loading &&
    tour.isVisible &&
    (tab === 'expense' || tab === 'income')

  const tourSteps: CoachmarkStep[] = [
    { target: 'amount', title: tTour('amount_title'), body: tTour('amount_body') },
    { target: 'account', title: tTour('account_title'), body: tTour('account_body') },
    { target: 'category', title: tTour('category_title'), body: tTour('category_body') },
    { target: 'description', title: tTour('description_title'), body: tTour('description_body') },
    { target: 'submit', title: tTour('save_title'), body: tTour('save_body'), finale: true },
  ]

  const tourOverlay = showTour ? (
    <CoachmarkTour
      steps={tourSteps}
      containerRef={formRef}
      labels={{
        step: (current, total) => tTour('step_label', { current, total }),
        next: tTour('next'),
        back: tTour('back'),
        skip: tTour('skip'),
        finish: tTour('finish'),
      }}
      onFinish={() => tour.mark('completed')}
      onSkip={() => tour.mark('dismissed')}
    />
  ) : null

  // ── Render: drawer shell vs inline page ─────────────────────────────────────
  if (isDrawer) {
    return (
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); hookSubmit() }} onKeyDown={handleKeyDown} className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-7 pb-4 pt-[22px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-soft">{eyebrow}</p>
              <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('drawer.close')}
              className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text-muted transition-colors hover:bg-border-soft"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-4">{typeSelector}</div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <div className="flex flex-col gap-4">{body}</div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-7 py-4">
          {formError && <p className="mb-3 text-sm text-destructive">{formError}</p>}
          <div className="flex gap-3">{submitButton}</div>
        </footer>
        {tourOverlay}
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); hookSubmit() }} onKeyDown={handleKeyDown} className="flex flex-col gap-4">
      {typeSelector}
      {body}
      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <div className="flex gap-3">{submitButton}</div>
    </form>
  )
}
