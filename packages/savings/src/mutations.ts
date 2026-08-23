import type { GranaSupabaseClient } from '@grana/supabase'
import { formatDateISO, getTodayAR, type BalanceCurrency } from '@grana/money-logic'
import {
  Money,
  reserveAvailabilitySchema,
  releaseAvailabilitySchema,
  validateActionInput,
  type ReserveAvailabilityInput,
  type ReleaseAvailabilityInput,
} from '@grana/validation'
import { getAvailableForCurrency } from './queries'
import type { SavingsMutationResult } from './types'

/**
 * Guardar y liberar comparten casi todo, y lo que cambia es exactamente lo que
 * hace a cada uno lo que es:
 *
 *   guardar   signo +   tope: el DISPONIBLE de esa moneda
 *   liberar   signo −   piso: lo RESERVADO de esa moneda
 *
 * Los dos límites se leen del servidor DENTRO de la mutación, nunca de un valor
 * que venga del cliente: la UI ya muestra el número, pero mostrarlo no es
 * validarlo. Entre que el drawer se abrió y el usuario confirmó pudo entrar un
 * gasto, y el tope tiene que mirar el estado de ahora.
 */
async function writeReserve(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  schema: typeof reserveAvailabilitySchema
  direction: 'reserve' | 'release'
  today?: Date
}): Promise<SavingsMutationResult<ReserveAvailabilityInput>> {
  const { supabase, userId, input, schema, direction } = args
  const today = args.today ?? getTodayAR()

  const validation = await validateActionInput(schema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { amount, currency_code, date } = validation.data
  const currencyCode = currency_code as BalanceCurrency

  const sums = await getAvailableForCurrency(supabase, currencyCode, today)

  // El tope y el piso son las dos caras de la misma regla, y son la diferencia
  // deliberada con el ledger: un saldo negativo es un HECHO válido que Grana
  // muestra tal cual, pero guardar más de lo que tenés no es un estado incómodo
  // — es un input inválido. Y el stock reservado no puede quedar negativo, que
  // sería afirmar que podés gastar plata que no tenés.
  const limit = direction === 'reserve' ? sums.available : sums.reserved
  const requested = Money.from(amount)

  if (Money.compare(requested, Money.from(limit)) > 0) {
    return {
      ok: false,
      reason: direction === 'reserve' ? 'exceeds_available' : 'exceeds_reserved',
      limit,
      messageKey:
        direction === 'reserve'
          ? 'savings.errors.exceeds_available'
          : 'savings.errors.exceeds_reserved',
    }
  }

  const signed =
    direction === 'reserve'
      ? amount
      : Money.toNumber(Money.subtract(Money.from(0), requested))

  const { data, error } = await supabase
    .from('availability_reserve')
    .insert({
      user_id: userId,
      currency_code: currencyCode,
      amount: signed,
      date: formatDateISO(date),
    })
    .select('id')
    .single()

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: data.id }
}

/**
 * Guardar: apartar parte del disponible. NO mueve plata, NO crea ninguna fila en
 * `transactions` y NO genera ningún movimiento visible — la plata se queda en las
 * mismas cuentas y lo único que cambia es cuánto de eso Grana cuenta como
 * gastable.
 */
export async function reserveAvailability(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today?: Date
}): Promise<SavingsMutationResult<ReserveAvailabilityInput>> {
  return writeReserve({ ...args, schema: reserveAvailabilitySchema, direction: 'reserve' })
}

/**
 * Liberar: devolver parte de lo guardado al disponible. La operación simétrica,
 * y con la misma propiedad: ningún saldo de cuenta cambia. No hay cuenta de
 * destino porque guardar nunca sacó la plata de ninguna.
 */
export async function releaseAvailability(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today?: Date
}): Promise<SavingsMutationResult<ReleaseAvailabilityInput>> {
  return writeReserve({ ...args, schema: releaseAvailabilitySchema, direction: 'release' })
}
