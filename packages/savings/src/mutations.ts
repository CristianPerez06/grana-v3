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
import { getAvailableForCurrency, getReservedForPurpose } from './queries'
import type { SavingsMutationResult } from './types'

/**
 * Guardar y liberar comparten casi todo, y lo que cambia es exactamente lo que
 * hace a cada uno lo que es:
 *
 *   guardar   signo +   tope: el DISPONIBLE de esa moneda
 *   liberar   signo −   piso: lo RESERVADO de ese PROPÓSITO en esa moneda
 *
 * Los dos límites se leen del servidor DENTRO de la mutación, nunca de un valor
 * que venga del cliente: la UI ya muestra el número, pero mostrarlo no es
 * validarlo. Entre que el drawer se abrió y el usuario confirmó pudo entrar un
 * gasto, y el tope tiene que mirar el estado de ahora.
 *
 * El piso es por PROPÓSITO desde la fase 2, y la asimetría con el tope es
 * deliberada. Volver a usar $80.000 parado en Emergencia cuando Emergencia tiene
 * $50.000 pasa cualquier control global —el total guardado puede ser $190.000— y
 * deja ese grupo en negativo: afirmaría que se puede gastar plata que el grupo no
 * tiene. Guardar, en cambio, NO se topea por propósito: un propósito no tiene
 * objetivo hasta la fase 4, así que no hay contra qué toparlo.
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

  const { amount, currency_code, date, purpose_id } = validation.data
  const currencyCode = currency_code as BalanceCurrency
  const purposeId = purpose_id ?? null

  // Que el propósito sea del usuario se chequea contra la base y no contra el
  // input. RLS ya impide LEER el de otro, así que un id ajeno vuelve vacío acá;
  // sin este paso la fila se insertaría igual —el FK no mira dueños— y quedaría
  // colgada de una etiqueta que el usuario no controla.
  if (purposeId != null) {
    const { data: owned, error: ownedError } = await supabase
      .from('savings_purpose')
      .select('id')
      .eq('id', purposeId)
      .maybeSingle()

    if (ownedError) return { ok: false, errorCode: ownedError.code }
    if (owned == null) return { ok: false, fieldErrors: { purpose_id: 'not_found' } }
  }

  // El tope y el piso son las dos caras de la misma regla, y son la diferencia
  // deliberada con el ledger: un saldo negativo es un HECHO válido que Grana
  // muestra tal cual, pero guardar más de lo que tenés no es un estado incómodo
  // — es un input inválido. Y el stock reservado no puede quedar negativo, que
  // sería afirmar que podés gastar plata que no tenés.
  //
  // El piso mira UN propósito; el tope mira toda la moneda. Ver el docblock.
  const purposeSums =
    direction === 'release'
      ? await getReservedForPurpose(supabase, currencyCode, purposeId, today)
      : null

  const limit =
    purposeSums != null
      ? purposeSums.reserved
      : (await getAvailableForCurrency(supabase, currencyCode, today)).available

  const requested = Money.from(amount)

  if (Money.compare(requested, Money.from(limit)) > 0) {
    if (direction === 'reserve') {
      return {
        ok: false,
        reason: 'exceeds_available',
        limit,
        messageKey: 'savings.errors.exceeds_available',
      }
    }

    // Dos mensajes distintos, porque son dos hechos distintos: "no tenés tanto
    // guardado" y "no tenés tanto guardado EN ESE PROPÓSITO" se leen igual de mal
    // si se dicen igual, y el segundo es el que confunde — el usuario está
    // mirando un total mayor en la misma pantalla.
    const purposeName = purposeId != null ? (purposeSums?.purposeName ?? null) : null

    if (purposeName == null) {
      return {
        ok: false,
        reason: 'exceeds_reserved',
        limit,
        messageKey: 'savings.errors.exceeds_reserved',
      }
    }

    return {
      ok: false,
      reason: 'exceeds_purpose_reserved',
      limit,
      purposeName,
      messageKey: 'savings.errors.exceeds_purpose_reserved',
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
      purpose_id: purposeId,
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
