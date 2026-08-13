import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import type { CategorySuggestion, EditableFields } from '@grana/money-logic'
import type {
  CreateAdjustmentInput,
  CreateExchangeInput,
  CreateExpenseInput,
  CreateIncomeInput,
  CreateRecurrenceFromMovementInput,
  CreateRecurrenceInput,
  CreateTransferInput,
  RegisterCardPurchaseInput,
  RegisterInstallmentsInput,
  SaveExpenseReimbursementInput,
  UpdateAdjustmentInput,
  UpdateExchangeInput,
  UpdateTransactionInput,
  UpdateTransferInput,
} from '@grana/validation'

// ─── Domain shapes (caller-supplied) ──────────────────────────────────────────

/**
 * Account row consumed by the form. Each app projects its own account list
 * onto this shape before passing it to the hook. The avatar is resolved
 * server-/data-side; the hook never resolves visual identity.
 */
export type MovementFormAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  activeCurrencies: ('ARS' | 'USD')[]
  /** Current available balance per currency. {0,0} for credit (off-ledger). */
  balances: Record<'ARS' | 'USD', number>
  /** Owning institution, used to default the reimbursement credit-to account. */
  institutionId: string | null
  /** Institution display name — the headline in account rows (name goes secondary). */
  institutionName?: string | null
  /** Visual identity resolved server-side; drives the row avatar. */
  avatar?: ResolvedAccountAvatar
}

export type MovementType = 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'

export type { EditableFields } from '@grana/money-logic'

/**
 * Edit context built by the caller from an existing transaction. Its presence
 * flips the form into edit mode: tabs hidden, type/currency/account(s) shown
 * as immutable context, fields gated by `editableFields`, submit routed to
 * the `updateX` mutators.
 */
export type MovementEditContext = {
  id: string
  type: MovementType
  /** Card lifecycle status; non-null ⇒ off-ledger card movement (never warns). */
  status: 'pending' | 'paid' | null
  accountId: string
  destinationAccountId: string | null
  isParent: boolean
  /** Parent (madre) id when this movement is a single installment (cuota). */
  parentId: string | null
  amount: number
  signedAmount: number
  date: string
  currencyCode: 'ARS' | 'USD'
  destinationCurrency: 'ARS' | 'USD' | null
  destinationAmount: number | null
  categoryId: string | null
  subcategoryId: string | null
  /**
   * Set when `categoryId`/`subcategoryId` point at rows the catalog no longer
   * serves because they were archived after this movement was classified.
   * Absent/null when the classification is live (the common case).
   */
  archivedTaxonomy?: ArchivedTaxonomy | null
  description: string | null
  installmentsTotal: number | null
  sourceAccountName: string | null
  destinationAccountName: string | null
  editableFields: EditableFields
  /** The movement's own account balance in the movement currency. */
  availableBalance: number
  /**
   * Current shared state, to prefill the "Compartir gasto" toggle when editing.
   * `null` ⇒ not shared. `firstPct` is the first household member's percentage.
   */
  shared?: { householdId: string; firstPct: number } | null
  /**
   * The reintegro currently linked to this expense (or madre), to prefill the
   * "Tiene reintegro" section when editing. `null` ⇒ none. `status` gates the
   * UI: `pending` is editable/removable; `received`/`cancelled` show read-only
   * (they already touched saldo/resumen and are managed from their own flows).
   */
  reimbursement?: EditReimbursement | null
}

/** Linked reimbursement projected for the edit form's prefill. */
export type EditReimbursement = {
  id: string
  status: 'pending' | 'received' | 'cancelled'
  target: 'account' | 'statement'
  amount: number
  /** Cash/bank account credited (`account` target). Null for `statement`. */
  accountId: string | null
  /** Card period reduced (`statement` target). Null for `account`. */
  cardPeriodId: string | null
}

// Canonical definition lives in @grana/ui-contracts (single home across web,
// mobile and @grana/shared). Imported for local use in this file's types and
// re-exported so movement-form's existing consumers keep importing `Household`
// from this package unchanged.
import type { Household, HouseholdMember } from '@grana/ui-contracts'
export type { Household, HouseholdMember }

export type CategorySubcategory = {
  id: string
  name: string
  canonical_name: string
  user_id: string | null
  /**
   * Only ever `false` on a node grafted from `MovementEditContext.archivedTaxonomy`
   * — the catalog itself serves active rows only. Renderers use it to badge the
   * item as archived and to keep it out of the drillable count.
   */
  is_active?: boolean
}

export type CategoryWithSubcategories = {
  id: string
  name: string
  type: 'income' | 'expense' | 'both'
  subcategories: CategorySubcategory[]
  /** See `CategorySubcategory.is_active`. */
  is_active?: boolean
  // Consumers pass richer rows than the hook needs (web renders icons and
  // resolves system names via canonical_name). Declared optional so a grafted
  // node can carry them through without claiming every consumer supplies them.
  canonical_name?: string
  user_id?: string | null
  icon?: string | null
  color?: string | null
}

/**
 * The archived category and/or subcategory a movement is ALREADY classified
 * with. The catalog only serves active rows, so without this the edit form
 * would open unable to resolve its own classification and could blank it on
 * save. Each field is non-null only when that specific row is archived: a live
 * category with an archived subcategory fills `subcategory` alone.
 *
 * This is the movement's current value, not a catalog entry — the hook grafts
 * it only while it still matches the form's selection, and it disappears as
 * soon as the user picks something else. It is never offered on create.
 */
export type ArchivedTaxonomy = {
  category: CategoryWithSubcategories | null
  subcategory: CategorySubcategory | null
}

// ─── Mutator interface ────────────────────────────────────────────────────────

/**
 * Generic mutation result that every action-style mutator returns. Mirrors the
 * `ActionResult<T>` web defines locally so web actions are directly assignable
 * to this shape. Mobile mutators construct the same shape on top of
 * `@grana/supabase` errors.
 */
export type MutationResult<T = unknown> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
    }

export type CreateResult<T> = MutationResult<T> & { id?: string }
export type RegisterInstallmentsResult = MutationResult<RegisterInstallmentsInput> & {
  parentId?: string
}

/**
 * The contract every platform fills in. EVERY new action the form gains must
 * be added here — that drift detector is the whole point of exporting this as
 * a top-level type rather than inferring it.
 *
 * Web binds these to the Next server actions in `apps/web/app/_actions/*`.
 * Mobile binds them to thin `@grana/supabase` wrappers for the create/update
 * paths and to the shared orchestrators from `@grana/transactions-mutations`
 * for installments / card purchases / recurrences.
 */
export type Mutators = {
  // ── Thin creates ──
  createIncome: (input: unknown) => Promise<CreateResult<CreateIncomeInput>>
  createExpense: (input: unknown) => Promise<CreateResult<CreateExpenseInput>>
  createTransfer: (input: unknown) => Promise<CreateResult<CreateTransferInput>>
  createAdjustment: (input: unknown) => Promise<CreateResult<CreateAdjustmentInput>>
  createExchange: (input: unknown) => Promise<CreateResult<CreateExchangeInput>>

  // ── Thin updates ──
  updateTransaction: (
    id: string,
    accountId: string,
    patch: unknown,
  ) => Promise<MutationResult<UpdateTransactionInput>>
  updateTransfer: (
    id: string,
    sourceAccountId: string,
    destinationAccountId: string,
    patch: unknown,
  ) => Promise<MutationResult<UpdateTransferInput>>
  updateAdjustment: (
    id: string,
    accountId: string,
    patch: unknown,
  ) => Promise<MutationResult<UpdateAdjustmentInput>>
  updateExchange: (
    id: string,
    patch: unknown,
  ) => Promise<MutationResult<UpdateExchangeInput>>
  updateInstallmentParent: (
    id: string,
    patch: unknown,
  ) => Promise<MutationResult<unknown>>
  /**
   * Add / edit / remove the reintegro linked to an existing expense (or madre).
   * A `reimbursement` declaration in the patch adds or replaces it; its absence
   * removes any pending one. A received/cancelled reintegro is never touched.
   * The `shared` spec (the expense's resulting shared state) lets the reintegro
   * inherit the household split.
   */
  saveExpenseReimbursement: (
    id: string,
    patch: unknown,
  ) => Promise<MutationResult<SaveExpenseReimbursementInput>>

  // ── Orchestrators (live in @grana/transactions-mutations) ──
  registerCardPurchase: (
    input: unknown,
  ) => Promise<CreateResult<RegisterCardPurchaseInput>>
  registerInstallments: (input: unknown) => Promise<RegisterInstallmentsResult>
  createRecurrenceFromMovement: (
    input: unknown,
  ) => Promise<CreateResult<CreateRecurrenceFromMovementInput>>
  /**
   * Direct rule creation, no seed movement (`createRecurrence` in
   * @grana/recurrences). The hook uses it when the user marks the movement
   * recurrent with a FUTURE date: nothing is inserted in `transactions`; the
   * rule's first pending instance lands on `start_date` and goes through the
   * confirmation gate before any balance moves.
   */
  createRecurrenceDirect: (
    input: unknown,
  ) => Promise<CreateResult<CreateRecurrenceInput>>

  // ── Read-only (description blur suggestion fetch) ──
  suggestCategoryFromHistory: (
    description: string,
    movementType: 'income' | 'expense',
  ) => Promise<CategorySuggestion | null>
}

// ─── Hook input + output ──────────────────────────────────────────────────────

export type Tab = 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom'
export type IntervalUnit = 'day' | 'week' | 'month' | 'year'

/**
 * Inputs the hook needs. The caller supplies data already-resolved (accounts
 * with avatars, the category tree, edit context if any) so the hook stays
 * I/O-free except for the mutator calls.
 */
export type UseMovementFormArgs = {
  mutators: Mutators
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  /** Edit context flips the form into edit mode. */
  edit?: MovementEditContext
  /** Create mode: pre-select this account (e.g. arriving from an account view). */
  preselectAccountId?: string
  /** The user's household when it has two members — enables the "Compartir" toggle. */
  household?: Household | null
  /** Current AR calendar date — caller passes `getTodayAR()` from money-logic. */
  today: Date
  /** Called on a successful save when the form is hosted in a drawer. */
  onSuccess?: () => void
  /**
   * Translates an i18n key to a display string. The hook stays i18n-agnostic;
   * the caller wires it to web (`next-intl`) or mobile (its own i18n). Used
   * for validation error messages the hook generates internally.
   */
  translate: (key: string, values?: Record<string, string | number>) => string
  /**
   * Called after a successful create/update so the caller can invalidate its
   * cache (TanStack on web, its mobile equivalent). The hook never owns this
   * — query clients are platform-specific.
   */
  onMutationSuccess?: () => void
}

/**
 * The hook's return shape. The caller renders state into JSX and wires setters
 * to controls; submit happens through `onSubmit`.
 */
export type MovementFormState = {
  // ── Core state ──
  tab: Tab
  accountId: string
  currencyCode: 'ARS' | 'USD'
  amount: string
  date: string
  description: string
  categoryId: string
  subcategoryId: string

  // Transfer / exchange
  destinationAccountId: string
  destinationAmount: string

  // Adjustment
  adjustmentDirection: 'increase' | 'decrease'

  // Installments
  installments: string

  // Recurrence
  isRecurrent: boolean
  frequency: Frequency
  intervalCount: number
  intervalUnit: IntervalUnit
  recurrenceEndDate: string

  // Reimbursement
  reimbursementEnabled: boolean
  reimbursementTarget: 'account' | 'statement'
  reimbursementAmount: string
  reimbursementReceivedNow: boolean
  reimbursementPercent: string
  reimbursementCap: string
  reimbursementAccountId: string
  /** The linked reimbursement is received/cancelled ⇒ show read-only, no edits. */
  reimbursementReadOnly: boolean

  // Shared
  sharedEnabled: boolean
  splitFirstPct: number

  // Suggestion (history-based)
  suggestion: CategorySuggestion | null
  descriptionHasNoHistory: boolean

  // ── Setters with cascades ──
  setTab: (t: Tab) => void
  setAccountId: (id: string) => void
  setCurrencyCode: (c: 'ARS' | 'USD') => void
  setAmount: (s: string) => void
  setDate: (s: string) => void
  setDescription: (s: string) => void
  setCategoryId: (s: string) => void
  setSubcategoryId: (s: string) => void
  setDestinationAccountId: (id: string) => void
  setDestinationAmount: (s: string) => void
  setAdjustmentDirection: (d: 'increase' | 'decrease') => void
  setInstallments: (s: string) => void
  setIsRecurrent: (b: boolean) => void
  setFrequency: (f: Frequency) => void
  setIntervalCount: (n: number) => void
  setIntervalUnit: (u: IntervalUnit) => void
  setRecurrenceEndDate: (s: string) => void
  setReimbursementEnabled: (b: boolean) => void
  setReimbursementTarget: (t: 'account' | 'statement') => void
  setReimbursementAmount: (s: string) => void
  setReimbursementReceivedNow: (b: boolean) => void
  setReimbursementPercent: (s: string) => void
  setReimbursementCap: (s: string) => void
  setReimbursementAccountId: (id: string) => void
  setSharedEnabled: (b: boolean) => void
  setSplitFirstPct: (n: number) => void
  setSuggestion: (s: CategorySuggestion | null) => void
  setDescriptionHasNoHistory: (b: boolean) => void

  // ── Derived (computed each render) ──
  isEdit: boolean
  isCredit: boolean
  isInstallments: boolean
  eligibleAccounts: MovementFormAccount[]
  /** False when the active tab has a single eligible account (selector hidden). */
  showAccountSelector: boolean
  /** Secondary types the user can do, shown behind the "Otros" affordance. */
  secondaryTabs: Tab[]
  /** True when the active tab is a secondary type (transfer/adjustment/exchange). */
  isSecondaryTab: boolean
  selectedAccount: MovementFormAccount | undefined
  activeCurrencies: ('ARS' | 'USD')[]
  cashBankAccounts: MovementFormAccount[]
  otherAccounts: MovementFormAccount[]
  destinationAccount: MovementFormAccount | undefined
  sharedCurrencies: ('ARS' | 'USD')[]
  exchangeDestAccount: MovementFormAccount | undefined
  exchangeDestCurrency: 'ARS' | 'USD' | null
  effectiveCurrency: 'ARS' | 'USD'
  currencyOptions: ('ARS' | 'USD')[]
  expenseCategories: CategoryWithSubcategories[]
  incomeCategories: CategoryWithSubcategories[]
  transactionCategories: CategoryWithSubcategories[]
  selectedCategory: CategoryWithSubcategories | undefined
  negativeWarning: { projected: number; currency: 'ARS' | 'USD' } | null

  // ── Submission ──
  isSubmitting: boolean
  formError: string | null
  /** Submit the form. Triggers validation; calls the right mutator. */
  onSubmit: () => void

  // ── Convenience handlers (do composite operations) ──
  /** Swap source ↔ destination accounts (transfer tab). */
  swapAccounts: () => void
  /** Pick a (category, optional subcategory) tuple — clears the suggestion. */
  pickCategory: (categoryId: string, subcategoryId: string) => void
  /** Re-derive reimbursement amount from %/cap and the current expense amount. */
  applyReimbursementPercent: (percentStr: string, capStr: string) => void
  /** Apply the history suggestion to the category/subcategory slots. */
  applySuggestion: () => void
  /** Fetch a category suggestion based on the current description. Idempotent. */
  fetchSuggestionForDescription: () => Promise<void>
}
