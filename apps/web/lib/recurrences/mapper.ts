import type {
  CreateExpenseInput,
  CreateIncomeInput,
  CreateTransferInput,
  RegisterCardPurchaseInput,
} from '@grana/validation'
import type { RecurrenceInstance, RecurrenceMovementType } from './types'

export type ConfirmInstancePlan =
  | { kind: 'income'; input: CreateIncomeInput }
  | { kind: 'expense'; input: CreateExpenseInput }
  | { kind: 'card_purchase'; input: RegisterCardPurchaseInput }
  | { kind: 'transfer'; input: CreateTransferInput }

export type ConfirmInstanceContext = {
  movementType: RecurrenceMovementType
  accountType: 'cash' | 'bank' | 'credit'
  /**
   * Required at confirmation time when the instance is a USD expense on a
   * credit account. Collected fresh each time because the ARS/USD rate moves
   * frequently — it is not stored on the rule or the instance.
   */
  fxRateToArs?: number | null
}

export class RecurrenceMapError extends Error {
  constructor(
    public code: RecurrenceMapErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'RecurrenceMapError'
  }
}

export type RecurrenceMapErrorCode =
  | 'missing_transfer_destination'
  | 'invalid_transfer_source'
  | 'invalid_income_account'
  | 'missing_category'
  | 'missing_fx_rate'
  | 'fx_rate_not_allowed'

export type InstanceSnapshot = Pick<
  RecurrenceInstance,
  | 'account_id'
  | 'transfer_destination_account_id'
  | 'currency_code'
  | 'amount'
  | 'category_id'
  | 'subcategory_id'
  | 'description'
  | 'scheduled_date'
>

function toAmountNumber(amount: InstanceSnapshot['amount']): number {
  return typeof amount === 'string' ? Number(amount) : amount
}

export function mapInstanceToConfirmPlan(
  instance: InstanceSnapshot,
  context: ConfirmInstanceContext,
): ConfirmInstancePlan {
  const { movementType, accountType } = context
  const amount = toAmountNumber(instance.amount)
  const date = instance.scheduled_date

  if (movementType === 'transfer') {
    if (!instance.transfer_destination_account_id) {
      throw new RecurrenceMapError(
        'missing_transfer_destination',
        'La instancia recurrente de transferencia no tiene cuenta destino.',
      )
    }
    if (accountType === 'credit') {
      throw new RecurrenceMapError(
        'invalid_transfer_source',
        'No se puede transferir desde una tarjeta de crédito.',
      )
    }
    const input: CreateTransferInput = {
      account_id: instance.account_id,
      transfer_destination_account_id: instance.transfer_destination_account_id,
      currency_code: instance.currency_code,
      amount,
      date,
      ...(instance.description != null && { description: instance.description }),
    }
    return { kind: 'transfer', input }
  }

  if (movementType === 'income') {
    if (accountType === 'credit') {
      throw new RecurrenceMapError(
        'invalid_income_account',
        'Los ingresos no se pueden registrar en una tarjeta de crédito.',
      )
    }
    if (!instance.category_id) {
      throw new RecurrenceMapError(
        'missing_category',
        'La instancia recurrente de ingreso no tiene categoría asignada.',
      )
    }
    const input: CreateIncomeInput = {
      account_id: instance.account_id,
      currency_code: instance.currency_code,
      amount,
      date,
      category_id: instance.category_id,
      ...(instance.subcategory_id != null && {
        subcategory_id: instance.subcategory_id,
      }),
      ...(instance.description != null && { description: instance.description }),
    }
    return { kind: 'income', input }
  }

  if (!instance.category_id) {
    throw new RecurrenceMapError(
      'missing_category',
      'La instancia recurrente de gasto no tiene categoría asignada.',
    )
  }

  if (accountType === 'credit') {
    const fx = context.fxRateToArs
    if (instance.currency_code === 'USD') {
      if (fx == null || fx <= 0) {
        throw new RecurrenceMapError(
          'missing_fx_rate',
          'Las recurrencias en USD en tarjeta requieren cotización al confirmar.',
        )
      }
    } else if (fx != null) {
      throw new RecurrenceMapError(
        'fx_rate_not_allowed',
        'No se debe enviar cotización para recurrencias en ARS.',
      )
    }
    const input: RegisterCardPurchaseInput = {
      account_id: instance.account_id,
      amount,
      currency_code: instance.currency_code,
      date,
      category_id: instance.category_id,
      ...(instance.subcategory_id != null && {
        subcategory_id: instance.subcategory_id,
      }),
      ...(instance.description != null && { description: instance.description }),
      ...(instance.currency_code === 'USD' && { fx_rate_to_ars: fx as number }),
    }
    return { kind: 'card_purchase', input }
  }

  if (context.fxRateToArs != null) {
    throw new RecurrenceMapError(
      'fx_rate_not_allowed',
      'La cotización solo aplica a consumos USD en tarjeta de crédito.',
    )
  }

  const input: CreateExpenseInput = {
    account_id: instance.account_id,
    currency_code: instance.currency_code,
    amount,
    date,
    category_id: instance.category_id,
    ...(instance.subcategory_id != null && {
      subcategory_id: instance.subcategory_id,
    }),
    ...(instance.description != null && { description: instance.description }),
  }
  return { kind: 'expense', input }
}
