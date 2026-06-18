import { useEffect, useState, useTransition } from 'react'
import {
  checkNegativeBalance,
  formatDateISO,
  normalizeDescription,
  suggestReimbursementAmount,
  type CategorySuggestion,
} from '@grana/money-logic'
import { Money, parseMoneyInput } from '@grana/validation'
import type {
  Frequency,
  IntervalUnit,
  MovementFormAccount,
  MovementFormState,
  Tab,
  UseMovementFormArgs,
} from './types'

// Accounts eligible per tab: only Gasto can target a credit card.
function eligibleFor(accounts: MovementFormAccount[], tab: Tab): MovementFormAccount[] {
  return tab === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')
}

// Default reimbursement credit-to account: same-institution cash/bank if any,
// else first cash/bank, else ''.
function pickReimbursementAccount(
  accounts: MovementFormAccount[],
  expenseAccountId: string,
): string {
  const expenseAccount = accounts.find((a) => a.id === expenseAccountId)
  const inst = expenseAccount?.institutionId ?? null
  const cashBank = accounts.filter((a) => a.type !== 'credit')
  const match = inst ? cashBank.find((a) => a.institutionId === inst) : undefined
  return match?.id ?? cashBank[0]?.id ?? ''
}

/**
 * Owns the movement form state, cascades, and submit dispatcher. Cross-
 * platform: the caller renders the state into JSX (web HTML / mobile RN) and
 * wires the mutators object to its platform's actions.
 *
 * Faithful extraction of `apps/web/.../movement-form.tsx`'s state + handlers
 * (kept for parity with web behavior; ground-truth comparison lands in 7.8).
 */
export function useMovementForm(args: UseMovementFormArgs): MovementFormState {
  const {
    mutators,
    accounts,
    categories,
    edit,
    preselectAccountId,
    household,
    today,
    onSuccess,
    onMutationSuccess,
    translate: t,
  } = args
  const isEdit = edit !== undefined
  const editable = edit?.editableFields

  const todayStr = (): string => formatDateISO(today)
  const firstFor = (tab: Tab): MovementFormAccount | undefined => eligibleFor(accounts, tab)[0]

  const preselect = preselectAccountId
    ? accounts.find((a) => a.id === preselectAccountId)
    : undefined
  const initialTab: Tab = edit?.type ?? 'expense'

  // ── State ──────────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [tab, setTabRaw] = useState<Tab>(initialTab)
  const [formError, setFormError] = useState<string | null>(null)
  const [accountId, setAccountIdRaw] = useState(
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
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null)
  const [descriptionHasNoHistory, setDescriptionHasNoHistory] = useState(false)

  const [destinationAccountId, setDestinationAccountIdRaw] = useState(edit?.destinationAccountId ?? '')
  const [destinationAmount, setDestinationAmount] = useState(
    edit?.destinationAmount != null ? String(edit.destinationAmount) : '',
  )

  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(
    edit && edit.type === 'adjustment' && edit.signedAmount < 0 ? 'decrease' : 'increase',
  )

  const [installments, setInstallments] = useState('1')

  const [isRecurrent, setIsRecurrent] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('month')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  const [reimbursementEnabled, setReimbursementEnabled] = useState(false)
  const [reimbursementTarget, setReimbursementTarget] = useState<'account' | 'statement'>('account')
  const [reimbursementAmount, setReimbursementAmount] = useState('')
  const [reimbursementReceivedNow, setReimbursementReceivedNow] = useState(false)
  const [reimbursementPercent, setReimbursementPercent] = useState('')
  const [reimbursementCap, setReimbursementCap] = useState('')
  const [reimbursementAccountId, setReimbursementAccountId] = useState('')

  const sharedMembers =
    household && household.members.length === 2 ? household.members : null
  const [sharedEnabled, setSharedEnabled] = useState<boolean>(edit?.shared != null)
  const [splitFirstPct, setSplitFirstPct] = useState<number>(() => {
    if (edit?.shared) return edit.shared.firstPct
    const stored = household?.defaultSplit.find((s) => s.user_id === household.members[0]?.userId)
    return stored?.percentage ?? 50
  })

  // ── Initial reimbursement default once accounts are known ──────────────────
  useEffect(() => {
    if (reimbursementAccountId === '' && accountId !== '') {
      setReimbursementAccountId(pickReimbursementAccount(accounts, accountId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const eligibleAccounts = eligibleFor(accounts, tab)
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? eligibleAccounts[0]
  const isCredit = selectedAccount?.type === 'credit'
  const activeCurrencies = (selectedAccount?.activeCurrencies ?? ['ARS']) as ('ARS' | 'USD')[]
  const cashBankAccounts = accounts.filter((a) => a.type !== 'credit')
  const otherAccounts = cashBankAccounts.filter((a) => a.id !== selectedAccount?.id)
  const destinationAccount = otherAccounts.find((a) => a.id === destinationAccountId)
  const sharedCurrencies = (destinationAccount
    ? activeCurrencies.filter((c) => destinationAccount.activeCurrencies.includes(c))
    : []) as ('ARS' | 'USD')[]
  const exchangeDestAccount = cashBankAccounts.find((a) => a.id === destinationAccountId)
  const exchangeDestCurrency =
    (exchangeDestAccount?.activeCurrencies.find((c) => c !== currencyCode) ?? null) as
      | 'ARS'
      | 'USD'
      | null

  const isInstallments = isCredit && currencyCode === 'ARS' && parseInt(installments) >= 2

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  const effectiveCurrency: 'ARS' | 'USD' = !isEdit && tab === 'transfer'
    ? (sharedCurrencies.includes(currencyCode) ? currencyCode : sharedCurrencies[0] ?? currencyCode)
    : currencyCode

  const currencyOptions: ('ARS' | 'USD')[] = tab === 'transfer'
    ? (sharedCurrencies.length > 0 ? sharedCurrencies : activeCurrencies)
    : activeCurrencies

  const negativeWarning = ((): { projected: number; currency: 'ARS' | 'USD' } | null => {
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null

    if (isEdit && edit) {
      if (edit.isParent) return null
      if (edit.status !== null) return null
      const type = edit.type
      if (
        type !== 'expense' &&
        type !== 'transfer' &&
        type !== 'adjustment' &&
        type !== 'exchange'
      ) {
        return null
      }
      const currency = edit.currencyCode
      const current = edit.availableBalance
      let baseline: number
      let outflow: number
      if (type === 'adjustment') {
        baseline = Money.toNumber(
          Money.subtract(Money.from(current), Money.from(edit.signedAmount)),
        )
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

  // ── Cascading setters ──────────────────────────────────────────────────────
  const setTab = (next: Tab): void => {
    setTabRaw(next)
    setCategoryId('')
    setSubcategoryId('')
    setSuggestion(null)
    setDescriptionHasNoHistory(false)
    setFormError(null)
    setInstallments('1')
    const eligible = eligibleFor(accounts, next)
    const srcId = eligible.some((a) => a.id === accountId) ? accountId : eligible[0]?.id ?? ''
    if (srcId !== accountId) {
      setAccountIdRaw(srcId)
      const nextAccount = accounts.find((a) => a.id === srcId)
      if (nextAccount && !nextAccount.activeCurrencies.includes(currencyCode)) {
        setCurrencyCode((nextAccount.activeCurrencies[0] ?? 'ARS') as 'ARS' | 'USD')
      }
    }
    if (next === 'exchange') {
      setDestinationAccountIdRaw(srcId)
      setDestinationAmount('')
    }
  }

  const setAccountId = (id: string): void => {
    setAccountIdRaw(id)
    setInstallments('1')
    const account = accounts.find((a) => a.id === id)
    if (account && !account.activeCurrencies.includes(currencyCode)) {
      setCurrencyCode((account.activeCurrencies[0] ?? 'ARS') as 'ARS' | 'USD')
    }
    setReimbursementAccountId(pickReimbursementAccount(accounts, id))
  }

  const setDestinationAccountId = (id: string): void => {
    setDestinationAccountIdRaw(id)
    const dest = otherAccounts.find((a) => a.id === id)
    if (dest) {
      const shared = activeCurrencies.filter((c) => dest.activeCurrencies.includes(c))
      if (shared.length > 0 && !shared.includes(currencyCode)) {
        setCurrencyCode(shared[0] as 'ARS' | 'USD')
      }
    }
  }

  // ── Compound handlers ──────────────────────────────────────────────────────
  const swapAccounts = (): void => {
    setAccountIdRaw(destinationAccountId)
    setDestinationAccountIdRaw(accountId)
  }

  const pickCategory = (catId: string, subId: string): void => {
    setCategoryId(catId)
    setSubcategoryId(subId)
    setSuggestion(null)
    setDescriptionHasNoHistory(false)
  }

  const applyReimbursementPercent = (percentStr: string, capStr: string): void => {
    const expense = parseMoneyInput(amount)
    const percent = parseMoneyInput(percentStr)
    if (expense === null || expense <= 0 || percent === null || percent <= 0) return
    const cap = parseMoneyInput(capStr)
    const suggested = suggestReimbursementAmount(expense, percent, cap ?? undefined)
    setReimbursementAmount(String(suggested))
  }

  const applySuggestion = (): void => {
    if (!suggestion) return
    setCategoryId(suggestion.categoryId)
    setSubcategoryId(suggestion.subcategoryId ?? '')
    setSuggestion(null)
  }

  const fetchSuggestionForDescription = async (): Promise<void> => {
    if (isEdit || (tab !== 'income' && tab !== 'expense')) {
      setSuggestion(null)
      setDescriptionHasNoHistory(false)
      return
    }
    const result = await mutators.suggestCategoryFromHistory(description, tab)
    setSuggestion(result)
    setDescriptionHasNoHistory(result === null && normalizeDescription(description) !== null)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitEdit = (): void => {
    if (!edit) return
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

    // Share toggle: send the split spec when enabled, explicit null to unshare,
    // or omit entirely when the field isn't editable (e.g. income/transfer) so
    // the update leaves shared state untouched. Shared by the simple-expense and
    // the installment-parent paths (the parent fans the splits to its cuotas).
    const sharedUpdate = editable?.shared
      ? sharedEnabled && sharedMembers && household
        ? {
            household_id: household.id,
            splits: [
              { user_id: sharedMembers[0].userId, percentage: splitFirstPct },
              { user_id: sharedMembers[1].userId, percentage: 100 - splitFirstPct },
            ],
          }
        : null
      : undefined

    startTransition(async () => {
      let result: { ok: boolean; formError?: string }

      if (edit.isParent) {
        result = await mutators.updateInstallmentParent(edit.id, {
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
          ...(editable?.amount && parsedAmount !== null ? { amount: parsedAmount } : {}),
          ...(sharedUpdate !== undefined ? { shared: sharedUpdate } : {}),
        })
      } else if (edit.type === 'transfer') {
        result = await mutators.updateTransfer(
          edit.id,
          edit.accountId,
          edit.destinationAccountId ?? '',
          {
            amount: parsedAmount!,
            date,
            description: description || null,
          },
        )
      } else if (edit.type === 'adjustment') {
        const signed =
          adjustmentDirection === 'decrease' ? -Math.abs(parsedAmount!) : Math.abs(parsedAmount!)
        result = await mutators.updateAdjustment(edit.id, edit.accountId, {
          amount: signed,
          date,
          description: description || null,
        })
      } else if (edit.type === 'exchange') {
        result = await mutators.updateExchange(edit.id, {
          amount: parsedAmount!,
          destination_amount: parsedDestinationAmount!,
          date,
          description: description || null,
        })
      } else {
        result = await mutators.updateTransaction(edit.id, edit.accountId, {
          ...(editable?.amount && parsedAmount !== null ? { amount: parsedAmount, date } : {}),
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
          ...(sharedUpdate !== undefined ? { shared: sharedUpdate } : {}),
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed_short'))
        return
      }
      onMutationSuccess?.()
      onSuccess?.()
    })
  }

  const submitCreate = (): void => {
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

    let reimbursementDecl:
      | {
          target: 'account' | 'statement'
          estimated_amount: number
          account_id: string
          received_now: boolean
          date: string
        }
      | undefined
    if (reimbursementEnabled && tab === 'expense' && !isInstallments) {
      const parsedReimb = parseMoneyInput(reimbursementAmount)
      if (parsedReimb === null || parsedReimb <= 0) {
        setFormError(t('reimbursement.errors.amount_positive'))
        return
      }
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
        // Date the reimbursement carries: when it's already received at creation
        // it should read with the same date as the expense (not "today"). For a
        // pending one this is a placeholder — confirmReimbursement overwrites it
        // with the real accreditation date.
        date,
      }
    }

    let sharedDecl:
      | { household_id: string; splits: { user_id: string; percentage: number }[] }
      | undefined
    if (sharedEnabled && tab === 'expense' && sharedMembers && household) {
      sharedDecl = {
        household_id: household.id,
        splits: [
          { user_id: sharedMembers[0].userId, percentage: splitFirstPct },
          { user_id: sharedMembers[1].userId, percentage: 100 - splitFirstPct },
        ],
      }
    }

    startTransition(async () => {
      let result: { ok: boolean; formError?: string; id?: string; parentId?: string }

      if (tab === 'income') {
        result = await mutators.createIncome({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
        })
      } else if (tab === 'transfer') {
        result = await mutators.createTransfer({
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
        result = await mutators.createAdjustment({
          account_id: accountId,
          currency_code: currencyCode,
          amount: signedAmount,
          date,
          description: description || undefined,
        })
      } else if (tab === 'exchange') {
        result = await mutators.createExchange({
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
        if (isInstallments) {
          result = await mutators.registerInstallments({
            account_id: accountId,
            currency_code: 'ARS',
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            installments_total: parseInt(installments),
            shared: sharedDecl,
          })
        } else {
          result = await mutators.registerCardPurchase({
            account_id: accountId,
            currency_code: currencyCode,
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            reimbursement: reimbursementDecl,
            shared: sharedDecl,
          })
        }
      } else {
        result = await mutators.createExpense({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId || undefined,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
          reimbursement: reimbursementDecl,
          shared: sharedDecl,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      // Recurrence: not for adjustments, exchanges, or installment purchases.
      const createdId = 'id' in result ? result.id : undefined
      if (
        isRecurrent &&
        tab !== 'adjustment' &&
        tab !== 'exchange' &&
        !isInstallments &&
        createdId
      ) {
        const trimmedEnd = recurrenceEndDate.trim()
        const recurrenceResult = await mutators.createRecurrenceFromMovement({
          transaction_id: createdId,
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

      onMutationSuccess?.()
      onSuccess?.()
    })
  }

  const onSubmit = (): void => {
    if (isEdit) submitEdit()
    else submitCreate()
  }

  return {
    // State
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

    // Setters
    setTab,
    setAccountId,
    setCurrencyCode,
    setAmount,
    setDate,
    setDescription,
    setCategoryId,
    setSubcategoryId,
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
    setSuggestion,
    setDescriptionHasNoHistory,

    // Derived
    isEdit,
    isCredit,
    isInstallments,
    eligibleAccounts,
    selectedAccount,
    activeCurrencies,
    cashBankAccounts,
    otherAccounts,
    destinationAccount,
    sharedCurrencies,
    exchangeDestAccount,
    exchangeDestCurrency,
    effectiveCurrency,
    currencyOptions,
    expenseCategories,
    incomeCategories,
    transactionCategories,
    selectedCategory,
    negativeWarning,

    // Submission
    isSubmitting: isPending,
    formError,
    onSubmit,

    // Compound handlers
    swapAccounts,
    pickCategory,
    applyReimbursementPercent,
    applySuggestion,
    fetchSuggestionForDescription,
  }
}
