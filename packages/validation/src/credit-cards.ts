import * as yup from 'yup'
import { reimbursementDeclarationSchema } from './transactions'

// ─── Shared ──────────────────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

// ─── Task 2.1: Alta de tarjeta (modo experto, 4 fechas) ──────────────────────

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
    // Current period dates
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
    // Next period dates
    next_end_date: yup
      .string()
      .label('next_end_date')
      .required()
      .test(
        'after-current-end',
        'next_end_must_be_after_current_end',
        function (value) {
          const { current_end_date } = this.parent
          if (!value || !current_end_date) return true
          return value > current_end_date
        },
      ),
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

// ─── Task 2.2: Alta de tarjeta (modo novato, 1 fecha) ────────────────────────

export const createNovatoCreditCardSchema = yup
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
    close_date: yup.string().label('close_date').required(),
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
    fx_rate_to_ars: yup
      .number()
      .label('fx_rate_to_ars')
      .positive()
      .nullable()
      .optional(),
    reimbursement: reimbursementDeclarationSchema.optional().default(undefined),
  })
  .strict()
  .test('fx-rate-required-for-usd', 'fx_rate_required_for_usd', function (value) {
    if (value.currency_code === 'USD') {
      if (!value.fx_rate_to_ars || value.fx_rate_to_ars <= 0) {
        return this.createError({
          path: 'fx_rate_to_ars',
          message: 'fx_rate_required_for_usd',
        })
      }
    } else {
      if (value.fx_rate_to_ars != null) {
        return this.createError({
          path: 'fx_rate_to_ars',
          message: 'fx_rate_must_be_null_for_ars',
        })
      }
    }
    return true
  })

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
  })
  .strict()

// ─── Task 2.5: Pagar resumen ─────────────────────────────────────────────────

export const payCardPeriodSchema = yup
  .object({
    period_id: yup.string().label('period_id').uuid().required(),
    amount: yup.number().label('amount').required().positive(),
    payment_account_id: yup.string().label('payment_account_id').uuid().required(),
    payment_date: yup.string().label('payment_date').required(),
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
export type CreateNovatoCreditCardInput = yup.InferType<
  typeof createNovatoCreditCardSchema
>
export type RegisterCardPurchaseInput = yup.InferType<
  typeof registerCardPurchaseSchema
>
export type RegisterInstallmentsInput = yup.InferType<
  typeof registerInstallmentsSchema
>
export type PayCardPeriodInput = yup.InferType<typeof payCardPeriodSchema>
export type UpdatePeriodDatesInput = yup.InferType<typeof updatePeriodDatesSchema>
