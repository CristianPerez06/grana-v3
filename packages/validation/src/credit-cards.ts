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
    reimbursement: reimbursementDeclarationSchema.optional().default(undefined),
    shared: sharedExpenseSchema.optional().default(undefined),
  })
  .strict()

// ─── Task 2.5: Pagar resumen ─────────────────────────────────────────────────

// ─── Pago de resumen: pagos con imputaciones ─────────────────────────────────

/**
 * Una **imputación**: qué deuda del resumen cancela una parte de un débito.
 *
 * `settles_currency` es la moneda de la DEUDA, no la del dinero que sale: pagar
 * US$ 500 desde una cuenta en pesos es una allocation `USD` con cotización.
 */
export const paymentAllocationSchema = yup
  .object({
    settles_currency: yup
      .string()
      .label('settles_currency')
      .required()
      .oneOf(SUPPORTED_CURRENCIES),
    settles_amount: yup.number().label('settles_amount').required().positive(),
    /** Solo en el cruce permitido: débito en ARS que cancela deuda en USD. */
    fx_rate_to_ars: yup.number().label('fx_rate_to_ars').positive().nullable().optional(),
  })
  .strict()

/**
 * Un **pago**: un débito real de una cuenta, con lo que ese débito cancela.
 *
 * El input va ANIDADO y no como lista plana de imputaciones, porque una lista plana no
 * puede decir cuándo dos imputaciones son un mismo débito bancario y cuándo son dos —
 * y eso lo declara el usuario al elegir de qué cuenta sale cada cosa.
 *
 * El monto NO viaja: se DERIVA de las imputaciones. Un importe libre puede no
 * corresponder a ninguna deuda, que es exactamente lo que hacía que un resumen quedara
 * marcado como pagado con cualquier número.
 */
export const statementPaymentSchema = yup
  .object({
    payment_account_id: yup.string().label('payment_account_id').uuid().required(),
    payment_date: yup.string().label('payment_date').required(),
    allocations: yup
      .array()
      .label('allocations')
      .of(paymentAllocationSchema)
      .min(1)
      .required(),
  })
  .strict()
  // Un débito tiene UNA moneda. Si alguna imputación pesifica, el débito es en pesos y
  // el resto tiene que cancelar pesos; si ninguna pesifica, todas cancelan la misma
  // moneda — la de la cuenta. Y un débito ocurre un día, a un solo tipo de cambio.
  .test('coherent-debit-currency', 'debit_currency_incoherent', function (value) {
    const allocations = value?.allocations ?? []
    if (allocations.length === 0) return true
    const pesified = allocations.filter((a) => a?.fx_rate_to_ars != null)

    if (pesified.length === 0) {
      const currencies = new Set(allocations.map((a) => a?.settles_currency))
      return currencies.size === 1
    }
    if (pesified.some((a) => a?.settles_currency !== 'USD')) return false
    if (new Set(pesified.map((a) => a?.fx_rate_to_ars)).size > 1) return false
    return allocations
      .filter((a) => a?.fx_rate_to_ars == null)
      .every((a) => a?.settles_currency === 'ARS')
  })

export const payCardPeriodSchema = yup
  .object({
    period_id: yup.string().label('period_id').uuid().required(),
    /** Un pago por débito real. Dos monedas pagadas por separado = dos pagos. */
    payments: yup
      .array()
      .label('payments')
      .of(statementPaymentSchema)
      .min(1)
      .required(),
    // Impuesto de sellos confirmado por el usuario para este resumen (ARS).
    // 0 / ausente = sin sello. > 0 = se registra como movimiento del período y, si la
    // tarjeta no tenía alícuota, se deriva y persiste (monto ÷ base).
    stamp_tax_amount: yup
      .number()
      .label('stamp_tax_amount')
      .min(0)
      .nullable()
      .optional(),
    // Confirmación del ciclo en curso P(n+1): el resumen que se paga las anuncia, así
    // que el usuario las tiene en la mano en este momento.
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
export type StatementPaymentInput = yup.InferType<typeof statementPaymentSchema>
export type PaymentAllocationInput = yup.InferType<typeof paymentAllocationSchema>
export type UpdatePeriodDatesInput = yup.InferType<typeof updatePeriodDatesSchema>
