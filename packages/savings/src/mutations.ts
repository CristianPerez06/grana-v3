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
  const { supabase, input, schema, direction } = args
  const today = args.today ?? getTodayAR()

  const validation = await validateActionInput(schema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { amount, currency_code, date, purpose_id } = validation.data
  const currencyCode = currency_code as BalanceCurrency
  const purposeId = purpose_id ?? null

  // El tope y el piso son las dos caras de la misma regla, y son la diferencia
  // deliberada con el ledger: un saldo negativo es un HECHO válido que Grana
  // muestra tal cual, pero guardar más de lo que tenés no es un estado incómodo
  // — es un input inválido.
  //
  // El piso mira EL GRUPO del que sale, no toda la moneda: si Japón tiene
  // $150.000 y el resto $40.000, volver a usar $60.000 del resto pasa cualquier
  // control sobre el total de $190.000 y deja ese grupo en negativo.
  const groupSums =
    direction === 'release'
      ? await getReservedForPurpose(supabase, currencyCode, purposeId, today)
      : null

  const limit =
    groupSums != null
      ? groupSums.reserved
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

    // Dos mensajes distintos porque son dos hechos distintos: "no tenés tanto
    // guardado" y "no tenés tanto guardado EN ESE PROPÓSITO" se leen igual de mal
    // si se dicen igual, y el segundo es el que confunde — el usuario está
    // mirando un total mayor en la misma pantalla.
    const purposeName = purposeId != null ? (groupSums?.purposeName ?? null) : null

    if (purposeName == null) {
      // El tope acá es el RESTO sin destino, no el guardado total: decir "más de
      // lo que tenés guardado: $55.000" con $180.000 guardados a la vista es
      // falso. El cliente puede afinar más —si el usuario no tiene ni un
      // propósito, «sin destino» sería jerga y dice "guardado"—; el servidor no
      // sabe eso y prefiere la frase que siempre es verdad. Este mensaje solo
      // aparece en una carrera: el del cliente llega antes.
      return {
        ok: false,
        reason: 'exceeds_reserved',
        limit,
        messageKey: 'savings.errors.exceeds_unassigned_reserved',
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

  // Una sola llamada, no dos inserts: guardar "para Japón" son DOS filas en dos
  // tablas, y escribirlas por separado deja la mitad si falla la red entre una y
  // otra. `write_reserve` las pone en la misma transacción, y además vuelve a
  // chequear el invariante del lado de la base — el control de acá existe para
  // dar un mensaje con el número, no para ser la única defensa.
  const { data, error } = await supabase.rpc('write_reserve', {
    p_amount: signed,
    p_currency: currencyCode,
    p_date: formatDateISO(date),
    p_purpose_id: purposeId,
  })

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: (data as unknown as string) ?? '' }
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
