import { useEffect, useState } from 'react'
import {
  checkNegativeBalance,
  formatDateISO,
  normalizeDescription,
  suggestReimbursementAmount,
  type CategorySuggestion,
} from '@grana/money-logic'
import { Money, parseMoneyInput } from '@grana/validation'
import { graftArchivedTaxonomy } from './archived-taxonomy'
import type {
  Frequency,
  FrequentChip,
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

// Tab partition (design D1): only the daily verbs are primary; the rest live
// behind "Otros", each gated by its own eligibility. Static — the earlier
// "dynamic third slot" idea was dropped (ranking-by-frequency moved to #31).
export const PRIMARY_TABS: Tab[] = ['expense', 'income']
export const SECONDARY_TABS: Tab[] = ['transfer', 'exchange', 'adjustment']

// How many frequent-classification chips to surface at most (#31 item 1). Kept
// small so they fit one row on mobile and never become a wall of chips.
export const FREQUENT_CHIPS_MAX = 4

// New-user default chips (#31 item 1): shown when the user has no history yet,
// so the accelerator is useful from day one. Referenced by immutable
// `canonical_name` (visible labels get renamed / i18n'd; canonicals don't), and
// resolved against the live catalog — any default the catalog doesn't serve is
// skipped. Expense: Comida › Supermercado, Entretenimiento › Salidas, Transporte.
type LeafCanonical = { category: string; subcategory: string | null }
const DEFAULT_EXPENSE_LEAVES: LeafCanonical[] = [
  { category: 'comida', subcategory: 'supermercado' },
  { category: 'entretenimiento', subcategory: 'salidas' },
  { category: 'transporte', subcategory: null },
]
const DEFAULT_INCOME_LEAVES: LeafCanonical[] = [
  { category: 'sueldo', subcategory: null },
  { category: 'freelance', subcategory: null },
  { category: 'otros-ingresos', subcategory: null },
]

// Which secondary types the user can actually do, from their accounts:
// transfer needs ≥2 own (cash/bank) accounts; exchange needs both ARS and USD
// reachable across cash/bank accounts; adjustment needs any cash/bank account.
function eligibleSecondaryTabs(accounts: MovementFormAccount[]): Tab[] {
  const cashBank = accounts.filter((a) => a.type !== 'credit')
  const currencies = new Set(cashBank.flatMap((a) => a.activeCurrencies))
  return SECONDARY_TABS.filter((tab) => {
    if (tab === 'transfer') return cashBank.length >= 2
    if (tab === 'exchange') return currencies.has('ARS') && currencies.has('USD')
    return cashBank.length >= 1 // adjustment
  })
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
    frequentClassifications,
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
  // Deliberately NOT `useTransition`: React 19 keeps the tree suspended while
  // an async transition is pending, and expo-router wraps every route in a
  // Suspense boundary with an empty fallback — the whole native screen goes
  // blank for the duration of the submit (expo/expo#37155). A plain pending
  // flag renders identically on web and keeps the form visible on mobile.
  const [isPending, setIsPending] = useState(false)
  const runSubmit = (fn: () => Promise<void>): void => {
    setIsPending(true)
    void fn().finally(() => setIsPending(false))
  }
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

  // Prefill from the linked reimbursement when editing. A received/cancelled one
  // is read-only (managed from its own confirm/cancel flow), so its fields load
  // for display but the section won't submit changes.
  const editReimb = edit?.reimbursement ?? null
  const [reimbursementEnabled, setReimbursementEnabled] = useState(editReimb != null)
  const [reimbursementTarget, setReimbursementTarget] = useState<'account' | 'statement'>(
    editReimb?.target ?? 'account',
  )
  const [reimbursementAmount, setReimbursementAmount] = useState(
    editReimb ? String(editReimb.amount) : '',
  )
  const [reimbursementReceivedNow, setReimbursementReceivedNow] = useState(false)
  const [reimbursementPercent, setReimbursementPercent] = useState('')
  const [reimbursementCap, setReimbursementCap] = useState('')
  const [reimbursementAccountId, setReimbursementAccountId] = useState(editReimb?.accountId ?? '')

  // The linked reimbursement can't be edited/removed here once received/cancelled.
  const reimbursementReadOnly = editReimb != null && editReimb.status !== 'pending'

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
  // Which secondary types "Otros" offers, and whether the active tab is one.
  const secondaryTabs = eligibleSecondaryTabs(accounts)
  const isSecondaryTab = SECONDARY_TABS.includes(tab)
  // Hide the account selector when the active tab has a single eligible account
  // (D2). NOTE: the finer "one eligible account for the active *currency*" rule
  // (an ARS wallet + a USD-only account) is deferred — hiding there would need
  // the currency toggle to drive account selection, a currency-cascade change
  // out of scope for this surface pass.
  const showAccountSelector = eligibleAccounts.length > 1
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

  // In edit mode the movement may be classified with a category/subcategory
  // that has since been archived: the catalog no longer serves it, so it gets
  // grafted back in while it is still the form's selection. A no-op everywhere
  // else (create, or an edit whose classification is live).
  const catalog = graftArchivedTaxonomy(categories, edit?.archivedTaxonomy, {
    categoryId,
    subcategoryId,
  })
  const expenseCategories = catalog.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = catalog.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  // Resolve a leaf (category id + optional subcategory id) into a display-ready
  // chip against the active tab's catalog. `transactionCategories` already
  // filters by tab and, on create, excludes archived rows — so a leaf whose
  // category or subcategory is archived/missing simply doesn't resolve.
  const chipFromIds = (catId: string, subId: string | null): FrequentChip | null => {
    const cat = transactionCategories.find((c) => c.id === catId)
    if (!cat) return null
    let subLabel: string | null = null
    if (subId) {
      const sub = cat.subcategories.find((s) => s.id === subId && s.is_active !== false)
      if (!sub) return null
      subLabel = sub.name
    }
    return {
      categoryId: cat.id,
      subcategoryId: subId,
      label: subLabel ?? cat.name,
      icon: cat.icon ?? null,
      color: cat.color ?? null,
      active: cat.id === categoryId && (subId ?? '') === subcategoryId,
    }
  }
  // Same, but by immutable canonical_name — used to resolve the new-user defaults.
  const chipFromCanonical = (catCanonical: string, subCanonical: string | null): FrequentChip | null => {
    const cat = transactionCategories.find((c) => c.canonical_name === catCanonical)
    if (!cat) return null
    if (!subCanonical) return chipFromIds(cat.id, null)
    const sub = cat.subcategories.find((s) => s.canonical_name === subCanonical && s.is_active !== false)
    return sub ? chipFromIds(cat.id, sub.id) : null
  }

  // Frequent-classification chips (#31 item 1): the user's history first; when
  // there's none yet (new user), fall back to the default set so the accelerator
  // is useful from day one. Create-only, expense/income only, deduped and capped.
  const frequentChips: FrequentChip[] = ((): FrequentChip[] => {
    if (isEdit || (tab !== 'expense' && tab !== 'income')) return []
    const history = (frequentClassifications ?? [])
      .map((f) => chipFromIds(f.categoryId, f.subcategoryId))
      .filter((c): c is FrequentChip => c !== null)
    const base =
      history.length > 0
        ? history
        : (tab === 'expense' ? DEFAULT_EXPENSE_LEAVES : DEFAULT_INCOME_LEAVES)
            .map((d) => chipFromCanonical(d.category, d.subcategory))
            .filter((c): c is FrequentChip => c !== null)
    const seen = new Set<string>()
    return base
      .filter((c) => {
        const key = `${c.categoryId}:${c.subcategoryId ?? ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, FREQUENT_CHIPS_MAX)
  })()

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

    // Reimbursement (reintegro): only when the field is editable and not read-only
    // (a received/cancelled one is managed from its own flow). An enabled toggle
    // adds or replaces it; a disabled toggle removes any pending one. The patch
    // carries the expense's resulting shared spec so the reintegro inherits (or
    // drops) the split. `null` ⇒ leave the reimbursement untouched entirely.
    let reimbursementCall:
      | {
          reimbursement?: {
            target: 'account' | 'statement'
            estimated_amount: number
            account_id: string
            received_now: boolean
            date: string
          }
          shared?: { household_id: string; splits: { user_id: string; percentage: number }[] }
        }
      | null = null
    if (editable?.reimbursement && !reimbursementReadOnly) {
      if (reimbursementEnabled) {
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
        reimbursementCall = {
          reimbursement: {
            target: reimbTarget,
            estimated_amount: parsedReimb,
            account_id: reimbAccount,
            received_now: reimbursementReceivedNow,
            date,
          },
          shared: sharedUpdate ?? undefined,
        }
      } else {
        reimbursementCall = { shared: sharedUpdate ?? undefined }
      }
    }

    runSubmit(async () => {
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
          // Debit-account change (statement payment): send it only when the
          // field is editable and the account actually changed.
          ...(editable?.account && accountId !== edit.accountId
            ? { account_id: accountId }
            : {}),
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed_short'))
        return
      }

      // Apply the reintegro after the expense edit so it inherits the resulting
      // shared state. If it fails, surface the error and don't report success;
      // the expense edit stands (a pending reintegro is recoverable on retry).
      if (reimbursementCall) {
        const rr = await mutators.saveExpenseReimbursement(edit.id, reimbursementCall)
        if (!rr.ok) {
          setFormError(rr.formError ?? t('errors.save_failed_short'))
          return
        }
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
    if (reimbursementEnabled && tab === 'expense') {
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

    runSubmit(async () => {
      // Recurrente con fecha FUTURA: no se crea el movimiento semilla. La regla
      // nace con la semántica de la creación directa (start_date = la fecha
      // elegida, last_generated_date NULL), así la primera instancia pendiente
      // cae en esa fecha y pasa por el gate de confirmación — ningún saldo ni
      // resumen se mueve hasta que el usuario apruebe.
      const recurrenceEligible =
        isRecurrent && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments
      if (recurrenceEligible && date > todayStr()) {
        const trimmedEnd = recurrenceEndDate.trim()
        const directResult = await mutators.createRecurrenceDirect({
          movement_type: tab,
          account_id: accountId,
          ...(tab === 'transfer'
            ? { transfer_destination_account_id: destinationAccountId }
            : {
                category_id: categoryId,
                ...(subcategoryId ? { subcategory_id: subcategoryId } : {}),
              }),
          currency_code: tab === 'transfer' ? effectiveCurrency : currencyCode,
          amount: parsedAmount,
          ...(description ? { description } : {}),
          frequency,
          ...(frequency === 'custom'
            ? { interval_count: intervalCount, interval_unit: intervalUnit }
            : {}),
          start_date: date,
          ...(trimmedEnd !== '' ? { end_date: trimmedEnd } : {}),
          ...(sharedDecl && tab === 'expense' ? { shared: sharedDecl } : {}),
        })
        if (!directResult.ok) {
          setFormError(directResult.formError ?? t('errors.save_failed'))
          return
        }
        onMutationSuccess?.()
        onSuccess?.()
        return
      }

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
            reimbursement: reimbursementDecl,
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
      if (recurrenceEligible && createdId) {
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
    reimbursementReadOnly,
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
    showAccountSelector,
    secondaryTabs,
    isSecondaryTab,
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
    frequentChips,
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
