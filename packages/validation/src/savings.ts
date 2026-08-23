import * as yup from 'yup'

const SUPPORTED_CURRENCIES = ['ARS', 'USD'] as const

// El monto es SIEMPRE positivo en la entrada, en las dos operaciones. La dirección
// no la elige el usuario escribiendo un signo: la elige el verbo que tocó, y es el
// write path el que persiste `amount` con signo (guardar +, liberar −). Aceptar un
// negativo acá permitiría "guardar −$50.000" y liberar por la puerta de atrás,
// salteando el piso.
const amountSchema = yup
  .number()
  .label('amount')
  .required()
  .positive()

const currencyCodeSchema = yup
  .string()
  .label('currency_code')
  .required()
  .oneOf(SUPPORTED_CURRENCIES)

const dateSchema = yup.date().label('date').required()

// El tope de guardar (no más que el disponible) y el piso de liberar (no más que
// lo reservado) NO viven acá: dependen del estado del servidor al momento de la
// operación, que un schema no puede ver. El schema valida la FORMA; la mutación
// valida contra el saldo, leyéndolo ella misma.
export const reserveAvailabilitySchema = yup
  .object({
    amount: amountSchema,
    currency_code: currencyCodeSchema,
    date: dateSchema,
  })
  .strict()

export const releaseAvailabilitySchema = yup
  .object({
    amount: amountSchema,
    currency_code: currencyCodeSchema,
    date: dateSchema,
  })
  .strict()

export type ReserveAvailabilityInput = yup.InferType<typeof reserveAvailabilitySchema>
export type ReleaseAvailabilityInput = yup.InferType<typeof releaseAvailabilitySchema>
