import type { GranaSupabaseClient } from '@grana/supabase'
import {
  Money,
  purposeAllocationSchema,
  savingsPurposeSchema,
  validateActionInput,
  type PurposeAllocationInput,
  type SavingsPurposeInput,
} from '@grana/validation'
import { formatDateISO, getTodayAR, type BalanceCurrency } from '@grana/money-logic'
import { getReservedForPurpose } from './queries'
import type { Purpose, SavingsMutationResult } from './types'

/** Código de Postgres para violación de índice único. */
const UNIQUE_VIOLATION = '23505'

/**
 * Los propósitos del usuario, alfabéticos.
 *
 * Sin `.limit()` a propósito, y a diferencia del historial: los propósitos son
 * una lista que el usuario crea a mano, de a uno, y que en la práctica tiene
 * unidades. El historial crece solo con el uso; esto no.
 */
export async function listPurposes(supabase: GranaSupabaseClient): Promise<Purpose[]> {
  const { data, error } = await supabase
    .from('savings_purpose')
    .select('id, name, icon')
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
  }))
}

/**
 * El nombre que ya ocupa el lugar, para poder decirlo.
 *
 * El índice único normaliza con `lower(btrim(name))`, así que el choque puede
 * ser contra un nombre escrito distinto: quien intenta "emergencia" chocó contra
 * "Emergencia". Devolver el existente permite que el mensaje muestre CUÁL es, en
 * vez de un "ya existe" que deja al usuario buscándolo.
 */
async function conflictingName(
  supabase: GranaSupabaseClient,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('savings_purpose')
    .select('name')
    .ilike('name', name.trim())
    .maybeSingle()

  return data?.name ?? null
}

/**
 * Recorta el nombre ANTES de validar.
 *
 * El schema es `.strict()`, y en ese modo el `.trim()` de Yup deja de recortar y
 * pasa a EXIGIR que el string ya venga recortado: «Prueba » se rechaza en vez de
 * guardarse como «Prueba». Un espacio de más al final es el error de tipeo más
 * común que existe —lo deja el autocompletado del teclado en teléfono— y no es
 * algo que el usuario pueda ver ni corregir mirando el campo.
 *
 * Se normaliza acá y no en cada formulario porque el paquete es el que usan las
 * dos plataformas: arreglarlo en la web dejaría el mismo bug esperando en mobile.
 */
const withTrimmedName = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && 'name' in input
    ? { ...input, name: typeof input.name === 'string' ? input.name.trim() : input.name }
    : input

export async function createPurpose(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
}): Promise<SavingsMutationResult<SavingsPurposeInput>> {
  const { supabase, userId, input } = args

  const validation = await validateActionInput(savingsPurposeSchema, withTrimmedName(input))
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { name, icon } = validation.data

  const { data, error } = await supabase
    .from('savings_purpose')
    .insert({ user_id: userId, name, icon: icon ?? null })
    .select('id')
    .single()

  if (error?.code === UNIQUE_VIOLATION) {
    return {
      ok: false,
      messageKey: 'savings.purposes.errors.duplicate',
      conflictingName: (await conflictingName(supabase, name)) ?? name,
    }
  }
  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: data.id }
}

export async function renamePurpose(args: {
  supabase: GranaSupabaseClient
  purposeId: string
  input: unknown
}): Promise<SavingsMutationResult<SavingsPurposeInput>> {
  const { supabase, purposeId, input } = args

  const validation = await validateActionInput(savingsPurposeSchema, withTrimmedName(input))
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { name, icon } = validation.data

  // Sin `user_id` en el where: RLS ya acota el update a las filas propias, y
  // repetir el criterio acá sería la duplicación que 0051 dejó de lección.
  const { error } = await supabase
    .from('savings_purpose')
    .update({ name, icon: icon ?? null })
    .eq('id', purposeId)

  if (error?.code === UNIQUE_VIOLATION) {
    return {
      ok: false,
      messageKey: 'savings.purposes.errors.duplicate',
      conflictingName: (await conflictingName(supabase, name)) ?? name,
    }
  }
  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: purposeId }
}

/**
 * Borrar un propósito NO borra plata.
 *
 * La regla vive en el schema (`ON DELETE SET NULL`, migración 0058, con un
 * self-check que falla la migración si alguien la cambia): las reservas
 * sobreviven y vuelven a «Sin destino». Acá no hay nada que hacer para
 * conseguirlo, y eso es exactamente lo que se quería — que no dependa de que
 * cada call site se acuerde.
 *
 * El aviso con el monto es de la UI, no de acá: este paquete no traduce.
 */
export async function deletePurpose(args: {
  supabase: GranaSupabaseClient
  purposeId: string
}): Promise<SavingsMutationResult> {
  const { error } = await args.supabase
    .from('savings_purpose')
    .delete()
    .eq('id', args.purposeId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: args.purposeId }
}

/**
 * Repartir lo guardado: **destinar** a un propósito, o **quitarle el destino**
 * para devolverlo al resto.
 *
 * Es el segundo par de verbos del modelo. Igual que guardar y volver a usar, no
 * mueve plata; pero a diferencia de ellos, **tampoco cambia el disponible ni el
 * total guardado** — lo que entra en un grupo sale de otro.
 *
 * Reemplaza al etiquetado de una fila del historial, que era la forma anterior y
 * estaba mal: no existen "los $300.000 guardados el 15/7", existe "hay $190.000
 * guardados". La plata guardada es fungible, igual que no está en una cuenta
 * puntual. Y el etiquetado por fila ni siquiera podía expresar la mayoría de los
 * repartos: para decir "150.000 son para Japón" tenía que existir una fila de
 * exactamente 150.000.
 *
 * `amount` es SIEMPRE positivo; la dirección la elige el verbo. El piso de cada
 * dirección se lee del servidor y además lo vuelve a exigir el trigger de la
 * base, que es el que no se puede olvidar.
 */
async function writeAllocation(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  direction: 'allocate' | 'unallocate'
  today?: Date
}): Promise<SavingsMutationResult<PurposeAllocationInput>> {
  const { supabase, userId, input, direction } = args
  const today = args.today ?? getTodayAR()

  const validation = await validateActionInput(purposeAllocationSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { amount, currency_code, date, purpose_id } = validation.data
  const currencyCode = currency_code as BalanceCurrency

  // Destinar sale del RESTO; quitar sale del propósito. Las dos direcciones miran
  // el mismo corte, en grupos distintos.
  const source = await getReservedForPurpose(
    supabase,
    currencyCode,
    direction === 'allocate' ? null : purpose_id,
    today,
  )

  const requested = Money.from(amount)

  if (Money.compare(requested, Money.from(source.reserved)) > 0) {
    return {
      ok: false,
      reason: direction === 'allocate' ? 'exceeds_unassigned' : 'exceeds_purpose_reserved',
      limit: source.reserved,
      purposeName: source.purposeName,
      messageKey:
        direction === 'allocate'
          ? 'savings.purposes.errors.exceeds_unassigned'
          : 'savings.purposes.errors.exceeds_allocated',
    }
  }

  const signed =
    direction === 'allocate'
      ? amount
      : Money.toNumber(Money.subtract(Money.from(0), requested))

  const { data, error } = await supabase
    .from('savings_purpose_allocation')
    .insert({
      user_id: userId,
      purpose_id,
      currency_code: currencyCode,
      amount: signed,
      date: formatDateISO(date),
    })
    .select('id')
    .single()

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: data.id }
}

/** Destinar a un propósito parte de lo que está guardado sin destino. */
export async function allocateToPurpose(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today?: Date
}): Promise<SavingsMutationResult<PurposeAllocationInput>> {
  return writeAllocation({ ...args, direction: 'allocate' })
}

/**
 * Quitarle el destino a parte de lo destinado: vuelve al resto, sigue guardado.
 *
 * NO es lo mismo que volver a usar. Volver a usar saca la plata de lo guardado y
 * la devuelve al disponible; quitar el destino la deja guardada y solo le saca
 * el para qué.
 */
export async function unallocateFromPurpose(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today?: Date
}): Promise<SavingsMutationResult<PurposeAllocationInput>> {
  return writeAllocation({ ...args, direction: 'unallocate' })
}
