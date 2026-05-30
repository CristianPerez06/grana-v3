'use client'

import { forwardRef, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Plus,
  Repeat,
  Scale,
  Tag,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Popover } from '@/components/ui/popover'
import { getTodayAR } from '@/lib/date'
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
  suggestReimbursementAmount,
  type EditableFields,
  type MovementType,
} from '@grana/money-logic'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { CategorySuggestionChip } from '@/lib/transactions/components/category-suggestion-chip'
import { CategorySuggestionHint } from '@/lib/transactions/components/category-suggestion-hint'
import { normalizeDescription, type CategorySuggestion } from '@/lib/transactions/category-suggestion'
import type { CategoryWithSubcategories } from '@/lib/categories/types'

const todayStr = () => {
  const d = getTodayAR()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Tab = 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'

export type MovementFormAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  activeCurrencies: ('ARS' | 'USD')[]
  /** Current available balance per currency. {0,0} for credit (off-ledger). */
  balances: Record<'ARS' | 'USD', number>
  /** Owning institution, used to default the reimbursement credit-to account. */
  institutionId: string | null
  /** Visual identity resolved server-side; drives the row avatar in the drawer. */
  avatar?: ResolvedAccountAvatar
}

/**
 * Edit context built by the server page from an existing transaction. Its
 * presence flips the form into edit mode: tabs hidden, type/currency/account(s)
 * shown as immutable context, fields gated by `editableFields`, submit routed
 * to the `updateX` actions. `signedAmount` is the original signed amount (for
 * the adjustment direction and the negative-balance baseline); `availableBalance`
 * is the movement's own account balance in the movement currency.
 */
export type MovementEditContext = {
  id: string
  type: MovementType
  /** Card lifecycle status; non-null ⇒ off-ledger card movement (never warns). */
  status: 'pending' | 'paid' | null
  accountId: string
  destinationAccountId: string | null
  isParent: boolean
  amount: number
  signedAmount: number
  date: string
  currencyCode: 'ARS' | 'USD'
  destinationCurrency: 'ARS' | 'USD' | null
  destinationAmount: number | null
  categoryId: string | null
  subcategoryId: string | null
  description: string | null
  installmentsTotal: number | null
  sourceAccountName: string | null
  destinationAccountName: string | null
  editableFields: EditableFields
  availableBalance: number
  returnHref: string
}

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  /** Edit mode when present. Absent ⇒ create mode. */
  edit?: MovementEditContext
  /** Create mode: pre-select this account (e.g. arriving from a card/account). */
  preselectAccountId?: string
  /** Create mode: where to return after saving. Defaults to `/transactions`. */
  createReturnHref?: string
  /**
   * When provided, the form is hosted in a drawer: after a successful save it
   * refreshes the route and calls `onSuccess` (to close the drawer) instead of
   * navigating to `returnHref`. Page usage omits it and keeps navigating.
   */
  onSuccess?: () => void
  /**
   * Presentation chrome. `'drawer'` renders the hi-fi shell (fixed header with
   * eyebrow/title/close + scroll body + fixed footer CTA). `'page'` (default)
   * renders the same body inline for the standalone `/new` and `/edit` routes,
   * where the page already provides its own header.
   */
  variant?: 'page' | 'drawer'
  /** Drawer chrome: close handler for the header ✕ and footer cancel paths. */
  onClose?: () => void
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24]

// Accounts eligible per type: only Gasto can target a credit card.
const eligibleFor = (accounts: MovementFormAccount[], tab: Tab) =>
  tab === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')

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
  createReturnHref,
  onSuccess,
  variant = 'page',
  onClose,
}: Props) => {
  const router = useRouter()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const tRec = useTranslations('recurrences')
  const isEdit = edit !== undefined
  const editable = edit?.editableFields
  const returnHref = edit?.returnHref ?? createReturnHref ?? '/transactions'

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
  const [isPending, startTransition] = useTransition()

  // Create-mode pre-selection: a credit card can only receive a Gasto.
  const preselect = preselectAccountId
    ? accounts.find((a) => a.id === preselectAccountId)
    : undefined
  // Create mode defaults to Gasto (the most frequent movement); edit keeps its type.
  const initialTab: Tab = edit?.type ?? 'expense'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [formError, setFormError] = useState<string | null>(null)

  const firstFor = (t: Tab) => eligibleFor(accounts, t)[0]

  const [accountId, setAccountId] = useState(
    edit?.accountId ?? preselect?.id ?? firstFor(initialTab)?.id ?? accounts[0]?.id ?? '',
  )
  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(
    edit?.currencyCode ?? preselect?.activeCurrencies[0] ?? firstFor(initialTab)?.activeCurrencies[0] ?? 'ARS',
  )
  const [amount, setAmount] = useState(edit ? String(edit.amount) : '')
  const [date, setDate] = useState(edit?.date ?? todayStr())
  const [description, setDescription] = useState(edit?.description ?? '')

  const [categoryId, setCategoryId] = useState(edit?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState(edit?.subcategoryId ?? '')
  // Capa 1 del autocategorizador: sugerencia por historial (chip, no auto-fill).
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null)
  // True once a blur lookup confirms the current (normalizable) description has
  // NO history match — the precondition for the pedagogical hint.
  const [descriptionHasNoHistory, setDescriptionHasNoHistory] = useState(false)

  const [destinationAccountId, setDestinationAccountId] = useState(edit?.destinationAccountId ?? '')
  // Exchange: received-leg amount. Destination currency is derived (the other
  // currency the destination account holds, ≠ source currency).
  const [destinationAmount, setDestinationAmount] = useState(
    edit?.destinationAmount != null ? String(edit.destinationAmount) : '',
  )

  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(
    edit && edit.type === 'adjustment' && edit.signedAmount < 0 ? 'decrease' : 'increase',
  )

  const [installments, setInstallments] = useState('1')
  const [fxRate, setFxRate] = useState('')

  const [isRecurrent, setIsRecurrent] = useState(false)
  const [frequency, setFrequency] = useState<
    'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom'
  >('monthly')
  // Custom frequency: "every N units", with an optional cap on occurrences.
  const [intervalCount, setIntervalCount] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState<'day' | 'week' | 'month' | 'year'>('month')
  // Optional "repeat until" end date for the recurrence (any frequency).
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  // Reimbursement (reintegro / cashback) declared with the expense.
  const [reimbursementEnabled, setReimbursementEnabled] = useState(false)
  const [reimbursementTarget, setReimbursementTarget] = useState<'account' | 'statement'>('account')
  const [reimbursementAmount, setReimbursementAmount] = useState('')
  const [reimbursementReceivedNow, setReimbursementReceivedNow] = useState(false)
  // Optional carry helper: compute the reimbursement amount as a % of the
  // expense (capped). UI-only — only the resulting amount is persisted.
  const [reimbursementPercent, setReimbursementPercent] = useState('')
  const [reimbursementCap, setReimbursementCap] = useState('')

  // Recompute the suggested reimbursement amount from %/cap and the expense amount.
  const applyReimbursementPercent = (percentStr: string, capStr: string) => {
    const expense = parseMoneyInput(amount)
    const percent = parseMoneyInput(percentStr)
    if (expense === null || expense <= 0 || percent === null || percent <= 0) return
    const cap = parseMoneyInput(capStr)
    const suggested = suggestReimbursementAmount(expense, percent, cap ?? undefined)
    setReimbursementAmount(String(suggested))
  }
  // Default the credit-to account to a bank account of the SAME institution as
  // the expense account (paying with Visa Comafi → reimbursement to Comafi bank).
  const pickReimbursementAccount = (expenseAccountId: string): string => {
    const expenseAccount = accounts.find((a) => a.id === expenseAccountId)
    const inst = expenseAccount?.institutionId ?? null
    const cashBankAccounts = accounts.filter((a) => a.type !== 'credit')
    const match = inst ? cashBankAccounts.find((a) => a.institutionId === inst) : undefined
    return match?.id ?? cashBankAccounts[0]?.id ?? ''
  }
  const [reimbursementAccountId, setReimbursementAccountId] = useState('')

  // UI-only state for the hi-fi shell.
  const isDrawer = variant === 'drawer'
  // Only one popover open at a time: 'account' | 'destination' | 'category' | 'date'.
  const [activePopover, setActivePopover] = useState<string | null>(null)
  // Category popover drill: the category whose subcategories are being shown.
  const [catDrill, setCatDrill] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // "+ Otro": when true, a successful save resets amount+description and keeps
  // the drawer open (instead of closing) and refocuses the amount.
  const addAnotherRef = useRef(false)

  // Autofocus the amount after the drawer slide-in settles (≈360ms), matching
  // the prototype. On the page variant focus lands immediately.
  useEffect(() => {
    if (amount !== '' && isEdit) return
    const delay = isDrawer ? 360 : 0
    const id = setTimeout(() => amountRef.current?.focus(), delay)
    return () => clearTimeout(id)
    // Run once per mount (the drawer remounts the form on each open via `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (accounts.length === 0 && !isEdit) {
    return (
      <p className="text-sm text-muted-foreground">{t('empty.no_accounts')}</p>
    )
  }

  const eligibleAccounts = eligibleFor(accounts, tab)
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? eligibleAccounts[0]
  const isCredit = selectedAccount?.type === 'credit'
  const activeCurrencies = selectedAccount?.activeCurrencies ?? ['ARS']

  const cashBank = accounts.filter((a) => a.type !== 'credit')

  // Transfer destinations: the other cash/bank accounts.
  const otherAccounts = cashBank.filter((a) => a.id !== selectedAccount?.id)
  const destinationAccount = otherAccounts.find((a) => a.id === destinationAccountId)
  const sharedCurrencies = destinationAccount
    ? activeCurrencies.filter((c) => destinationAccount.activeCurrencies.includes(c))
    : []

  // Exchange: destination account may be ANY cash/bank (including the source
  // account itself). The destination currency is derived as the other currency
  // that account holds (≠ source currency).
  const exchangeDestAccount = cashBank.find((a) => a.id === destinationAccountId)
  const exchangeDestCurrency =
    exchangeDestAccount?.activeCurrencies.find((c) => c !== currencyCode) ?? null

  const isInstallments = isCredit && currencyCode === 'ARS' && parseInt(installments) >= 2
  const isUSDCard = isCredit && currencyCode === 'USD'

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  const effectiveCurrency = !isEdit && tab === 'transfer'
    ? (sharedCurrencies.includes(currencyCode) ? currencyCode : sharedCurrencies[0] ?? currencyCode)
    : currencyCode

  // Soft, non-blocking warning. Outflows only, cash/bank only (credit is off-ledger).
  // Plain computation (not a hook): it runs after the early return above.
  const negativeWarning = ((): { projected: number; currency: 'ARS' | 'USD' } | null => {
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null

    if (isEdit && edit) {
      // Credit movements (status pending/paid) are off-ledger; the parent has no
      // account. The baseline excludes this movement's own current effect so an
      // edit doesn't "warn against itself".
      if (edit.isParent) return null
      // Credit-card movements (status pending/paid) are off-ledger → never warn.
      if (edit.status !== null) return null
      const { type } = edit
      if (type !== 'expense' && type !== 'transfer' && type !== 'adjustment' && type !== 'exchange') {
        return null
      }
      const currency = edit.currencyCode
      const current = edit.availableBalance
      let baseline: number
      let outflow: number
      if (type === 'adjustment') {
        baseline = Money.toNumber(Money.subtract(Money.from(current), Money.from(edit.signedAmount)))
        outflow = adjustmentDirection === 'decrease' ? parsed : 0
      } else {
        baseline = Money.toNumber(Money.add(Money.from(current), Money.from(edit.signedAmount)))
        outflow = parsed
      }
      const check = checkNegativeBalance(baseline, outflow)
      return check.negative ? { projected: check.projected, currency } : null
    }

    if (!selectedAccount || selectedAccount.type === 'credit') return null
    let currency: 'ARS' | 'USD'
    if (tab === 'expense') currency = currencyCode
    else if (tab === 'transfer') currency = effectiveCurrency
    else if (tab === 'exchange') currency = currencyCode
    else if (tab === 'adjustment' && adjustmentDirection === 'decrease') currency = currencyCode
    else return null

    const check = checkNegativeBalance(selectedAccount.balances[currency] ?? 0, parsed)
    return check.negative ? { projected: check.projected, currency } : null
  })()

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setCategoryId('')
    setSubcategoryId('')
    setSuggestion(null)
    setDescriptionHasNoHistory(false)
    setFormError(null)
    setInstallments('1')
    setFxRate('')
    // Keep the account if still eligible, otherwise jump to the first eligible one.
    const eligible = eligibleFor(accounts, t)
    const srcId = eligible.some((a) => a.id === accountId) ? accountId : eligible[0]?.id ?? ''
    if (srcId !== accountId) {
      setAccountId(srcId)
      const next = accounts.find((a) => a.id === srcId)
      if (next && !next.activeCurrencies.includes(currencyCode)) {
        setCurrencyCode(next.activeCurrencies[0] ?? 'ARS')
      }
    }
    if (t === 'exchange') {
      // Default to converting within the same account (the common case).
      setDestinationAccountId(srcId)
      setDestinationAmount('')
    }
  }

  const handleAccountChange = (id: string) => {
    setAccountId(id)
    setInstallments('1')
    setFxRate('')
    const account = accounts.find((a) => a.id === id)
    if (account && !account.activeCurrencies.includes(currencyCode)) {
      setCurrencyCode(account.activeCurrencies[0] ?? 'ARS')
    }
    // Re-default the reimbursement credit-to account to the new account's institution.
    setReimbursementAccountId(pickReimbursementAccount(id))
  }

  const handleDestinationChange = (id: string) => {
    setDestinationAccountId(id)
    const dest = otherAccounts.find((a) => a.id === id)
    if (dest) {
      const shared = activeCurrencies.filter((c) => dest.activeCurrencies.includes(c))
      if (shared.length > 0 && !shared.includes(currencyCode)) setCurrencyCode(shared[0])
    }
  }

  // History-based category suggestion + pedagogical hint: on description blur
  // (income/expense), look up the user's last category for this description. A
  // match feeds the chip (Capa 1); no match for a normalizable description arms
  // the hint, which fires once a category is chosen. Chip and hint are mutually
  // exclusive (chip needs no category yet; hint needs one). Create mode only.
  const handleDescriptionBlur = async () => {
    if (isEdit || (tab !== 'income' && tab !== 'expense')) {
      setSuggestion(null)
      setDescriptionHasNoHistory(false)
      return
    }
    const result = await suggestCategoryFromHistory(description, tab)
    setSuggestion(result)
    setDescriptionHasNoHistory(result === null && normalizeDescription(description) !== null)
  }

  const applySuggestion = () => {
    if (!suggestion) return
    setCategoryId(suggestion.categoryId)
    setSubcategoryId(suggestion.subcategoryId ?? '')
    setSuggestion(null)
  }

  const submitEdit = (e: React.FormEvent) => {
    if (!edit) return
    e.preventDefault()
    setFormError(null)

    let parsedAmount: number | null = null
    if (editable?.amount) {
      parsedAmount = parseMoneyInput(amount)
      if (parsedAmount === null || parsedAmount <= 0) {
        setFormError(t('errors.amount_positive'))
        return
      }
    }

    let parsedDestinationAmount: number | null = null
    if (editable?.destinationAmount) {
      parsedDestinationAmount = parseMoneyInput(destinationAmount)
      if (parsedDestinationAmount === null || parsedDestinationAmount <= 0) {
        setFormError(t('errors.destination_amount_positive'))
        return
      }
    }

    startTransition(async () => {
      let result

      if (edit.isParent) {
        result = await updateInstallmentParent(edit.id, {
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
          ...(editable?.amount && parsedAmount !== null ? { amount: parsedAmount } : {}),
        })
      } else if (edit.type === 'transfer') {
        result = await updateTransfer(edit.id, edit.accountId, edit.destinationAccountId ?? '', {
          amount: parsedAmount!,
          date,
          description: description || null,
        })
      } else if (edit.type === 'adjustment') {
        const signed =
          adjustmentDirection === 'decrease' ? -Math.abs(parsedAmount!) : Math.abs(parsedAmount!)
        result = await updateAdjustment(edit.id, edit.accountId, {
          amount: signed,
          date,
          description: description || null,
        })
      } else if (edit.type === 'exchange') {
        result = await updateExchange(edit.id, edit.accountId, edit.destinationAccountId ?? '', {
          amount: parsedAmount!,
          destination_amount: parsedDestinationAmount!,
          date,
          description: description || null,
        })
      } else {
        // income / expense (incl. credit-card consumption). A paid consumption
        // locks amount/date — send only category/description.
        result = await updateTransaction(edit.id, edit.accountId, {
          ...(editable?.amount && parsedAmount !== null ? { amount: parsedAmount, date } : {}),
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed_short'))
        return
      }
      if (onSuccess) {
        router.refresh()
        onSuccess()
      } else {
        router.push(returnHref)
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    if (isEdit) {
      submitEdit(e)
      return
    }
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('errors.amount_positive'))
      return
    }
    if ((tab === 'income' || tab === 'expense') && !categoryId) {
      setFormError(t('errors.category_required_short'))
      return
    }
    if (tab === 'transfer' && !destinationAccountId) {
      setFormError(t('errors.destination_required_short'))
      return
    }
    let parsedDestinationAmount: number | null = null
    if (tab === 'exchange') {
      if (!destinationAccountId) {
        setFormError(t('errors.destination_required_short'))
        return
      }
      if (!exchangeDestCurrency) {
        setFormError(t('errors.destination_account_no_other_currency'))
        return
      }
      parsedDestinationAmount = parseMoneyInput(destinationAmount)
      if (parsedDestinationAmount === null || parsedDestinationAmount <= 0) {
        setFormError(t('errors.destination_amount_positive'))
        return
      }
    }
    const parsedFxRate = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : undefined
    if (isUSDCard && (parsedFxRate === null || parsedFxRate === undefined || parsedFxRate <= 0)) {
      setFormError(t('errors.exchange_rate_invalid'))
      return
    }

    // Declared reimbursement (expense tab, non-installment). Pending by default,
    // or received now ("ya me lo acreditaron").
    let reimbursementDecl:
      | {
          target: 'account' | 'statement'
          estimated_amount: number
          account_id: string
          received_now: boolean
        }
      | undefined
    if (reimbursementEnabled && tab === 'expense' && !isInstallments) {
      const parsedReimb = parseMoneyInput(reimbursementAmount)
      if (parsedReimb === null || parsedReimb <= 0) {
        setFormError(t('reimbursement.errors.amount_positive'))
        return
      }
      // "En resumen" only exists on a card expense; otherwise force "a cuenta".
      const reimbTarget = isCredit ? reimbursementTarget : 'account'
      const reimbAccount = reimbTarget === 'statement' ? accountId : reimbursementAccountId
      if (!reimbAccount) {
        setFormError(t('reimbursement.errors.account_required'))
        return
      }
      reimbursementDecl = {
        target: reimbTarget,
        estimated_amount: parsedReimb,
        account_id: reimbAccount,
        received_now: reimbursementReceivedNow,
      }
    }

    startTransition(async () => {
      let result

      if (tab === 'income') {
        result = await createIncome({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
        })
      } else if (tab === 'transfer') {
        result = await createTransfer({
          account_id: accountId,
          transfer_destination_account_id: destinationAccountId,
          currency_code: effectiveCurrency,
          amount: parsedAmount,
          date,
          description: description || undefined,
        })
      } else if (tab === 'adjustment') {
        const signedAmount =
          adjustmentDirection === 'decrease' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount)
        result = await createAdjustment({
          account_id: accountId,
          currency_code: currencyCode,
          amount: signedAmount,
          date,
          description: description || undefined,
        })
      } else if (tab === 'exchange') {
        result = await createExchange({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          transfer_destination_account_id: destinationAccountId,
          destination_currency: exchangeDestCurrency!,
          destination_amount: parsedDestinationAmount!,
          date,
          description: description || undefined,
        })
      } else if (isCredit) {
        // Gasto en tarjeta de crédito → consumo.
        if (isInstallments) {
          result = await registerInstallments({
            account_id: accountId,
            currency_code: 'ARS',
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            installments_total: parseInt(installments),
          })
        } else {
          result = await registerCardPurchase({
            account_id: accountId,
            currency_code: currencyCode,
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            fx_rate_to_ars: parsedFxRate ?? undefined,
            reimbursement: reimbursementDecl,
          })
        }
      } else {
        result = await createExpense({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId || undefined,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
          reimbursement: reimbursementDecl,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      // Recurrence: not for adjustments nor for installment purchases.
      if (isRecurrent && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments && 'id' in result && result.id) {
        const trimmedEnd = recurrenceEndDate.trim()
        const recurrenceResult = await createRecurrenceFromMovement({
          transaction_id: result.id,
          frequency,
          ...(frequency === 'custom'
            ? { interval_count: intervalCount, interval_unit: intervalUnit }
            : {}),
          ...(trimmedEnd !== '' ? { end_date: trimmedEnd } : {}),
        })
        if (!recurrenceResult.ok) {
          setFormError(
            t('errors.recurrence_failed', {
              detail: recurrenceResult.formError ?? t('errors.recurrence_unknown_error'),
            }),
          )
          return
        }
      }

      // "+ Otro": keep the drawer open, clear amount + description (keep type,
      // account, date, currency), refresh the list and refocus the amount.
      if (addAnotherRef.current) {
        addAnotherRef.current = false
        router.refresh()
        setAmount('')
        setDescription('')
        setSuggestion(null)
        setDescriptionHasNoHistory(false)
        setReimbursementEnabled(false)
        setIsRecurrent(false)
        setRecurrenceEndDate('')
        setFormError(null)
        setTimeout(() => amountRef.current?.focus(), 0)
        return
      }

      if (onSuccess) {
        router.refresh()
        onSuccess()
      } else {
        router.push(returnHref)
      }
    })
  }

  const currencyOptions = tab === 'transfer'
    ? (sharedCurrencies.length > 0 ? sharedCurrencies : activeCurrencies)
    : activeCurrencies

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

  const subcategoryName =
    selectedCategory?.subcategories.find((s) => s.id === subcategoryId)?.name ?? null

  const pickCategory = (catId: string, subId: string) => {
    setCategoryId(catId)
    setSubcategoryId(subId)
    setSuggestion(null)
    setDescriptionHasNoHistory(false)
    setCatDrill(null)
    setActivePopover(null)
  }

  const handleSwap = () => {
    setAccountId(destinationAccountId)
    setDestinationAccountId(accountId)
  }

  const handleAddAnother = () => {
    addAnotherRef.current = true
    formRef.current?.requestSubmit()
  }

  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    const idx = currencyOptions.indexOf(effectiveCurrency)
    const next = currencyOptions[(idx + 1) % currencyOptions.length]
    setCurrencyCode(next)
    setInstallments('1')
    setFxRate('')
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
          {drillCategory.name}
        </span>
      </button>
      <button
        type="button"
        onClick={() => pickCategory(drillCategory.id, '')}
        className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
      >
        {drillCategory.color && (
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: drillCategory.color }} />
        )}
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
          <span className="size-3 shrink-0 rounded-full opacity-70" style={{ backgroundColor: drillCategory.color ?? '#9CA3AF' }} />
          <span className="flex-1 truncate text-sm text-text">{s.name}</span>
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
            {c.color && <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />}
            <span className="flex-1 truncate text-sm font-medium text-text">
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
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
      {selectedCategory.color && (
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
      )}
      <span className="truncate">
        {selectedCategory.icon ? `${selectedCategory.icon} ` : ''}
        {selectedCategory.name}
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
    <Segmented
      ariaLabel={t('labels.type')}
      value={tab}
      onValueChange={(v) => handleTabChange(v as Tab)}
      options={(['expense', 'income', 'transfer', 'adjustment', 'exchange'] as Tab[]).map((k) => ({
        value: k,
        label: TAB_LABELS[k],
        disabled: isEdit,
      }))}
    />
  )

  // ── Amount hero ─────────────────────────────────────────────────────────────
  const showAmountHero = isEdit ? editable?.amount : true
  const hero = showAmountHero ? (
    <div className="rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
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
          <div className="relative">
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
                handleAccountChange(id)
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
                    handleDestinationChange(id)
                    setActivePopover(null)
                  })
                : renderAccountPicker(cashBank, destinationAccountId, (id) => {
                    setDestinationAccountId(id)
                    setActivePopover(null)
                  })}
            </Popover>
          )}

          {/* Category (income / expense) */}
          {(tab === 'income' || tab === 'expense') && categoryRow}

          {/* Date (always) */}
          {dateRow}
        </>
      )}
    </div>
  )

  // ── Exchange: no-other-currency hint + received amount ──────────────────────
  const exchangeReceived =
    (!isEdit && tab === 'exchange' && exchangeDestCurrency) || (isEdit && editable?.destinationAmount) ? (
      <div className="rounded-[15px] border border-border bg-card px-4 py-3">
        <label htmlFor="exchange-dest-amount" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
          {t('labels.exchange_received')} ({isEdit ? edit?.destinationCurrency : exchangeDestCurrency})
        </label>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold text-text-soft">
            {CURRENCY_SYMBOL[(isEdit ? edit?.destinationCurrency : exchangeDestCurrency) ?? 'USD']}
          </span>
          <MoneyAmountInput
            id="exchange-dest-amount"
            required
            value={destinationAmount}
            onChange={setDestinationAmount}
            placeholder="0,00"
            className="w-full min-w-0 bg-transparent text-2xl font-bold tabular-nums text-text outline-none placeholder:text-text-soft/40"
          />
        </div>
      </div>
    ) : null

  const exchangeNoCurrencyHint =
    !isEdit && tab === 'exchange' && !exchangeDestCurrency ? (
      <p className="text-sm text-text-muted">
        {t('exchange.no_other_currency_hint', { currency: currencyCode === 'ARS' ? 'USD' : 'ARS' })}
      </p>
    ) : null

  // ── FX rate (create + Gasto + USD card) ─────────────────────────────────────
  const fxRateField =
    !isEdit && tab === 'expense' && isUSDCard ? (
      <div className="rounded-[15px] border border-border bg-card px-4 py-3">
        <label htmlFor="fx_rate" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
          {t('labels.fx_rate_label')}
        </label>
        <MoneyAmountInput
          id="fx_rate"
          required
          value={fxRate}
          onChange={setFxRate}
          placeholder={t('labels.fx_rate_daily')}
          className="mt-1 w-full bg-transparent text-[15px] font-semibold text-text outline-none placeholder:text-text-soft/50"
        />
      </div>
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
    <div className="rounded-[15px] border border-border bg-card px-4 py-3">
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
          <CategorySuggestionHint description={description} categoryName={selectedCategory.name} />
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
  const showRepeatToggle =
    !isEdit && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments

  const togglesGroup =
    showReimbursementToggle || showRepeatToggle ? (
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
      {fxRateField}
      {cuotasCard}
      {descriptionField}
      {adjustmentPreviewRow}
      {togglesGroup}
    </>
  )

  // ── Footer buttons ───────────────────────────────────────────────────────────
  const submitButton = (
    <button
      type="submit"
      disabled={isPending}
      className={`flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold text-white transition-opacity disabled:opacity-50 ${
        tab === 'income'
          ? 'bg-emerald shadow-[0_8px_20px_-4px_rgba(16,185,129,0.35)]'
          : 'bg-navy shadow-[0_8px_20px_-4px_rgba(11,26,43,0.30)]'
      }`}
    >
      {ctaLabel}
      {!isEdit && <kbd className="hidden font-semibold opacity-70 sm:inline">⌘↵</kbd>}
    </button>
  )

  const otroButton = !isEdit ? (
    <button
      type="button"
      onClick={handleAddAnother}
      disabled={isPending}
      className="flex h-[52px] shrink-0 items-center gap-1.5 rounded-[14px] border border-border bg-card px-4 text-sm font-bold text-text-muted transition-colors hover:bg-border-soft disabled:opacity-50"
    >
      <Plus className="size-4" aria-hidden />
      {t('drawer.add_another')}
    </button>
  ) : null

  // ── Render: drawer shell vs inline page ─────────────────────────────────────
  if (isDrawer) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex min-h-0 flex-1 flex-col">
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
          <div className="flex gap-3">
            {submitButton}
            {otroButton}
          </div>
        </footer>
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex flex-col gap-4">
      {typeSelector}
      {body}
      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <div className="flex gap-3">
        {submitButton}
        {otroButton}
      </div>
    </form>
  )
}
