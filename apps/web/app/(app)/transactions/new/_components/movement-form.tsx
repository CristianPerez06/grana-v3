'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
import { getEditableFields, type EditableFields, type MovementType } from '@grana/money-logic'
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
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24]

// Accounts eligible per type: only Gasto can target a credit card.
const eligibleFor = (accounts: MovementFormAccount[], tab: Tab) =>
  tab === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')

export const MovementForm = ({
  accounts,
  categories,
  edit,
  preselectAccountId,
  createReturnHref,
}: Props) => {
  const router = useRouter()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
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
  const initialTab: Tab = edit?.type ?? (preselect?.type === 'credit' ? 'expense' : 'income')

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
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'annual'>('monthly')

  // Reimbursement (reintegro / cashback) declared with the expense.
  const [reimbursementEnabled, setReimbursementEnabled] = useState(false)
  const [reimbursementTarget, setReimbursementTarget] = useState<'account' | 'statement'>('account')
  const [reimbursementAmount, setReimbursementAmount] = useState('')
  const [reimbursementReceivedNow, setReimbursementReceivedNow] = useState(false)
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
  const creditCards = accounts.filter((a) => a.type === 'credit')

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
      router.push(returnHref)
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
        const recurrenceResult = await createRecurrenceFromMovement({
          transaction_id: result.id,
          frequency,
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

      router.push(returnHref)
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Type tabs (create only) ────────────────────────────────────────── */}
      {!isEdit && (
        <div className="flex rounded-md border border-border p-0.5 w-fit flex-wrap gap-y-1">
          {(['income', 'expense', 'transfer', 'adjustment', 'exchange'] as Tab[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => handleTabChange(tabKey)}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                tab === tabKey ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      )}

      {/* ── Immutable context (edit only) ──────────────────────────────────── */}
      {isEdit && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
          {contextRows.map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="text-right">
                {row.value}
                <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Account (create only — immutable in edit, shown in context) ─────── */}
      {!isEdit && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="account" className="text-sm font-medium">
            {tab === 'transfer' || tab === 'exchange' ? t('labels.source_account') : t('labels.account')}
          </label>
          <select
            id="account"
            value={selectedAccount?.id ?? ''}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cashBank.length > 0 && (
              <optgroup label={t('account_groups.cash_bank')}>
                {cashBank.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {formatBalance(a)}</option>
                ))}
              </optgroup>
            )}
            {tab === 'expense' && creditCards.length > 0 && (
              <optgroup label={t('account_groups.credit_cards')}>
                {creditCards.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* ── Transfer: destination account (create only) ────────────────────── */}
      {!isEdit && tab === 'transfer' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="destination" className="text-sm font-medium">
            {t('labels.destination_account')} <span className="text-destructive">*</span>
          </label>
          {otherAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('errors.no_other_accounts')}</p>
          ) : (
            <select
              id="destination"
              required
              value={destinationAccountId}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('placeholders.destination_account')}</option>
              {otherAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Currency (create only) ─────────────────────────────────────────── */}
      {!isEdit && currencyOptions.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.currency')}</label>
          <div className="flex gap-2">
            {currencyOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCurrencyCode(c); setInstallments('1'); setFxRate('') }}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  effectiveCurrency === c
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Adjustment direction ───────────────────────────────────────────── */}
      {(isEdit ? editable?.adjustmentDirection : tab === 'adjustment') && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.direction')}</label>
          <div className="flex gap-3">
            {(['increase', 'decrease'] as const).map((dir) => (
              <label key={dir} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value={dir}
                  checked={adjustmentDirection === dir}
                  onChange={() => setAdjustmentDirection(dir)}
                  className="accent-primary"
                />
                <span className="text-sm">{dir === 'increase' ? t('directions.increase') : t('directions.decrease')}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Amount ─────────────────────────────────────────────────────────── */}
      {(isEdit ? editable?.amount : true) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {CURRENCY_SYMBOL[effectiveCurrency]}
            </span>
            <MoneyAmountInput
              id="amount"
              required
              value={amount}
              onChange={setAmount}
              placeholder={t('placeholders.amount')}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {isEdit && edit?.isParent && (
            <p className="text-xs text-muted-foreground">
              {t('installment_recalc_hint', { count: edit.installmentsTotal ?? 0 })}
            </p>
          )}
          {negativeWarning && (
            <NegativeBalanceNotice projected={negativeWarning.projected} currency={negativeWarning.currency} />
          )}
        </div>
      )}

      {/* ── Exchange: destination account (create) + received amount (both) ── */}
      {!isEdit && tab === 'exchange' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exchange-dest" className="text-sm font-medium">
            {t('labels.destination_account')} <span className="text-destructive">*</span>
          </label>
          <select
            id="exchange-dest"
            required
            value={destinationAccountId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('placeholders.destination_account')}</option>
            {cashBank.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id === accountId ? t('labels.same_account_option', { name: a.name }) : a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isEdit && tab === 'exchange' && !exchangeDestCurrency && (
        <p className="text-sm text-muted-foreground">
          {t('exchange.no_other_currency_hint', { currency: currencyCode === 'ARS' ? 'USD' : 'ARS' })}
        </p>
      )}

      {/* Received leg amount: create (when dest currency known) or edit. */}
      {((!isEdit && tab === 'exchange' && exchangeDestCurrency) ||
        (isEdit && editable?.destinationAmount)) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exchange-dest-amount" className="text-sm font-medium">
            {t('labels.exchange_received')} ({isEdit ? edit?.destinationCurrency : exchangeDestCurrency})
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {CURRENCY_SYMBOL[(isEdit ? edit?.destinationCurrency : exchangeDestCurrency) ?? 'USD']}
            </span>
            <MoneyAmountInput
              id="exchange-dest-amount"
              required
              value={destinationAmount}
              onChange={setDestinationAmount}
              placeholder="0,00"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {/* ── Installments (create + Gasto + tarjeta + ARS) ──────────────────── */}
      {!isEdit && tab === 'expense' && isCredit && currencyCode === 'ARS' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.installments')}</label>
          <div className="flex gap-2 flex-wrap">
            {INSTALLMENT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInstallments(String(n))}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  installments === String(n)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {n === 1 ? t('installments_options.none') : t('installments_options.count', { n })}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('installments_options.ars_only_hint')}</p>
        </div>
      )}

      {/* ── FX rate (create + Gasto + tarjeta + USD) ───────────────────────── */}
      {!isEdit && tab === 'expense' && isUSDCard && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx_rate" className="text-sm font-medium">{t('labels.fx_rate_label')}</label>
          <MoneyAmountInput
            id="fx_rate"
            required
            value={fxRate}
            onChange={setFxRate}
            placeholder={t('labels.fx_rate_daily')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* ── Date ───────────────────────────────────────────────────────────── */}
      {(isEdit ? editable?.date : true) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium">{t('labels.date')}</label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* ── Category ───────────────────────────────────────────────────────── */}
      {(isEdit ? editable?.category : (tab === 'income' || tab === 'expense')) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {t('labels.category')}{' '}
            {(isEdit ? edit?.type === 'expense' : tab === 'expense')
              ? <span className="text-destructive">*</span>
              : <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>}
          </label>
          {!isEdit && suggestion && !categoryId && (
            <CategorySuggestionChip suggestion={suggestion} onApply={applySuggestion} />
          )}
          <select
            id="category"
            required={isEdit ? edit?.type === 'expense' : true}
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(''); setSuggestion(null) }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{isEdit ? t('placeholders.no_category') : t('placeholders.category')}</option>
            {transactionCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Subcategory ────────────────────────────────────────────────────── */}
      {(isEdit ? editable?.subcategory : true) && selectedCategory && selectedCategory.subcategories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subcategory" className="text-sm font-medium">
            {t('labels.subcategory')} <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
          </label>
          <select
            id="subcategory"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('placeholders.no_subcategory')}</option>
            {selectedCategory.subcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Description ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {t('labels.description')} <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setSuggestion(null); setDescriptionHasNoHistory(false) }}
          onBlur={handleDescriptionBlur}
          placeholder={t('placeholders.description')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {!isEdit && (tab === 'income' || tab === 'expense') && descriptionHasNoHistory && selectedCategory && (
          <CategorySuggestionHint description={description} categoryName={selectedCategory.name} />
        )}
      </div>

      {/* ── Recurrente (create only; no en ajuste, cambio ni cuotas) ───────── */}
      {!isEdit && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurrent}
              onChange={(e) => setIsRecurrent(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm font-medium">{t('labels.make_recurrent')}</span>
          </label>
          {isRecurrent && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frequency" className="text-xs text-muted-foreground">{t('labels.frequency')}</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="weekly">{t('frequencies.weekly')}</option>
                <option value="biweekly">{t('frequencies.biweekly')}</option>
                <option value="monthly">{t('frequencies.monthly')}</option>
                <option value="annual">{t('frequencies.annual')}</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Reintegro / cashback (create only; Gasto, no cuotas) ───────────── */}
      {!isEdit && tab === 'expense' && !isInstallments && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reimbursementEnabled}
              onChange={(e) => {
                const enabled = e.target.checked
                setReimbursementEnabled(enabled)
                if (enabled) setReimbursementAccountId(pickReimbursementAccount(accountId))
              }}
              className="accent-primary"
            />
            <span className="text-sm font-medium">{t('reimbursement.toggle')}</span>
          </label>
          {reimbursementEnabled && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reimb-amount" className="text-xs text-muted-foreground">
                  {t('reimbursement.estimated_amount')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {CURRENCY_SYMBOL[currencyCode]}
                  </span>
                  <MoneyAmountInput
                    id="reimb-amount"
                    value={reimbursementAmount}
                    onChange={setReimbursementAmount}
                    placeholder={t('placeholders.amount')}
                    className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {isCredit && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{t('reimbursement.target_label')}</span>
                  <div className="flex flex-col gap-1.5">
                    {(['account', 'statement'] as const).map((tg) => (
                      <label key={tg} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reimb-target"
                          value={tg}
                          checked={reimbursementTarget === tg}
                          onChange={() => setReimbursementTarget(tg)}
                          className="accent-primary mt-0.5"
                        />
                        <span className="text-sm">{t(`reimbursement.target.${tg}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {(!isCredit || reimbursementTarget === 'account') && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reimb-account" className="text-xs text-muted-foreground">
                    {t('reimbursement.credit_to')}
                  </label>
                  <select
                    id="reimb-account"
                    value={reimbursementAccountId}
                    onChange={(e) => setReimbursementAccountId(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t('reimbursement.credit_to_placeholder')}</option>
                    {cashBank.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reimbursementReceivedNow}
                  onChange={(e) => setReimbursementReceivedNow(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-sm">{t('reimbursement.received_now')}</span>
              </label>

              <p className="text-xs text-muted-foreground">
                {reimbursementReceivedNow
                  ? t('reimbursement.received_now_hint')
                  : t('reimbursement.pending_hint')}
              </p>
            </div>
          )}
        </div>
      )}

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending
          ? tCommon('saving')
          : isEdit
            ? tCommon('save_changes')
            : isInstallments
              ? t('actions.register_installments', { count: parseInt(installments) })
              : tab === 'exchange'
                ? t('actions.register_exchange')
                : t('actions.create')}
      </button>
    </form>
  )
}
