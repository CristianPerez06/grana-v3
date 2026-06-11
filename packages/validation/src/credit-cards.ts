import * as yup from 'yup'
import { reimbursementDeclarationSchema } from './transactions'
import { sharedExpenseSchema } from './shared'

// ─── Shared ──────────────────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

// ─── Alta de tarjeta (2 fechas: el resumen actual; el siguiente nace estimado) ─

export const createCreditCardSchema = yup
  .object({
    institution_id: yup.string().label('institution_id').uuid().required(),
    network_id: yup
      .string()
      .label('network_id')
      .uuid()
      .nullable()
      .optional(),
    other_network_name: yup
      .string()
      .label('other_network_name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(2)
      .max(50)
      .nullable()
      .optional(),
    name: yup
      .string()
      .label('name')
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(1)
      .max(50)
      .optional(),
    currencies: yup
      .array(
        yup.object({
          currency_code: yup
            .string()
            .required()
            .oneOf(SUPPORTED_CURRENCIES),
        }),
      )
      .label('currencies')
      .required()
      .min(1)
      .test('ars-required', 'ars_currency_required', (currencies) => {
        if (!currencies) return false
        return currencies.some((c) => c.currency_code === 'ARS')
      }),
    credit_limit: yup
      .number()
      .label('credit_limit')
      .positive()
      .nullable()
      .optional(),
    // Current period dates — the only cycle the user knows at signup. The next
    // period is created estimated (is_estimated=true) and confirmed at payment.
    current_end_date: yup.string().label('current_end_date').required(),
    current_due_date: yup
      .string()
      .label('current_due_date')
      .required()
      .test(
        'after-current-end',
        'due_date_must_be_after_end_date',
        function (value) {
          const { current_end_date } = this.parent
          if (!value || !current_end_date) return true
          return value > current_end_date
        },
      ),
  })
  .strict()
  .test('network-xor', 'network_xor_required', function (value) {
    const hasNetworkId = Boolean(value.network_id)
    const hasOtherName = Boolean(value.other_network_name?.trim())
    if (hasNetworkId === hasOtherName) {
      return this.createError({
        message: hasNetworkId ? 'network_both_set' : 'network_none_set',
      })
    }
    return true
  })

// ─── Task 2.3: Registrar consumo simple en tarjeta ───────────────────────────

export const registerCardPurchaseSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    amount: yup.number().label('amount').required().positive(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    date: yup.string().label('date').required(),
    category_id: yup.string().label('category_id').uuid().required(),
    subcategory_id: yup.string().label('subcategory_id').uuid().optional(),
    description: yup.string().label('description').optional(),
    // Optional and informational: the REAL conversion happens at statement
    // payment (the cotización of the payment day) — the purchase never requires
    // it. Kept nullable so historical callers can still record an estimate.
    fx_rate_to_ars: yup
      .number()
      .label('fx_rate_to_ars')
      .positive()
      .nullable()
      .optional()
      .test('fx-rate-null-for-ars', 'fx_rate_must_be_null_for_ars', function (value) {
        const { currency_code } = this.parent
        if (currency_code !== 'USD' && value != null) return false
        return true
      }),
    reimbursement: reimbursementDeclarationSchema.optional().default(undefined),
    shared: sharedExpenseSchema.optional().default(undefined),
  })
  .strict()

// ─── Task 2.4: Registrar compra en cuotas (ARS only, N ≥ 2) ─────────────────

export const registerInstallmentsSchema = yup
  .object({
    account_id: yup.string().label('account_id').uuid().required(),
    amount: yup.number().label('amount').required().positive(),
    currency_code: yup
      .string()
      .label('currency_code')
      .required()
      .oneOf(['ARS'] as const),
    date: yup.string().label('date').required(),
    installments_total: yup
      .number()
      .label('installments_total')
      .required()
      .integer()
      .min(2),
    category_id: yup.string().label('category_id').uuid().required(),
    subcategory_id: yup.string().label('subcategory_id').uuid().optional(),
    description: yup.string().label('description').optional(),
    shared: sharedExpenseSchema.optional().default(undefined),
  })
  .strict()

// ─── Task 2.5: Pagar resumen ─────────────────────────────────────────────────

export const payCardPeriodSchema = yup
  .object({
    period_id: yup.string().label('period_id').uuid().required(),
    amount: yup.number().label('amount').required().positive(),
    payment_account_id: yup.string().label('payment_account_id').uuid().required(),
    payment_date: yup.string().label('payment_date').required(),
    // Cotización del día de pago. Optional at the schema level; the action
    // requires it (> 0) when the period has pending USD debt and persists it
    // on the payment expense for traceability.
    fx_rate_to_ars: yup
      .number()
      .label('fx_rate_to_ars')
      .positive()
      .nullable()
      .optional(),
    // Confirmation of the in-course period P(n+1): the statement being paid
    // announces these dates, so the user has them in hand. The action updates
    // the (usually estimated) next period instead of creating P(n+2), and
    // validates next_end_date > paid period's end_date (its anchor).
    next_end_date: yup.string().label('next_end_date').required(),
    next_due_date: yup
      .string()
      .label('next_due_date')
      .required()
      .test(
        'after-next-end',
        'next_due_must_be_after_next_end',
        function (value) {
          const { next_end_date } = this.parent
          if (!value || !next_end_date) return true
          return value > next_end_date
        },
      ),
  })
  .strict()

// ─── Task 2.6: Edición de fechas de período ──────────────────────────────────

export const updatePeriodDatesSchema = yup
  .object({
    end_date: yup.string().label('end_date').required(),
    due_date: yup
      .string()
      .label('due_date')
      .required()
      .test(
        'after-end',
        'due_date_must_be_after_end_date',
        function (value) {
          const { end_date } = this.parent
          if (!value || !end_date) return true
          return value > end_date
        },
      ),
  })
  .strict()

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateCreditCardInput = yup.InferType<typeof createCreditCardSchema>
export type RegisterCardPurchaseInput = yup.InferType<
  typeof registerCardPurchaseSchema
>
export type RegisterInstallmentsInput = yup.InferType<
  typeof registerInstallmentsSchema
>
export type PayCardPeriodInput = yup.InferType<typeof payCardPeriodSchema>
export type UpdatePeriodDatesInput = yup.InferType<typeof updatePeriodDatesSchema>
