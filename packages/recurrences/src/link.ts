// ── Vincular, desvincular y registrar antes del vencimiento ──────────────────
//
// Las tres formas de resolver un vencimiento que este change agrega, más la
// lectura de candidatos. Una sola implementación para web y nativo; auth e
// invalidación de cache quedan en el shell de cada plataforma.
//
// Las escrituras compuestas pasan por RPC de Postgres (0072) y NO por
// orquestadores que compensan: convertir a compartido + vincular, y revertir +
// desvincular, mueven la deuda de un hogar, y una compensación que falla deja esa
// deuda movida por una operación que el usuario no aprobó (decisión 22 de
// `fix-recurrence-backlog`).

import type { GranaSupabaseClient } from '@grana/supabase'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import {
  createExpense,
  createIncome,
  createTransfer,
  registerCardPurchase,
} from '@grana/transactions-mutations'
import {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type InstanceSnapshot,
} from './mapper'
import type { RecurrenceActionResult } from './mutations'
import type { RecurrenceCurrencyCode, RecurrenceMovementType } from './types'

// ── Candidatos ───────────────────────────────────────────────────────────────

export type LinkCandidate = {
  id: string
  date: string
  amount: number
  currency_code: string
  account_id: string | null
  description: string | null
  category_id: string | null
  is_shared: boolean
  /** El movimiento es personal y la regla es compartida: vincularlo lo convierte. */
  needs_conversion: boolean
}

/**
 * Los movimientos que se pueden ofrecer para resolver un vencimiento.
 *
 * Pasa por un RPC y no por un `.select()` porque la lista necesita un NOT EXISTS
 * («no vinculado a NINGUNA ocurrencia»), la ventana derivada del calendario de la
 * regla y el orden por proximidad. Y porque un select de filas de detalle queda
 * recortado en silencio por `max-rows`: acá eso no produce un número mal, produce
 * UN CANDIDATO QUE NO APARECE, y el usuario carga el gasto de nuevo — el duplicado
 * que este change existe para evitar.
 */
export async function getRecurrenceLinkCandidates(
  supabase: GranaSupabaseClient,
  args: { recurrenceId: string; dueDate: string; widen?: boolean },
): Promise<LinkCandidate[]> {
  const { data, error } = await supabase.rpc('recurrence_link_candidates', {
    p_recurrence_id: args.recurrenceId,
    p_due_date: args.dueDate,
    p_widen: args.widen ?? false,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as LinkCandidate[]
}

// ── Por qué no se puede desvincular ──────────────────────────────────────────

/**
 * Qué acción destraba realmente la desvinculación.
 *
 * NO es siempre «revertir»: una liquidación completada se revierte con un
 * contraasiento, y una pendiente de asignación se CANCELA —sólo existe la pata
 * del pagador, que es su propio movimiento—. `reverse_settlement` sólo acepta
 * completadas, así que decir «revertir» sobre una pendiente manda al usuario a
 * una operación que el sistema no ofrece para ese estado.
 *
 * Y cancelar una pendiente es potestad de quien la registró: si la puso el otro
 * miembro, pedirle al usuario que la cancele es pedirle algo que no puede hacer.
 */
export type BlockingSettlements = {
  action: 'revert' | 'cancel_own' | 'cancel_other'
  /** Más de una liquidación vigente bloquea: resolver una sola no alcanza. */
  multiple: boolean
}

/** Lo que el RPC devuelve: lo justo para elegir el consejo. */
export type BlockingSettlementRow = { id: string; status: string; payer_id: string }

/**
 * Qué acción destraba, dadas las liquidaciones que bloquean. Regla pura: la
 * COBERTURA —cuáles bloquean— la decide SQL, que es el único que la ve entera.
 */
export function blockingAction(
  rows: BlockingSettlementRow[],
  userId: string,
): BlockingSettlements | null {
  if (rows.length === 0) return null

  // Se nombra primero lo que el usuario PUEDE hacer. Decirle que otro tiene que
  // cancelar algo, cuando él mismo podría revertir lo que realmente bloquea, lo
  // deja esperando a alguien sin motivo.
  //
  // Una `reversed` sin su contraasiento sigue protegiendo (`settlement_is_live`)
  // y no se cancela: es una reversión a medio escribir, y «revertí» es el
  // consejo más cercano a terminarla.
  const revertible = rows.find((r) => r.status !== 'pending_receipt')
  if (revertible) return { action: 'revert', multiple: rows.length > 1 }

  const own = rows.find((r) => r.payer_id === userId)
  return {
    action: own ? 'cancel_own' : 'cancel_other',
    multiple: rows.length > 1,
  }
}

/**
 * Las liquidaciones que bloquean se leen por RPC, no armando la consulta acá.
 *
 * La fila `settlement` la ven los dos miembros del hogar, pero su FECHA vive en
 * el movimiento del pagador, que es personal: preguntando desde el cliente, una
 * liquidación registrada por el otro miembro no aparece. Eso hacía que el
 * mensaje aconsejara «revertí la liquidación» cuando lo que trababa era una
 * pendiente ajena —ni se revierte, ni puede hacerlo quien lee el mensaje—. El
 * RPC de 0073 contesta con los permisos de la guarda, así que los dos ven lo
 * mismo.
 */
export async function describeBlockingSettlements(
  supabase: GranaSupabaseClient,
  args: { transactionId: string; userId: string },
): Promise<BlockingSettlements | null> {
  const { data } = await supabase.rpc('settlements_blocking_movement', {
    p_transaction_id: args.transactionId,
  })
  return blockingAction((data ?? []) as BlockingSettlementRow[], args.userId)
}

// ── Vincular ─────────────────────────────────────────────────────────────────

/** Los rechazos que el RPC distingue, para que la UI diga cuál fue. */
export type LinkErrorCode =
  | 'movement_incompatible'
  | 'movement_already_linked'
  | 'movement_shared_elsewhere'
  | 'conversion_not_confirmed'
  | 'not_linked'
  | 'not_an_occurrence'
  | 'beyond_limit'
  | 'already_resolved'

const RPC_ERROR_BY_SQLSTATE: Record<string, LinkErrorCode> = {
  GRN11: 'movement_incompatible',
  GRN12: 'movement_already_linked',
  GRN13: 'movement_shared_elsewhere',
  GRN14: 'conversion_not_confirmed',
  GRN15: 'not_linked',
  GRN16: 'not_an_occurrence',
  GRN17: 'beyond_limit',
  GRN18: 'already_resolved',
}

/**
 * ¿Se puede resolver este vencimiento? La respuesta vive en SQL
 * (`recurrence_admits_occurrence`) y la comparten vincular y registrar por
 * anticipado, para que los dos caminos no puedan contestar distinto. Devuelve el
 * motivo del rechazo, o null si se puede.
 */
export async function admitsOccurrence(
  supabase: GranaSupabaseClient,
  args: { recurrenceId: string; dueDate: string },
): Promise<Extract<LinkErrorCode, 'not_an_occurrence' | 'beyond_limit' | 'already_resolved'> | null> {
  const { data, error } = await supabase.rpc('recurrence_admits_occurrence', {
    p_id: args.recurrenceId,
    p_date: args.dueDate,
  })
  if (error) throw new Error(error.message)
  return (data as unknown as 'not_an_occurrence' | 'beyond_limit' | 'already_resolved' | null) ?? null
}

export type LinkResult = RecurrenceActionResult<never> & {
  instanceId?: string
  linkErrorCode?: LinkErrorCode
}

/**
 * Señala un movimiento ya existente como el pago de un vencimiento. NO crea
 * ninguna transacción y no mueve ningún saldo: ese movimiento ya estaba contado.
 *
 * Toma la REGLA y el VENCIMIENTO —no una fila de ocurrencia— porque el
 * vencimiento puede no estar materializado todavía, y el resultado tiene que ser
 * el mismo en los dos casos.
 */
export async function linkMovementToRecurrence(
  supabase: GranaSupabaseClient,
  args: {
    recurrenceId: string
    dueDate: string
    transactionId: string
    confirmConversion?: boolean
  },
): Promise<LinkResult> {
  const { data, error } = await supabase.rpc('recurrence_link_movement', {
    p_recurrence_id: args.recurrenceId,
    p_due_date: args.dueDate,
    p_transaction_id: args.transactionId,
    p_confirm_conversion: args.confirmConversion ?? false,
  })

  if (error) {
    const code = RPC_ERROR_BY_SQLSTATE[error.code ?? '']
    if (code) return { ok: false, linkErrorCode: code }
    return { ok: false, errorCode: error.code, formError: error.message }
  }

  return { ok: true, instanceId: data as unknown as string }
}

// ── Desvincular ──────────────────────────────────────────────────────────────

export type UnlinkResult = RecurrenceActionResult<never> & {
  linkErrorCode?: LinkErrorCode
  /** Presente sólo cuando una liquidación vigente impidió la operación. */
  blockedBy?: BlockingSettlements
}

/**
 * Deshace una vinculación: el movimiento vuelve a estar suelto —no se borra, la
 * recurrencia no lo creó— y el vencimiento vuelve a «por revisar».
 *
 * LAS DOS COSAS VAN JUNTAS O NO VA NINGUNA. Si la vinculación había convertido el
 * movimiento en compartido, desvincular revierte esa conversión en la misma
 * transacción; si la guarda de liquidaciones la rechaza, NADA cambia y se explica
 * qué hay que resolver primero. Un deshacer parcial conservaría una deuda nacida
 * de la vinculación equivocada, que es la mitad del error que más duele.
 */
export async function unlinkMovementFromRecurrence(
  supabase: GranaSupabaseClient,
  args: { instanceId: string; userId: string },
): Promise<UnlinkResult> {
  // Se lee ANTES: si la operación falla, la fila sigue apuntando al movimiento y
  // se puede averiguar qué lo bloquea. Después del intento fallido el estado es
  // el mismo, pero preguntarlo antes evita depender de eso.
  const { data: instance } = await supabase
    .from('recurrence_instances')
    .select('confirmed_transaction_id, linked_conversion')
    .eq('id', args.instanceId)
    .eq('user_id', args.userId)
    .maybeSingle()

  const { error } = await supabase.rpc('recurrence_unlink_movement', {
    p_instance_id: args.instanceId,
  })

  if (!error) return { ok: true }

  const code = RPC_ERROR_BY_SQLSTATE[error.code ?? '']
  if (code) return { ok: false, linkErrorCode: code }

  if (error.code === 'GRN01' && instance?.confirmed_transaction_id) {
    const blockedBy = await describeBlockingSettlements(supabase, {
      transactionId: instance.confirmed_transaction_id as string,
      userId: args.userId,
    })
    return { ok: false, errorCode: 'GRN01', ...(blockedBy ? { blockedBy } : {}) }
  }

  return { ok: false, errorCode: error.code, formError: error.message }
}

// ── Registrar antes del vencimiento ──────────────────────────────────────────

export type RegisterAheadResult = RecurrenceActionResult<never> & {
  transactionId?: string
  instanceId?: string
  linkErrorCode?: LinkErrorCode
}

/**
 * «Ya lo pagué», antes de que el vencimiento llegue.
 *
 * El movimiento se crea con los orquestadores de siempre y DESPUÉS se inserta la
 * ocurrencia YA RESUELTA, con su vencimiento real. Nunca existe una ocurrencia
 * pendiente fechada en el futuro: el bloque de vencimientos por revisar la
 * mostraría, pidiéndole al usuario algo que acaba de pagar.
 *
 * El modo de falla que queda —movimiento creado y ocurrencia sin insertar— es el
 * mismo que ya tiene confirmar, y se compensa igual.
 */
export async function registerRecurrenceAhead(
  supabase: GranaSupabaseClient,
  userId: string,
  args: {
    recurrenceId: string
    dueDate: string
    /** La fecha de pago. Por defecto hoy; es un hecho del usuario, no del calendario. */
    date?: string
    amount?: number
    accountId?: string
    fxRateToArs?: number | null
  },
): Promise<RegisterAheadResult> {
  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select(
      'id, movement_type, amount, status, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description, household_id, default_split',
    )
    .eq('id', args.recurrenceId)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return { ok: false, formError: 'La regla recurrente fue eliminada.' }
  }

  // VALIDAR EL VENCIMIENTO ANTES DE CREAR NADA, con la misma regla SQL que usa
  // vincular: que sea una posición real del calendario, que no supere el
  // límite, y que no esté ya resuelta (registrarla otra vez sería el duplicado
  // que este change existe para evitar). Se pregunta ANTES de crear el
  // movimiento: rechazar después dejaría un gasto huérfano que compensar.
  const reason = await admitsOccurrence(supabase, {
    recurrenceId: args.recurrenceId,
    dueDate: args.dueDate,
  })
  if (reason) return { ok: false, linkErrorCode: reason }

  const { data: existing } = await supabase
    .from('recurrence_instances')
    .select('id, status')
    .eq('recurrence_id', args.recurrenceId)
    .eq('due_date', args.dueDate)
    .maybeSingle()

  const accountId = args.accountId ?? (rule.account_id as string)
  const { data: account } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (!account) return { ok: false, formError: 'La cuenta de la regla no existe.' }
  if (!account.is_active) {
    return { ok: false, formError: 'La cuenta de la regla está archivada. Elegí otra.' }
  }

  const effective: InstanceSnapshot = {
    account_id: accountId,
    transfer_destination_account_id: rule.transfer_destination_account_id,
    currency_code: rule.currency_code as RecurrenceCurrencyCode,
    amount: args.amount ?? Number(rule.amount),
    // La fecha de pago, que por defecto es hoy. El vencimiento NO se toca: son
    // dos hechos distintos, y el de la regla es el que da identidad a la
    // ocurrencia.
    date: args.date ?? formatDateISO(getTodayAR()),
    category_id: rule.category_id,
    subcategory_id: rule.subcategory_id,
    description: rule.description,
    household_id: rule.household_id,
    split: rule.default_split,
  }

  let plan
  try {
    plan = mapInstanceToConfirmPlan(effective, {
      movementType: rule.movement_type as RecurrenceMovementType,
      accountType: account.type as 'cash' | 'bank' | 'credit',
      fxRateToArs: args.fxRateToArs ?? null,
    })
  } catch (error) {
    if (error instanceof RecurrenceMapError) return { ok: false, mapErrorCode: error.code }
    throw error
  }

  let delegated: { ok: true; id?: string } | { ok: false; formError?: string }
  if (plan.kind === 'income') {
    delegated = await createIncome(supabase, userId, plan.input)
  } else if (plan.kind === 'expense') {
    delegated = await createExpense(supabase, userId, plan.input, getTodayAR())
  } else if (plan.kind === 'transfer') {
    delegated = await createTransfer(supabase, userId, plan.input)
  } else {
    delegated = await registerCardPurchase({
      supabase,
      userId,
      input: plan.input,
      today: getTodayAR(),
    })
  }

  if (!delegated.ok || !delegated.id) {
    return {
      ok: false,
      formError:
        ('formError' in delegated && delegated.formError) ||
        'No se pudo registrar el movimiento.',
    }
  }

  const transactionId = delegated.id

  // La ocurrencia se escribe YA RESUELTA. `resolution_kind` va explícito aunque
  // el trigger de compatibilidad pondría 'created' igual: lo que decide qué hace
  // deshacer no se deja a un default.
  const resolved = {
    status: 'confirmed' as const,
    confirmed_transaction_id: transactionId,
    resolution_kind: 'created' as const,
    resolved_at: new Date().toISOString(),
    amount: effective.amount,
    account_id: effective.account_id,
    category_id: effective.category_id,
    subcategory_id: effective.subcategory_id,
    description: effective.description,
  }

  const written = existing
    ? await supabase
        .from('recurrence_instances')
        .update(resolved)
        .eq('id', existing.id)
        .eq('status', 'pending')
        .select('id')
    : await supabase
        .from('recurrence_instances')
        .insert({
          recurrence_id: args.recurrenceId,
          user_id: userId,
          due_date: args.dueDate,
          // Espejo legacy, como hace el generador: no se lee como vencimiento.
          scheduled_date: args.dueDate,
          currency_code: rule.currency_code,
          transfer_destination_account_id: rule.transfer_destination_account_id,
          household_id: rule.household_id,
          split: rule.default_split,
          ...resolved,
        })
        .select('id')

  if (written.error || !written.data || written.data.length === 0) {
    // Mismo rollback compensatorio que confirmar: sin esto queda un movimiento
    // huérfano que el usuario no puede relacionar con nada.
    await supabase.from('transactions').delete().eq('id', transactionId)
    return {
      ok: false,
      formError: written.error?.message ?? 'No se pudo registrar el vencimiento.',
    }
  }

  return { ok: true, transactionId, instanceId: written.data[0].id }
}
