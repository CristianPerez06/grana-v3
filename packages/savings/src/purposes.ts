import type { GranaSupabaseClient } from '@grana/supabase'
import {
  savingsPurposeSchema,
  validateActionInput,
  type SavingsPurposeInput,
} from '@grana/validation'
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

export async function createPurpose(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
}): Promise<SavingsMutationResult<SavingsPurposeInput>> {
  const { supabase, userId, input } = args

  const validation = await validateActionInput(savingsPurposeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { name, icon } = validation.data

  const { data, error } = await supabase
    .from('savings_purpose')
    .insert({ user_id: userId, name: name.trim(), icon: icon ?? null })
    .select('id')
    .single()

  if (error?.code === UNIQUE_VIOLATION) {
    return {
      ok: false,
      messageKey: 'savings.purposes.errors.duplicate',
      conflictingName: (await conflictingName(supabase, name)) ?? name.trim(),
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

  const validation = await validateActionInput(savingsPurposeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { name, icon } = validation.data

  // Sin `user_id` en el where: RLS ya acota el update a las filas propias, y
  // repetir el criterio acá sería la duplicación que 0051 dejó de lección.
  const { error } = await supabase
    .from('savings_purpose')
    .update({ name: name.trim(), icon: icon ?? null })
    .eq('id', purposeId)

  if (error?.code === UNIQUE_VIOLATION) {
    return {
      ok: false,
      messageKey: 'savings.purposes.errors.duplicate',
      conflictingName: (await conflictingName(supabase, name)) ?? name.trim(),
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
 * Ponerle —o sacarle— un propósito a una reserva que ya existe.
 *
 * Es el SEGUNDO PAR DE VERBOS del modelo: asignar ⇄ desasignar. Igual que
 * guardar y volver a usar, no mueve plata; pero a diferencia de ellos, tampoco
 * cambia el disponible ni el total guardado. **Es la operación más inofensiva
 * del modelo**: lo único que cambia es para qué es.
 *
 * De ahí que no tenga tope, ni piso, ni confirmación: no hay ningún número que
 * pueda quedar mal. Se puede hacer sobre reservas viejas sin ningún riesgo,
 * porque el número de arriba no se entera.
 *
 * `purposeId` en null desasigna, que es volver la fila a «Sin destino».
 */
export async function assignPurpose(args: {
  supabase: GranaSupabaseClient
  reserveId: string
  purposeId: string | null
}): Promise<SavingsMutationResult> {
  const { supabase, reserveId, purposeId } = args

  // La misma verificación de pertenencia que hace el write path, y por lo mismo:
  // RLS impide LEER el propósito de otro usuario, pero el FK no mira dueños.
  if (purposeId != null) {
    const { data: owned, error: ownedError } = await supabase
      .from('savings_purpose')
      .select('id')
      .eq('id', purposeId)
      .maybeSingle()

    if (ownedError) return { ok: false, errorCode: ownedError.code }
    if (owned == null) return { ok: false, fieldErrors: { purpose_id: 'not_found' } }
  }

  // Sin `user_id` en el where: RLS ya acota el update a las filas propias.
  const { error } = await supabase
    .from('availability_reserve')
    .update({ purpose_id: purposeId })
    .eq('id', reserveId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true, id: reserveId }
}
