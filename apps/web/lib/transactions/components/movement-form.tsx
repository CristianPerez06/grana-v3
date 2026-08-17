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
  Lightbulb,
  Plus,
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
import { DatePicker } from '@/components/ui/date-picker'
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
import { createRecurrence, createRecurrenceFromMovement } from '@/app/_actions/recurrences'
import { saveExpenseReimbursement } from '@/app/_actions/reimbursements'
import { suggestCategoryFromHistory } from '@/app/_actions/category-suggestion'
import { Money, parseMoneyInput } from '@grana/validation'
import {
  formatDateISO,
  getTodayAR,
  type MovementType,
} from '@grana/money-logic'
import {
  graftArchivedTaxonomy,
  selectableSubcategories,
  useMovementForm,
  PRIMARY_TABS,
  type FrequentClassification,
  type MovementEditContext as PackageMovementEditContext,
  type MovementFormAccount as PackageMovementFormAccount,
  type Mutators,
  type Tab,
} from '@grana/movement-form'
import { useIsMobile } from '@/lib/use-is-mobile'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { formatForDisplay } from '@/lib/money-input-format'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { CategorySuggestionChip } from '@/lib/transactions/components/category-suggestion-chip'
import { CategorySuggestionHint } from '@/lib/transactions/components/category-suggestion-hint'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { getCategoryName, getSubcategoryName } from '@/lib/categories/display'
import type { Household } from '@grana/shared'

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
  /** Frequent leaf classifications (create-only accelerator, #31 item 1). */
  frequentClassifications?: FrequentClassification[]
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
  /**
   * Lower bound for the movement date (the user's signup date). You can't
   * register a movement dated before you started using the app. Null ⇒ no floor.
   */
  appStartDate?: string | null
  /** Show inline guides for first-time users (no prior transactions). */
  showFirstMovementGuidance?: boolean
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

// The common counts as one-tap chips; anything else (incl. 5) via the stepper.
const INSTALLMENT_OPTIONS = [1, 3, 6, 12]
const MAX_INSTALLMENTS = 60

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

// Mobile-web: a light, symbol-forward pill that activates an advanced section
// (reintegro / compartir / repetir). The icon leads; it fills emerald when on.
// Its params render below the chip row when active. Desktop keeps the row+switch
// layout instead.
const AdvChip = ({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-50 ${
      active ? 'border-transparent text-emerald-deep' : 'border-border text-text-muted'
    }`}
    style={{ backgroundColor: active ? 'var(--emerald-soft)' : FIELD_BG }}
  >
    <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-[15px]" aria-hidden>
      {icon}
    </span>
    {label}
  </button>
)

// Account display: the institution is the headline; the account's own name is
// the secondary detail (omitted when it would just repeat the institution, e.g.
// auto-named bank accounts). Cash accounts have no institution → name leads.
const accountPrimaryName = (a: { name: string; institutionName?: string | null }): string =>
  a.institutionName?.trim() || a.name
const accountSecondaryName = (a: { name: string; institutionName?: string | null }): string | null => {
  const inst = a.institutionName?.trim()
  return inst && inst !== a.name ? a.name : null
}

// Avatar + institution headline (+ secondary name), used as the value of an
// account row and the rows inside the account popover.
const AccountValue = ({ account }: { account: MovementFormAccount | undefined }) => {
  if (!account) return <span className="text-text-soft">—</span>
  const avatar: ResolvedAccountAvatar = account.avatar ?? {
    colorKey: null,
    colorOverride: null,
    iconKey: account.type === 'credit' ? 'credit-card' : 'wallet',
    monogram: account.name.charAt(0).toUpperCase(),
  }
  const secondary = accountSecondaryName(account)
  return (
    <span className="flex items-center gap-2">
      <AccountAvatar {...avatar} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-text">{accountPrimaryName(account)}</span>
        {secondary && (
          <span className="truncate text-xs font-normal text-text-muted">{secondary}</span>
        )}
      </span>
    </span>
  )
}

export const MovementForm = ({
  accounts,
  categories,
  frequentClassifications,
  edit,
  preselectAccountId,
  onSuccess,
  variant = 'page',
  onClose,
  household,
  appStartDate = null,
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
  // Mobile-web layout gate. Desktop keeps the current rendering untouched
  // (`isMobile ? <mobile> : <desktop>`); only the phone viewport gets the
  // redesign. Behavior gating (e.g. category drill) needs this JS flag — CSS
  // alone can't branch onClick handlers.
  const isMobile = useIsMobile()
  const [activePopover, setActivePopover] = useState<string | null>(null)
  const [catDrill, setCatDrill] = useState<string | null>(null)
  // Reveals the free-form installments input. Also implicitly active when the
  // current value isn't one of the presets (e.g. coming back to a 4× purchase).
  const [customInstallments, setCustomInstallments] = useState(false)
  // Editing buffer for the split % field so it can be momentarily empty while
  // retyping (e.g. clearing "50" to enter "60"). `null` = show the committed
  // value; a string = the in-progress text. Clamped/committed on blur.
  const [splitDraft, setSplitDraft] = useState<string | null>(null)
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
    saveExpenseReimbursement,
    registerCardPurchase,
    registerInstallments,
    createRecurrenceFromMovement,
    createRecurrenceDirect: createRecurrence,
    suggestCategoryFromHistory,
  }

  const form = useMovementForm({
    mutators,
    accounts,
    categories,
    frequentClassifications,
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
    reimbursementReadOnly,
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
    showAccountSelector,
    secondaryTabs,
    isSecondaryTab,
    selectedAccount,
    cashBankAccounts,
    otherAccounts,
    destinationAccount,
    exchangeDestAccount,
    exchangeDestCurrency,
    effectiveCurrency,
    currencyOptions,
    frequentChips,
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
  // canonical_name, is_system) — the hook only narrows to id+type. The graft
  // has to be repeated here for the same reason: the hook's copy of the tree
  // isn't the one this component renders.
  const catalog = graftArchivedTaxonomy(categories, edit?.archivedTaxonomy, {
    categoryId,
    subcategoryId,
  })
  const expenseCategories = catalog.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = catalog.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  const isCredit = selectedAccount?.type === 'credit'
  const sharedMembers =
    household && household.members.length === 2 ? household.members : null
  // "Es 100% del otro": the payer (members[0]) keeps 0%, the partner owes the
  // whole amount. It's just the split's edge (0/100), surfaced as an explicit
  // toggle so a bare "0%" doesn't have to be discovered. `prevSplitPct` remembers
  // the last real split so unchecking restores it instead of snapping to a default.
  const fullyOther = splitFirstPct === 0
  const [prevSplitPct, setPrevSplitPct] = useState<number>(() => splitFirstPct || 50)
  const setFullyOther = (on: boolean) => {
    if (on) {
      if (splitFirstPct > 0) setPrevSplitPct(splitFirstPct)
      setSplitDraft(null)
      setSplitFirstPct(0)
    } else {
      setSplitFirstPct(prevSplitPct || 50)
    }
  }

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
          : edit.sourceAccountName && !edit.editableFields?.account
            ? [{ label: t('labels.account'), value: edit.sourceAccountName }]
            : []),
      ]
    : []

  const formatBalance = (account: MovementFormAccount): string =>
    account.activeCurrencies
      .map((c) => {
        const n = account.balances[c] ?? 0
        // Sign before the symbol ("-$1.234", not "$-1.234"); a space after the
        // multi-char USD code reads cleaner ("U$D 10").
        const sign = n < 0 ? '-' : ''
        const amount = Math.abs(n).toLocaleString('es-AR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
        return `${sign}${CURRENCY_SYMBOL[c]}${c === 'USD' ? ' ' : ''}${amount}`
      })
      .join(' · ')

  // ── Derived presentation values + handlers for the hi-fi shell ──────────────

  const eyebrow = isEdit ? t('drawer.eyebrow_edit') : t('drawer.eyebrow_new')
  const title = isEdit ? t('edit_title') : t('actions.register_movement')
  // Mobile create: drop the "NUEVO" eyebrow and use a single-line "Nuevo
  // movimiento" title (matches the native screen title). Desktop/edit unchanged.
  const showEyebrow = !(isMobile && !isEdit)
  const headerTitle = isMobile && !isEdit ? t('new.title') : title

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
      {list.map((a) => {
        const secondaryName = accountSecondaryName(a)
        const detail = [secondaryName, a.type !== 'credit' ? formatBalance(a) : null]
          .filter(Boolean)
          .join('  ·  ')
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
          >
            <AccountAvatar {...avatarOf(a)} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
                {accountPrimaryName(a)}
                {a.type === 'credit' && (
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta" style={{ backgroundColor: 'var(--terracotta-soft)' }}>
                    {t('drawer.credit_badge')}
                  </span>
                )}
              </span>
              {detail && (
                <span className="truncate text-xs tabular-nums text-text-muted">{detail}</span>
              )}
            </span>
            {selectedId === a.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => {
          onClose?.()
          router.push('/accounts?nuevaCuenta=1')
        }}
        className="mt-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-emerald transition-colors hover:bg-page"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald/10">
          <Plus className="size-4 text-emerald" aria-hidden />
        </span>
        {t('drawer.add_new_account')}
      </button>
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
          {s.is_active === false && (
            <span className="shrink-0 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">
              {t('drawer.archived')}
            </span>
          )}
          {subcategoryId === s.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-0.5">
      {transactionCategories.map((c) => {
        // Only selectable subcategories make a category drillable: a grafted
        // archived one is this movement's current value, not an option, and
        // must not open a second level holding nothing but itself.
        const drillable = selectableSubcategories(c).length > 0
        const archivedBadge = c.is_active === false && (
          <span className="shrink-0 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-text-muted">
            {t('drawer.archived')}
          </span>
        )
        // Mobile-web: tapping the row assigns the bare category; a separate
        // chevron button drills into subcategories (no forced drill).
        if (drillable && isMobile) {
          return (
            <div
              key={c.id}
              className="flex items-center gap-1 rounded-[10px] pr-1 transition-colors hover:bg-page"
            >
              <button
                type="button"
                onClick={() => pickCategory(c.id, '')}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
              >
                <span className="flex-1 truncate text-sm font-medium text-text">
                  {c.icon ? `${c.icon} ` : ''}
                  {getCategoryName(c, tRoot)}
                </span>
                {archivedBadge}
                {categoryId === c.id && !subcategoryId && (
                  <Check className="size-4 shrink-0 text-emerald" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setCatDrill(c.id)}
                aria-label={t('form.category_drill', { category: getCategoryName(c, tRoot) })}
                className="shrink-0 rounded-md p-1.5 text-text-soft transition-colors hover:bg-border-soft"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )
        }
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
            {archivedBadge}
            {drillable ? (
              <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
            ) : (
              categoryId === c.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />
            )}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => {
          onClose?.()
          router.push('/settings/categories?nuevaCategoria=1')
        }}
        className="mt-0.5 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-emerald transition-colors hover:bg-page"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald/10">
          <Plus className="size-4 text-emerald" aria-hidden />
        </span>
        {t('drawer.add_new_category')}
      </button>
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
      {/* The value can be an archived row this movement was classified with
          before it was archived — say so instead of showing it as if it were
          still on offer. */}
      {(selectedCategory.is_active === false ||
        selectedSubcategory?.is_active === false) && (
        <span className="shrink-0 text-xs text-text-soft">{`(${t('drawer.archived')})`}</span>
      )}
    </span>
  ) : (
    <span className="text-text-soft">{t('placeholders.category')}</span>
  )

  // ── Type selector (Segmented). Disabled in edit: type is immutable. ─────────
  const typeSelector =
    isMobile && !isEdit ? (
      // Mobile-web: two primaries + "Otros" (secondary types behind a popover).
      <div
        className="flex gap-1 rounded-[11px] border border-border p-1"
        style={{ backgroundColor: FIELD_BG }}
      >
        {PRIMARY_TABS.map((k) => {
          const active = tab === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 rounded-[9px] px-3 py-2 text-sm font-bold transition-colors ${
                active ? 'bg-card text-text shadow-sm' : 'text-text-muted'
              }`}
            >
              {TAB_LABELS[k]}
            </button>
          )
        })}
        {secondaryTabs.length > 0 && (
          <Popover
            modal={isDrawer}
            open={activePopover === 'otros'}
            onOpenChange={(o) => setActivePopover(o ? 'otros' : null)}
            trigger={
              <button
                type="button"
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] px-3 py-2 text-sm font-bold transition-colors ${
                  isSecondaryTab ? 'bg-card text-text shadow-sm' : 'text-text-muted'
                }`}
              >
                {isSecondaryTab ? TAB_LABELS[tab] : t('form.other_types')}
                <ChevronDown className="size-3" aria-hidden />
              </button>
            }
          >
            <div className="flex flex-col gap-0.5">
              {secondaryTabs.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setTab(k)
                    setActivePopover(null)
                  }}
                  className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-page"
                >
                  {TAB_LABELS[k]}
                  {tab === k && <Check className="ml-auto size-4 text-emerald" aria-hidden />}
                </button>
              ))}
            </div>
          </Popover>
        )}
      </div>
    ) : (
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
  // Mobile: size the input to its content so the whole "− $ 1.234" group centers
  // (justify-center on the row). `ch` from the grouped display keeps it robust
  // across browsers that don't support CSS `field-sizing: content`.
  const amountDisplayCh = Math.max(1, formatForDisplay(amount).length) + 0.5
  const hero = showAmountHero ? (
    <div
      data-tour="amount"
      className={`rounded-[18px] border border-border bg-card transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)] ${
        isMobile ? 'px-4 pb-4 pt-3.5' : 'px-[22px] pb-[22px] pt-5'
      }`}
    >
      {isMobile ? (
        // Mobile: eyebrow top-left and chip+calculator pinned to the top-right
        // corner (both absolute, so they don't drag the number down), and the big
        // number centered — horizontally and within a min-height, so it has room
        // above and below instead of sitting on the bottom border.
        <div className="relative">
          <span className="absolute left-0 top-0 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
            {t('labels.amount')}
          </span>
          <div className="absolute right-0 top-0 flex flex-col items-end gap-1.5">
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
            <MoneyCalculatorPopover seed={amount} onResult={setAmount} />
          </div>
          <div className="flex min-h-[72px] items-center justify-center gap-1.5">
            {signChar && (
              <span className={`text-[34px] font-bold leading-none ${amountColor}`}>{signChar}</span>
            )}
            <span className={`text-[34px] font-bold leading-none ${amountColor}`}>
              {CURRENCY_SYMBOL[effectiveCurrency]}
            </span>
            <MoneyAmountInput
              ref={amountRef}
              id="amount"
              required
              value={amount}
              onChange={setAmount}
              placeholder="0"
              style={{ width: `${amountDisplayCh}ch` }}
              className={`min-w-0 bg-transparent text-left text-[34px] font-bold leading-none tracking-[-0.045em] tabular-nums outline-none placeholder:text-text-soft/40 ${amountColor}`}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
              {t('labels.amount')}
            </span>
            <div className="flex items-center gap-2">
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
            <MoneyCalculatorPopover seed={amount} onResult={setAmount} className="shrink-0 self-center" />
          </div>
        </>
      )}
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
  const categoryRow = (
    <Popover
      modal={isDrawer}
      open={activePopover === 'category'}
      onOpenChange={(o) => {
        setActivePopover(o ? 'category' : null)
        if (!o) setCatDrill(null)
      }}
      trigger={
        isMobile ? (
          // Mobile-web: the frequent chips carry the common case; the full
          // catalog lives behind a slim "Elegir otra categoría" trigger. It
          // shows the current selection when it isn't one of the active chips,
          // so what's picked is always visible.
          <button type="button" className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
            <Tag className="size-4 shrink-0 text-text-soft" aria-hidden />
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${
                selectedCategory && !frequentChips.some((c) => c.active)
                  ? 'font-semibold text-text'
                  : 'font-medium text-text-muted'
              }`}
            >
              {selectedCategory && !frequentChips.some((c) => c.active)
                ? categoryValue
                : t('drawer.pick_other_category')}
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-text-soft/50" aria-hidden />
          </button>
        ) : (
          <FieldRow icon={<Tag className="size-[18px]" />} label={t('labels.category')} value={categoryValue} />
        )
      }
    >
      {categoryPickerContent}
    </Popover>
  )

  const yesterdayISO = (() => {
    const d = getTodayAR()
    d.setDate(d.getDate() - 1)
    return formatDateISO(d)
  })()
  const dateRow = isMobile ? (
    // Mobile-web: Hoy / Ayer quick chips + a calendar trigger for any date.
    <div className="flex items-center gap-3 px-4 py-3">
      <DatePicker
        value={date}
        onChange={setDate}
        min={appStartDate ?? undefined}
        modal={isDrawer}
        trigger={
          <button type="button" className="flex min-w-0 items-center gap-3 text-left">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
              style={{ backgroundColor: FIELD_BG }}
            >
              <Calendar className="size-[18px]" aria-hidden />
            </span>
            <span className="truncate text-[13px] font-semibold text-text">
              {date ? formatDateValue(date) : t('labels.date')}
            </span>
          </button>
        }
      />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {(
          [
            { label: t('form.date_today'), value: todayStr() },
            { label: t('form.date_yesterday'), value: yesterdayISO },
          ] as const
        ).map((o) => {
          const active = date === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setDate(o.value)}
              className={`rounded-[8px] px-2.5 py-1.5 text-xs font-bold transition-colors ${
                active ? 'bg-navy text-white' : 'border border-border text-text-muted'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  ) : (
    <DatePicker
      value={date}
      onChange={setDate}
      min={appStartDate ?? undefined}
      modal={isDrawer}
      trigger={
        <FieldRow icon={<Calendar className="size-[18px]" />} label={t('labels.date')} value={formatDateValue(date)} />
      }
    />
  )

  // Source account row (create) — extracted so the mobile and desktop branches
  // of `fieldGroup` reuse the exact same JSX in a different order.
  const accountRow = (
    <div className="relative" data-tour="account">
      <Popover
        modal={isDrawer}
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
  )

  const destinationRow =
    tab === 'transfer' || tab === 'exchange' ? (
      <Popover
        modal={isDrawer}
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
    ) : null

  const categoryRowWrapped =
    tab === 'income' || tab === 'expense' ? <div data-tour="category">{categoryRow}</div> : null

  // Mobile-web: frequent-classification chips (#31 item 1) above the category
  // row — one tap pre-fills category (+ subcategory). Create-only and only when
  // history resolved some; `frequentChips` is already empty otherwise. Desktop
  // is untouched (rendered only in the mobile branch below).
  const frequentChipsRow =
    frequentChips.length > 0 ? (
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {frequentChips.map((chip) => (
          <button
            key={`${chip.categoryId}:${chip.subcategoryId ?? ''}`}
            type="button"
            onClick={() => pickCategory(chip.categoryId, chip.subcategoryId ?? '')}
            aria-pressed={chip.active}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              chip.active ? 'border-navy bg-navy text-white' : 'border-border text-text'
            }`}
            style={chip.active ? undefined : { backgroundColor: FIELD_BG }}
          >
            {chip.icon && <span aria-hidden>{chip.icon}</span>}
            <span className="truncate">{chip.label}</span>
          </button>
        ))}
      </div>
    ) : null

  // Mobile-web account selector grouped by Débito/Crédito family (design D10).
  // Used for expense/income; transfer/exchange keep the popover `accountRow`.
  const debitAccounts = eligibleAccounts.filter((a) => a.type !== 'credit')
  const creditAccounts = eligibleAccounts.filter((a) => a.type === 'credit')
  const bothFamilies = debitAccounts.length > 0 && creditAccounts.length > 0
  const accountFamily: 'debit' | 'credit' = isCredit ? 'credit' : 'debit'
  const familyList = accountFamily === 'credit' ? creditAccounts : debitAccounts
  const accountFamilyRow = (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
        {accountLabel}
      </span>
      {bothFamilies && (
        <div className="flex gap-1 rounded-[10px] border border-border p-1" style={{ backgroundColor: FIELD_BG }}>
          {(['debit', 'credit'] as const).map((f) => {
            const active = accountFamily === f
            const first = (f === 'credit' ? creditAccounts : debitAccounts)[0]
            return (
              <button
                key={f}
                type="button"
                onClick={() => first && setAccountId(first.id)}
                className={`flex-1 rounded-[8px] px-3 py-1.5 text-xs font-bold transition-colors ${
                  active ? 'bg-card text-text shadow-sm' : 'text-text-muted'
                }`}
              >
                {f === 'debit' ? t('form.family_debit') : t('form.family_credit')}
              </button>
            )
          })}
        </div>
      )}
      {familyList.length > 5 ? (
        // Many accounts in the family: a compact dropdown instead of a long list.
        <Popover
          modal={isDrawer}
          open={activePopover === 'account'}
          onOpenChange={(o) => setActivePopover(o ? 'account' : null)}
          trigger={
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[11px] border border-border px-3 py-2.5 text-left transition-colors hover:bg-[var(--row-hover)]"
              style={{ '--row-hover': ROW_HOVER } as React.CSSProperties}
            >
              {selectedAccount && <AccountAvatar {...avatarOf(selectedAccount)} size="sm" />}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                {selectedAccount ? accountPrimaryName(selectedAccount) : '—'}
              </span>
              {selectedAccount && selectedAccount.type !== 'credit' && (
                <span className="shrink-0 text-xs font-medium text-text-muted">
                  {formatBalance(selectedAccount)}
                </span>
              )}
              <ChevronDown className="size-4 shrink-0 text-text-soft" aria-hidden />
            </button>
          }
        >
          {renderAccountPicker(familyList, accountId, (id) => {
            setAccountId(id)
            setActivePopover(null)
          })}
        </Popover>
      ) : accountFamily === 'credit' ? (
        // Credit cards carry no balance, so lay them out as compact chips side by
        // side — the saved vertical space goes to the installments row below.
        <div className="flex flex-wrap gap-2">
          {familyList.map((a) => {
            const active = a.id === accountId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                className={`flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                  active
                    ? 'border-emerald bg-[var(--emerald-soft)] text-emerald-deep'
                    : 'border-border text-text'
                }`}
              >
                <AccountAvatar {...avatarOf(a)} size="sm" className="h-6 w-6 rounded" />
                <span className="max-w-[140px] truncate">{accountPrimaryName(a)}</span>
              </button>
            )
          })}
        </div>
      ) : (
        // Up to 5: one full-width row per account — name left, balance right —
        // stacked vertically. The selected one is highlighted.
        <div className="flex flex-col gap-1.5">
          {familyList.map((a) => {
            const active = a.id === accountId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccountId(a.id)}
                className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-1.5 text-left transition-colors ${
                  active
                    ? 'border-emerald bg-[var(--emerald-soft)]'
                    : 'border-border hover:bg-[var(--row-hover)]'
                }`}
                style={{ '--row-hover': ROW_HOVER } as React.CSSProperties}
              >
                <AccountAvatar {...avatarOf(a)} size="sm" />
                <span
                  className={`min-w-0 flex-1 truncate text-sm font-semibold ${
                    active ? 'text-emerald-deep' : 'text-text'
                  }`}
                >
                  {accountPrimaryName(a)}
                </span>
                {a.type !== 'credit' && (
                  <span
                    className={`shrink-0 text-xs ${active ? 'text-emerald-deep/70' : 'text-text-muted'}`}
                  >
                    {formatBalance(a)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const installmentsNum = parseInt(installments) || 1
  const showInstallmentStepper =
    customInstallments || !INSTALLMENT_OPTIONS.includes(installmentsNum)
  const stepInstallments = (delta: number) =>
    setInstallments(String(Math.max(1, Math.min(MAX_INSTALLMENTS, installmentsNum + delta))))
  const installmentChips = (
    <>
      {INSTALLMENT_OPTIONS.map((n) => {
        const active = !showInstallmentStepper && installments === String(n)
        return (
          <button
            key={n}
            type="button"
            onClick={() => {
              setCustomInstallments(false)
              setInstallments(String(n))
            }}
            className={`rounded-[10px] font-bold transition-colors ${
              isMobile ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm'
            } ${active ? 'bg-navy text-white' : 'text-text-muted'}`}
            style={active ? undefined : { backgroundColor: FIELD_BG }}
          >
            {n}×
          </button>
        )
      })}
      <button
        key="custom"
        type="button"
        onClick={() => {
          setCustomInstallments(true)
          // Open the stepper at a real installment count, never "1 cuota".
          if (installmentsNum < 2) setInstallments('2')
        }}
        className={`inline-flex items-center gap-1 rounded-[10px] font-bold transition-colors ${
          isMobile ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm'
        } ${showInstallmentStepper ? 'bg-navy text-white' : 'text-text-muted'}`}
        style={showInstallmentStepper ? undefined : { backgroundColor: FIELD_BG }}
      >
        {t('installments_options.custom')}
        <ChevronDown
          className={`size-3.5 transition-transform ${showInstallmentStepper ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
    </>
  )
  const showCuotas = !isEdit && tab === 'expense' && isCredit && currencyCode === 'ARS'
  const cuotasContent = showCuotas ? (
    <>
        {isMobile ? (
          // Mobile: label inline with the chips, no icon — one row to save space.
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-0.5 text-[13px] font-semibold text-text">{t('labels.installments')}</span>
            {installmentChips}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-9 items-center justify-center rounded-[11px] text-terracotta"
                style={{ backgroundColor: 'var(--terracotta-soft)' }}
              >
                <CreditCard className="size-[18px]" aria-hidden />
              </span>
              <span className="text-[15px] font-semibold text-text">{t('labels.installments')}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{installmentChips}</div>
          </>
        )}
        {showInstallmentStepper && (
          <div className={`flex flex-col items-center ${isMobile ? 'mt-2 gap-0.5' : 'mt-3.5 gap-1.5'}`}>
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-3'}`}>
              <button
                type="button"
                onClick={() => stepInstallments(-1)}
                disabled={installmentsNum <= 1}
                aria-label={t('installments_options.custom_decrease')}
                className={`flex items-center justify-center rounded-[10px] border border-border font-bold leading-none text-navy transition-colors enabled:hover:bg-page disabled:opacity-40 ${
                  isMobile ? 'size-7 text-base' : 'size-9 text-xl'
                }`}
                style={{ backgroundColor: FIELD_BG }}
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={installments}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  if (digits === '') return setInstallments('')
                  setInstallments(String(Math.min(MAX_INSTALLMENTS, parseInt(digits))))
                }}
                onBlur={() => {
                  if (installmentsNum < 1) setInstallments('1')
                }}
                aria-label={t('installments_options.custom_label')}
                className={`bg-transparent text-center font-bold tabular-nums text-navy outline-none ${
                  isMobile ? 'w-12 text-lg' : 'w-16 text-2xl'
                }`}
              />
              <button
                type="button"
                onClick={() => stepInstallments(1)}
                disabled={installmentsNum >= MAX_INSTALLMENTS}
                aria-label={t('installments_options.custom_increase')}
                className={`flex items-center justify-center rounded-[10px] border border-border font-bold leading-none text-navy transition-colors enabled:hover:bg-page disabled:opacity-40 ${
                  isMobile ? 'size-7 text-base' : 'size-9 text-xl'
                }`}
                style={{ backgroundColor: FIELD_BG }}
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-text-soft">
              {t('installments_options.custom_range', { max: MAX_INSTALLMENTS })}
            </p>
          </div>
        )}
        {isInstallments && perInstallment !== null && (
          <div
            className="mt-3 rounded-[11px] px-3 py-2 text-center text-[13px] text-text-muted"
            style={{ backgroundColor: FIELD_BG }}
          >
            {t('drawer.installments_breakdown', {
              count: installmentsNum,
              amount: fmtBalance(perInstallment),
            })}
          </div>
        )}
    </>
  ) : null
  // Desktop: bordered card in the body. Mobile: borderless row placed inside the
  // fieldGroup between the account and the date, so cuotas sits with the payment.
  const cuotasCard =
    cuotasContent && !isMobile ? (
      <div className="rounded-[15px] border border-border bg-card p-4">{cuotasContent}</div>
    ) : null
  const cuotasRow =
    cuotasContent && isMobile ? <div className="px-4 py-3">{cuotasContent}</div> : null

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
          {/* Editable debit account — statement payment only (getEditableFields
              gates it). The account is a pure debit pointer here, so it can move
              to any cash/bank account with the payment currency active. */}
          {editable?.account && (
            <div className="relative">
              <Popover
                modal={isDrawer}
                open={activePopover === 'account'}
                onOpenChange={(o) => setActivePopover(o ? 'account' : null)}
                trigger={
                  <FieldRow
                    icon={<Wallet className="size-[18px]" />}
                    label={t('labels.account')}
                    value={<AccountValue account={selectedAccount} />}
                  />
                }
              >
                {renderAccountPicker(
                  cashBank.filter((a) => a.activeCurrencies.includes(currencyCode)),
                  accountId,
                  (id) => {
                    setAccountId(id)
                    setActivePopover(null)
                  },
                )}
              </Popover>
            </div>
          )}
          {editable?.category && categoryRow}
          {editable?.date && dateRow}
        </>
      ) : isMobile ? (
        // Mobile-web: frequent chips + category first (it's the primary decision
        // and drives the account); the account row is hidden when a single
        // account is eligible.
        <>
          {frequentChipsRow}
          {categoryRowWrapped}
          {tab === 'expense' || tab === 'income'
            ? showAccountSelector && accountFamilyRow
            : (showAccountSelector || tab === 'transfer' || tab === 'exchange') && accountRow}
          {destinationRow}
          {cuotasRow}
          {dateRow}
        </>
      ) : (
        <>
          {accountRow}
          {destinationRow}
          {categoryRowWrapped}
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
          <MoneyCalculatorPopover seed={destinationAmount} onResult={setDestinationAmount} className="shrink-0 self-center" />
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
  // Four common counts as one-tap chips; "Otras" opens a stepper for anything
  // else (incl. 5), 1–MAX. The stepper is also shown when the current value
  // isn't a preset. Any integer ≥ 2 is valid per `registerInstallmentsSchema`.

  // ── Description ──────────────────────────────────────────────────────────────
  const isAdjustment = isEdit ? edit?.type === 'adjustment' : tab === 'adjustment'
  const descriptionInput = (className: string) => (
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
      className={className}
    />
  )
  const descriptionHints = (
    <>
      {isAdjustment && (
        <p className={`text-xs text-text-muted ${isMobile ? 'mt-1.5 pl-[26px]' : 'mt-2 pl-12'}`}>
          {t('drawer.adjust_reason_required')}
        </p>
      )}
      {!isEdit && (tab === 'income' || tab === 'expense') && descriptionHasNoHistory && selectedCategory && (
        <div className={`mt-2 ${isMobile ? 'pl-[26px]' : 'pl-12'}`}>
          <CategorySuggestionHint
            description={description}
            categoryName={getCategoryName(selectedCategory, tRoot)}
          />
        </div>
      )}
    </>
  )
  const descriptionField = isMobile ? (
    // Mobile-web: the description is optional and secondary — a slim single line
    // (small inline icon, no eyebrow, less padding) instead of the tall card.
    <div className="rounded-[15px] border border-border bg-card px-4 py-2.5" data-tour="description">
      <div className="flex items-center gap-2.5">
        <FileText className="size-4 shrink-0 text-text-soft" aria-hidden />
        {descriptionInput(
          'w-full bg-transparent text-[14px] text-text outline-none placeholder:text-text-soft/60',
        )}
      </div>
      {descriptionHints}
    </div>
  ) : (
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
          {descriptionInput(
            'w-full bg-transparent text-[15px] font-semibold text-text outline-none placeholder:font-normal placeholder:text-text-soft/60',
          )}
        </div>
      </div>
      {descriptionHints}
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

  // ── Toggles: reintegro + repetir ────────────────────────────────────────────
  // Alta: pestaña gasto. Edición: gateado a que el reintegro sea editable (gasto
  // simple/tarjeta o madre de cuotas; el pago de resumen queda excluido). El
  // estado read-only (reintegro ya recibido/cancelado) se resuelve dentro del
  // bloque: se muestra, pero sin controles de edición.
  const showReimbursementToggleCreate = !isEdit && tab === 'expense'
  const showReimbursementToggleEdit = isEdit && !!edit?.editableFields?.reimbursement
  const showReimbursementToggle = showReimbursementToggleCreate || showReimbursementToggleEdit
  // Alta: sin cambios respecto de main (hogar de 2 + pestaña gasto). Edición:
  // se agrega aparte, gateado a que el campo sea editable (gasto simple o madre
  // de cuotas; el pago de resumen queda excluido).
  const showSharedToggleEdit = isEdit && !!sharedMembers && !!edit?.editableFields?.shared
  const showSharedToggle =
    (!isEdit && tab === 'expense' && !!sharedMembers) || showSharedToggleEdit
  const showRepeatToggle =
    !isEdit && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments

  // Reimbursement account list ordered "same bank first" (the institution of
  // the payment method), for the compact mobile block's account selector.
  const reimbInstitutionId = selectedAccount?.institutionId ?? null
  const reimbAccountsOrdered = [...cashBank].sort(
    (a, b) =>
      (a.institutionId === reimbInstitutionId ? 0 : 1) -
      (b.institutionId === reimbInstitutionId ? 0 : 1),
  )
  const reimbSelectedAccount = cashBank.find((a) => a.id === reimbursementAccountId)
  // The cap "applied" when a percent is set and the derived amount was clamped
  // down to the cap (amount === cap). Used to highlight the cap in emerald.
  const reimbDigits = (s: string): string => s.replace(/\D/g, '')
  const reimbCapApplied =
    Number(reimbDigits(reimbursementPercent)) > 0 &&
    reimbDigits(reimbursementCap) !== '' &&
    reimbDigits(reimbursementCap) !== '0' &&
    reimbDigits(reimbursementAmount) === reimbDigits(reimbursementCap)
  // Reimbursement account picker content — the app's styled account list
  // (avatar + name + check), same bank first. Rendered inside a Popover so it
  // matches every other account picker in the form (no raw <select>).
  const reimbAccountPickerContent = renderAccountPicker(
    reimbAccountsOrdered,
    reimbursementAccountId,
    (id) => {
      setReimbursementAccountId(id)
      setActivePopover(null)
    },
  )

  const togglesGroup =
    showReimbursementToggle || showSharedToggle || showRepeatToggle ? (
      <div
        className={
          isMobile
            ? 'flex flex-col gap-3'
            : 'overflow-hidden rounded-[15px] border border-border bg-card [&>*+*]:border-t [&>*+*]:border-[#F1F3F6]'
        }
      >
        {isMobile && (
          <div className="flex gap-2">
            {showReimbursementToggle && (
              <AdvChip
                icon={<Undo2 aria-hidden />}
                label={t('reimbursement.chip')}
                active={reimbursementEnabled}
                disabled={reimbursementReadOnly}
                onClick={() => {
                  const on = !reimbursementEnabled
                  setReimbursementEnabled(on)
                  if (on) setReimbursementAccountId(pickReimbursementAccount(accountId))
                }}
              />
            )}
            {showSharedToggle && sharedMembers && (
              <AdvChip
                icon={<Users aria-hidden />}
                label={tShared('split.toggle_label')}
                active={sharedEnabled}
                onClick={() => setSharedEnabled(!sharedEnabled)}
              />
            )}
            {showRepeatToggle && (
              <AdvChip
                icon={<Repeat aria-hidden />}
                label={t('labels.recurrent')}
                active={isRecurrent}
                onClick={() => setIsRecurrent(!isRecurrent)}
              />
            )}
          </div>
        )}
        {showReimbursementToggle && (!isMobile || reimbursementEnabled || reimbursementReadOnly) && (
          <div className={isMobile ? 'rounded-[15px] border border-border bg-card px-4 py-3.5' : 'px-4 py-3.5'}>
            {!isMobile && (
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
                <p className="text-xs text-text-muted">
                  {reimbursementReadOnly
                    ? t(
                        edit?.reimbursement?.status === 'cancelled'
                          ? 'reimbursement.readonly_hint_cancelled'
                          : 'reimbursement.readonly_hint_received',
                      )
                    : t('reimbursement.pending_hint')}
                </p>
              </div>
              <Switch
                checked={reimbursementEnabled}
                disabled={reimbursementReadOnly}
                ariaLabel={t('reimbursement.toggle')}
                onValueChange={(on) => {
                  setReimbursementEnabled(on)
                  if (on) setReimbursementAccountId(pickReimbursementAccount(accountId))
                }}
              />
            </div>
            )}
            {reimbursementReadOnly && edit?.reimbursement && (
              <div
                className={`flex items-center justify-between gap-3 ${isMobile ? '' : 'mt-3.5 border-t pt-3.5'}`}
                style={isMobile ? undefined : { borderColor: ROW_DIVIDER }}
              >
                <span className="text-xs text-text-muted">
                  {t(`reimbursement.target.${edit.reimbursement.target}`)}
                </span>
                <span className="text-sm font-semibold text-text">
                  {CURRENCY_SYMBOL[currencyCode]}
                  {reimbursementAmount}
                </span>
              </div>
            )}
            {reimbursementEnabled && !reimbursementReadOnly && (isMobile ? (
              <div className="flex flex-col gap-2">
                {/* Fila 1 — monto + regla % / tope (compacto, visible inline) */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-9 w-28 items-center gap-1 rounded-[9px] border border-border px-2.5"
                    style={{ backgroundColor: FIELD_BG }}
                  >
                    <span className="text-sm text-text-soft">{CURRENCY_SYMBOL[currencyCode]}</span>
                    <MoneyAmountInput
                      value={reimbursementAmount}
                      onChange={(v) => {
                        setReimbursementAmount(v)
                        setReimbursementPercent('')
                      }}
                      placeholder="0"
                      className="w-full min-w-0 bg-transparent text-sm text-text outline-none"
                    />
                  </div>
                  <div
                    className="flex h-9 flex-1 items-center justify-between gap-2 rounded-[9px] border border-border px-2.5"
                    style={{ backgroundColor: FIELD_BG }}
                  >
                    <div className="flex items-center gap-0.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={reimbursementPercent}
                        onChange={(e) => {
                          const v = e.target.value.replace(',', '.')
                          setReimbursementPercent(v)
                          applyReimbursementPercent(v, reimbursementCap)
                        }}
                        placeholder="—"
                        aria-label={t('reimbursement.percent_label')}
                        className="w-8 bg-transparent text-right text-sm text-text outline-none"
                      />
                      <span className="text-sm text-text-muted">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`whitespace-nowrap text-[11px] ${
                          reimbCapApplied ? 'font-semibold text-emerald-deep' : 'text-text-soft'
                        }`}
                      >
                        {t('reimbursement.cap_short')} {CURRENCY_SYMBOL[currencyCode]}
                      </span>
                      <MoneyAmountInput
                        value={reimbursementCap}
                        onChange={(v) => {
                          setReimbursementCap(v)
                          applyReimbursementPercent(reimbursementPercent, v)
                        }}
                        placeholder="—"
                        className="w-14 bg-transparent text-sm text-text outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Fila 2 — destino (crédito: Resumen | Cuenta con el nombre adentro) +
                    estado (Acreditado), todo en una sola fila densa como el handoff. */}
                <div className="flex items-center gap-2">
                  {isCredit ? (
                    <div
                      className="flex h-9 min-w-0 flex-1 items-center gap-0.5 rounded-[9px] border border-border p-0.5"
                      style={{ backgroundColor: ROW_DIVIDER }}
                    >
                      <button
                        type="button"
                        onClick={() => setReimbursementTarget('statement')}
                        className={`flex h-full flex-none items-center justify-center rounded-[7px] px-2.5 text-[11.5px] ${
                          reimbursementTarget === 'statement'
                            ? 'bg-white font-semibold text-text shadow-[0_1px_2px_rgba(11,26,43,0.1)]'
                            : 'font-medium text-text-muted'
                        }`}
                      >
                        {t('reimbursement.target.statement_short')}
                      </button>
                      <Popover
                        modal={isDrawer}
                        open={activePopover === 'reimbAccount'}
                        onOpenChange={(o) => {
                          setActivePopover(o ? 'reimbAccount' : null)
                          if (o && reimbursementTarget !== 'account') {
                            setReimbursementTarget('account')
                            if (!reimbursementAccountId)
                              setReimbursementAccountId(pickReimbursementAccount(accountId))
                          }
                        }}
                        trigger={
                          <button
                            type="button"
                            className={`flex h-full min-w-0 flex-1 items-center justify-start gap-1 rounded-[7px] px-2.5 text-[11.5px] ${
                              reimbursementTarget === 'account'
                                ? 'bg-white font-semibold text-text shadow-[0_1px_2px_rgba(11,26,43,0.1)]'
                                : 'font-medium text-text-muted'
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-left">
                              {reimbursementTarget === 'account' && reimbSelectedAccount
                                ? accountPrimaryName(reimbSelectedAccount)
                                : t('reimbursement.target.account_short')}
                            </span>
                            <ChevronDown className="size-3.5 shrink-0 text-text-soft" aria-hidden />
                          </button>
                        }
                      >
                        {reimbAccountPickerContent}
                      </Popover>
                    </div>
                  ) : cashBank.length > 1 ? (
                    <Popover
                      modal={isDrawer}
                      open={activePopover === 'reimbAccount'}
                      onOpenChange={(o) => setActivePopover(o ? 'reimbAccount' : null)}
                      trigger={
                        <button
                          type="button"
                          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-border px-2.5 text-left"
                          style={{ backgroundColor: FIELD_BG }}
                        >
                          {reimbSelectedAccount && (
                            <AccountAvatar
                              {...avatarOf(reimbSelectedAccount)}
                              size="sm"
                              className="h-5 w-5 rounded"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs text-text">
                            {reimbSelectedAccount
                              ? accountPrimaryName(reimbSelectedAccount)
                              : t('reimbursement.credit_to_placeholder')}
                          </span>
                          <ChevronDown className="size-3.5 shrink-0 text-text-soft" aria-hidden />
                        </button>
                      }
                    >
                      {reimbAccountPickerContent}
                    </Popover>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-text-soft">
                      {reimbSelectedAccount ? accountPrimaryName(reimbSelectedAccount) : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={reimbursementReceivedNow}
                    onClick={() => setReimbursementReceivedNow(!reimbursementReceivedNow)}
                    className="flex flex-none items-center gap-1.5"
                  >
                    <span
                      className={`flex size-[18px] items-center justify-center rounded-[6px] border ${
                        reimbursementReceivedNow ? 'border-transparent bg-emerald' : 'border-[#D9DEE5] bg-card'
                      }`}
                    >
                      {reimbursementReceivedNow && (
                        <Check className="size-3 text-white" strokeWidth={3.2} aria-hidden />
                      )}
                    </span>
                    <span
                      className={`text-xs ${
                        reimbursementReceivedNow ? 'font-semibold text-emerald-deep' : 'text-text-muted'
                      }`}
                    >
                      {t('reimbursement.received_short')}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex flex-col gap-3 ${isMobile ? '' : 'mt-3.5 border-t pt-3.5'}`}
                style={isMobile ? undefined : { borderColor: ROW_DIVIDER }}
              >
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
                      {cashBank.map((a) => {
                        const secondary = accountSecondaryName(a)
                        return (
                          <option key={a.id} value={a.id}>
                            {accountPrimaryName(a)}
                            {secondary ? ` · ${secondary}` : ''}
                          </option>
                        )
                      })}
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
            ))}
          </div>
        )}

        {showSharedToggle && sharedMembers && (!isMobile || sharedEnabled) && (
          <div className={isMobile ? 'rounded-[15px] border border-border bg-card px-4 py-3.5' : 'px-4 py-3.5'}>
            {!isMobile && (
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
            )}
            {sharedEnabled && (
              <div
                className={`flex flex-col gap-3 ${isMobile ? '' : 'mt-3.5 border-t pt-3.5'}`}
                style={{ borderColor: ROW_DIVIDER }}
              >
                {!fullyOther && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-text-muted">{tShared('split.title')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text">{sharedMembers[0].fullName}</span>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={splitDraft ?? String(splitFirstPct)}
                          onChange={(e) => {
                            // Allow an empty field while editing; only commit a
                            // clamped value once there are digits to parse.
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
                            setSplitDraft(raw)
                            if (raw !== '') {
                              setSplitFirstPct(Math.max(1, Math.min(99, parseInt(raw, 10))))
                            }
                          }}
                          onBlur={() => setSplitDraft(null)}
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
                {/* Edge affordance: the payer covers a cost that is entirely the
                    other member's (0/100). Reachable only here — the % field stays
                    1..99. */}
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">
                      {tShared('split.fully_other_label', { name: sharedMembers[1].fullName })}
                    </p>
                    <p className="text-xs text-text-muted">
                      {tShared('split.fully_other_hint', { name: sharedMembers[1].fullName })}
                    </p>
                  </div>
                  <Switch
                    checked={fullyOther}
                    ariaLabel={tShared('split.fully_other_label', { name: sharedMembers[1].fullName })}
                    onValueChange={setFullyOther}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {showRepeatToggle && (!isMobile || isRecurrent) && (
          <div className={isMobile ? 'rounded-[15px] border border-border bg-card px-4 py-3.5' : 'px-4 py-3.5'}>
            {!isMobile && (
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
            )}
            {isRecurrent && (
              <div
                className={`flex flex-col gap-3 ${isMobile ? '' : 'mt-3.5 border-t pt-3.5'}`}
                style={isMobile ? undefined : { borderColor: ROW_DIVIDER }}
              >
                <div
                  className="flex items-start gap-2.5 rounded-[11px] p-3"
                  style={{ backgroundColor: 'var(--emerald-soft)' }}
                >
                  <Lightbulb
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: 'var(--emerald-deep)' }}
                    aria-hidden
                  />
                  <p className="text-[12.5px] leading-relaxed text-text">{t('drawer.repeat_hint')}</p>
                </div>
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
                  <div className="w-44">
                    <DatePicker
                      id="recurrence-until"
                      value={recurrenceEndDate}
                      onChange={setRecurrenceEndDate}
                      min={date}
                      modal={isDrawer}
                      label={t('drawer.repeat_until')}
                    />
                  </div>
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
  // Both create and edit use the library Button (primary emerald), so the CTA
  // always matches the component library — same as the cuenta/tarjeta drawers.
  const submitButton = (
    <Button
      type="submit"
      variant="primary"
      loading={isPending}
      data-tour={isEdit ? undefined : 'submit'}
      className="h-[52px] flex-1 rounded-[14px] text-[15.5px] font-bold tracking-[-0.01em]"
    >
      {ctaLabel}
    </Button>
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
        <header className="shrink-0 border-b border-border bg-card px-5 pb-4 pt-[22px] sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {showEyebrow && (
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-soft">{eyebrow}</p>
              )}
              <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-text sm:text-[25px]">
                {headerTitle}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4">{body}</div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7">
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
