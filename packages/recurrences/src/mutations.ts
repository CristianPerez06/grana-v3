import type { GranaSupabaseClient } from '@grana/supabase'
import { getTodayAR, presetToInterval, type IntervalUnit } from '@grana/money-logic'
import {
  acceptRecurrenceSuggestionSchema,
  confirmRecurrenceInstanceSchema,
  createIncomeRecurrenceSchema,
  createExpenseRecurrenceSchema,
  createTransferRecurrenceSchema,
  dismissRecurrenceSuggestionSchema,
  updateRecurrenceSchema,
  validateActionInput,
  type AcceptRecurrenceSuggestionInput,
  type ConfirmRecurrenceInstanceInput,
  type CreateRecurrenceInput,
  type DismissRecurrenceSuggestionInput,
  type UpdateRecurrenceInput,
} from '@grana/validation'
import {
  createExpense,
  createIncome,
  createTransfer,
  deleteTransaction,
  registerCardPurchase,
} from '@grana/transactions-mutations'
import { generateDueRecurrenceInstances } from './queries'
import {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type InstanceSnapshot,
  type RecurrenceMapErrorCode,
} from './mapper'
import type { RecurrenceCurrencyCode, RecurrenceMovementType } from './types'

// Isomorphic result of a recurrence mutation. Mirrors the web ActionResult plus
// the extras platform shells localize: `errorCode` (a Postgres error code the
// shell maps via its error translator) and `mapErrorCode` (a RecurrenceMapError
// code the shell maps via `recurrences.mapper_errors`). Auth + cache
// invalidation stay in each platform's shell.
export type RecurrenceActionResult<T> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
      mapErrorCode?: RecurrenceMapErrorCode
    }

// The household context `createRecurrence` needs to validate a shared expense
// rule. Fetched by the shell (web `getHousehold`, mobile's thin mirror) and
// injected, so the package stays free of the platform's household read.
export type RecurrenceHousehold = {
  id: string
  members: { userId: string }[]
} | null

// Verifica que la cuenta pertenezca al usuario, esté activa y tenga la moneda
// activa (la activación de moneda vive en account_currencies, no en accounts).
// Devuelve un mensaje de error o null si la cuenta es usable.
async function assertAccountUsable(
  supabase: GranaSupabaseClient,
  userId: string,
  accountId: string,
  currencyCode: string,
  labels: { notFound: string; archived: string; currency: string },
): Promise<string | null> {
  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, is_active')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()
  if (error || !account) return labels.notFound
  if (!account.is_active) return labels.archived

  const { data: currency } = await supabase
    .from('account_currencies')
    .select('id')
    .eq('account_id', accountId)
    .eq('currency_code', currencyCode)
    .eq('is_active', true)
    .single()
  if (!currency) return labels.currency
  return null
}

// ── createRecurrence ──────────────────────────────────────────────────────────
// Crea una regla recurrente desde cero, sin movimiento de origen. A diferencia
// de createRecurrenceFromMovement no hay transacción semilla, así que
// last_generated_date queda en null: el generador produce la PRIMERA instancia
// para start_date (ver decideRecurrenceInstance). created_from_transaction_id es
// siempre null. No crea ninguna transacción real ni instancia en este momento.
// El `household` (para reglas compartidas) lo inyecta el shell.

export async function createRecurrence(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
  household: RecurrenceHousehold,
): Promise<RecurrenceActionResult<CreateRecurrenceInput> & { id?: string }> {
  const movementType = (input as { movement_type?: unknown } | null)?.movement_type

  let data: CreateRecurrenceInput
  if (movementType === 'income') {
    const validation = await validateActionInput(createIncomeRecurrenceSchema, input)
    if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }
    data = validation.data
  } else if (movementType === 'expense') {
    const validation = await validateActionInput(createExpenseRecurrenceSchema, input)
    if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }
    data = validation.data
  } else if (movementType === 'transfer') {
    const validation = await validateActionInput(createTransferRecurrenceSchema, input)
    if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }
    data = validation.data
  } else {
    // Excluye adjustment/exchange y cualquier tipo no soportado por recurrencia.
    return { ok: false, formError: 'Tipo de movimiento inválido para una recurrencia.' }
  }

  // Invariantes por tipo (el schema cubre la forma; acá reforzamos pertenencia).
  if (data.movement_type === 'transfer') {
    if (data.transfer_destination_account_id === data.account_id) {
      return { ok: false, formError: 'La cuenta origen y destino no pueden ser iguales.' }
    }
  }

  // Cuenta origen: pertenencia + estado + moneda activa (bimoneda: nunca mezclar).
  const originError = await assertAccountUsable(
    supabase,
    userId,
    data.account_id,
    data.currency_code,
    {
      notFound: 'Cuenta no encontrada.',
      archived: 'La cuenta está archivada.',
      currency: 'La cuenta no tiene esa moneda activa.',
    },
  )
  if (originError) return { ok: false, formError: originError }

  // Cuenta destino (solo transfer): misma validación.
  if (data.movement_type === 'transfer') {
    const destError = await assertAccountUsable(
      supabase,
      userId,
      data.transfer_destination_account_id,
      data.currency_code,
      {
        notFound: 'La cuenta destino no existe.',
        archived: 'La cuenta destino está archivada.',
        currency: 'La cuenta destino no tiene esa moneda activa.',
      },
    )
    if (destError) return { ok: false, formError: destError }
  }

  // Presets derivan su intervalo; 'custom' lo trae explícito.
  const interval =
    data.frequency === 'custom'
      ? { count: data.interval_count as number, unit: data.interval_unit as IntervalUnit }
      : presetToInterval(data.frequency)

  const destinationAccountId =
    data.movement_type === 'transfer' ? data.transfer_destination_account_id : null
  const categoryId = data.movement_type === 'transfer' ? null : data.category_id
  const subcategoryId =
    data.movement_type === 'transfer' ? null : data.subcategory_id ?? null

  // Recurrencia compartida (solo gasto): validamos pertenencia al hogar y que el
  // reparto cubra exactamente a sus miembros. Es defensa en profundidad y mejor
  // UX; la inserción del split al confirmar también está protegida por RLS. El
  // template (default_split) se siembra en cada instancia al generarse.
  let sharedHouseholdId: string | null = null
  let defaultSplit: { user_id: string; percentage: number }[] | null = null
  if (data.movement_type === 'expense' && data.shared) {
    if (!household || household.members.length < 2) {
      return { ok: false, formError: 'No tenés un hogar de dos miembros para compartir.' }
    }
    if (household.id !== data.shared.household_id) {
      return { ok: false, formError: 'El hogar indicado no coincide con el tuyo.' }
    }
    const memberIds = new Set(household.members.map((m) => m.userId))
    const splitIds = data.shared.splits.map((s) => s.user_id)
    if (splitIds.length !== memberIds.size || !splitIds.every((id) => memberIds.has(id))) {
      return {
        ok: false,
        formError: 'El reparto debe incluir exactamente a los miembros del hogar.',
      }
    }
    sharedHouseholdId = data.shared.household_id
    defaultSplit = data.shared.splits
  }

  const { data: recurrence, error: insertError } = await supabase
    .from('recurrences')
    .insert({
      user_id: userId,
      movement_type: data.movement_type,
      account_id: data.account_id,
      transfer_destination_account_id: destinationAccountId,
      currency_code: data.currency_code,
      amount: data.amount,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      description: data.description ?? null,
      frequency: data.frequency,
      interval_count: interval.count,
      interval_unit: interval.unit,
      max_occurrences: data.max_occurrences ?? null,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      // No hay ocurrencia semilla: la primera instancia se genera para start_date.
      last_generated_date: null,
      status: 'active',
      created_from_transaction_id: null,
      household_id: sharedHouseholdId,
      default_split: defaultSplit,
    } as never)
    .select('id')
    .single()

  if (insertError || !recurrence) {
    return {
      ok: false,
      formError: insertError?.message ?? 'No se pudo crear la regla recurrente.',
    }
  }

  // Eagerly materialize the first due instance (start_date is today/past) so the
  // "por confirmar" aviso shows without a manual refresh. Idempotent via the
  // one-pending-per-rule unique index.
  await generateDueRecurrenceInstances(supabase, userId)

  return { ok: true, id: (recurrence as { id: string }).id }
}

// ── confirmRecurrenceInstance ─────────────────────────────────────────────────
// Confirma una instancia pendiente. Crea la transacción real delegando en los
// thin creates de @grana/transactions-mutations según el tipo de movimiento.
// Aplica D6: si el usuario cambia el monto al confirmar, propaga ese monto a la
// regla recurrente.

export async function confirmRecurrenceInstance(
  supabase: GranaSupabaseClient,
  userId: string,
  instanceId: string,
  overrides: unknown,
): Promise<
  RecurrenceActionResult<ConfirmRecurrenceInstanceInput> & { transactionId?: string }
> {
  const validation = await validateActionInput(
    confirmRecurrenceInstanceSchema,
    overrides,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const payload = validation.data

  const { data: instance, error: instanceError } = await supabase
    .from('recurrence_instances')
    .select(
      'id, recurrence_id, status, scheduled_date, amount, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description, household_id, split',
    )
    .eq('id', instanceId)
    .eq('user_id', userId)
    .single()

  if (instanceError || !instance) {
    return { ok: false, formError: 'Instancia recurrente no encontrada.' }
  }

  if (instance.status !== 'pending') {
    return { ok: false, formError: 'Esta instancia ya fue resuelta.' }
  }

  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, movement_type, amount, status')
    .eq('id', instance.recurrence_id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return { ok: false, formError: 'La regla recurrente fue eliminada.' }
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', instance.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'La cuenta de la regla no existe.' }
  }
  if (!account.is_active) {
    return {
      ok: false,
      formError:
        'La cuenta de la regla está archivada. Editá la regla antes de confirmar.',
    }
  }

  const effective: InstanceSnapshot = {
    account_id: instance.account_id,
    transfer_destination_account_id: instance.transfer_destination_account_id,
    currency_code: instance.currency_code as RecurrenceCurrencyCode,
    amount: payload.amount ?? Number(instance.amount),
    scheduled_date: payload.date ?? instance.scheduled_date,
    category_id:
      payload.category_id !== undefined ? payload.category_id : instance.category_id,
    subcategory_id:
      payload.subcategory_id !== undefined
        ? payload.subcategory_id
        : instance.subcategory_id,
    description:
      payload.description !== undefined ? payload.description : instance.description,
    // Shared recurrence: the mapper turns these into `shared` on the expense /
    // card-purchase plan, so the confirmed movement is created shared.
    household_id: instance.household_id,
    split: instance.split,
  }

  let plan
  try {
    plan = mapInstanceToConfirmPlan(effective, {
      movementType: rule.movement_type as RecurrenceMovementType,
      accountType: account.type as 'cash' | 'bank' | 'credit',
      fxRateToArs: payload.fx_rate_to_ars ?? null,
    })
  } catch (error) {
    if (error instanceof RecurrenceMapError) {
      return { ok: false, mapErrorCode: error.code }
    }
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

  const { data: linked, error: linkError } = await supabase
    .from('recurrence_instances')
    .update({
      status: 'confirmed',
      confirmed_transaction_id: transactionId,
      resolved_at: new Date().toISOString(),
      amount: effective.amount,
      scheduled_date: effective.scheduled_date,
      category_id: effective.category_id,
      subcategory_id: effective.subcategory_id,
      description: effective.description,
    })
    .eq('id', instanceId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')

  if (linkError || !linked || linked.length === 0) {
    // Rollback the transaction we just created — otherwise we leak an orphan.
    await supabase.from('transactions').delete().eq('id', transactionId)
    return {
      ok: false,
      formError:
        linkError?.message ?? 'La instancia fue resuelta por otro proceso.',
    }
  }

  // D6: si el usuario cambió el monto al confirmar, propagá a la regla.
  // last_generated_date usa el scheduled_date ORIGINAL (no la override), para
  // que la siguiente generación mantenga el ritmo de la regla.
  const ruleUpdates: { last_generated_date: string; amount?: number } = {
    last_generated_date: instance.scheduled_date,
  }
  if (payload.amount !== undefined && payload.amount !== Number(rule.amount)) {
    ruleUpdates.amount = payload.amount
  }
  await supabase.from('recurrences').update(ruleUpdates).eq('id', rule.id)

  return { ok: true, transactionId }
}

// ── skipRecurrenceInstance ────────────────────────────────────────────────────
// Marca una instancia pendiente como omitida. No crea transacción. Avanza el
// cursor de la regla (last_generated_date) para que la generación pase a la
// siguiente fecha y no vuelva a generar la misma instancia.

export async function skipRecurrenceInstance(
  supabase: GranaSupabaseClient,
  userId: string,
  instanceId: string,
): Promise<RecurrenceActionResult<never>> {
  const { data: instance, error: instanceError } = await supabase
    .from('recurrence_instances')
    .select('id, recurrence_id, status, scheduled_date')
    .eq('id', instanceId)
    .eq('user_id', userId)
    .single()

  if (instanceError || !instance) {
    return { ok: false, formError: 'Instancia recurrente no encontrada.' }
  }

  if (instance.status !== 'pending') {
    return { ok: false, formError: 'Esta instancia ya fue resuelta.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('recurrence_instances')
    .update({
      status: 'skipped',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    return {
      ok: false,
      formError:
        updateError?.message ?? 'La instancia fue resuelta por otro proceso.',
    }
  }

  await supabase
    .from('recurrences')
    .update({ last_generated_date: instance.scheduled_date })
    .eq('id', instance.recurrence_id)
    .eq('user_id', userId)

  return { ok: true }
}

// ── updateRecurrence ──────────────────────────────────────────────────────────
// Edita la regla. No toca instancias pendientes ya generadas: ellas conservan
// el snapshot anterior (el usuario puede skip/confirm normalmente). La próxima
// generación usará la regla nueva.

export async function updateRecurrence(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
  input: unknown,
): Promise<RecurrenceActionResult<UpdateRecurrenceInput>> {
  const validation = await validateActionInput(updateRecurrenceSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { data: current, error: currentError } = await supabase
    .from('recurrences')
    .select(
      'id, movement_type, account_id, transfer_destination_account_id, start_date, end_date, status',
    )
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (currentError || !current) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (current.status === 'deleted') {
    return { ok: false, formError: 'La regla está eliminada y no se puede editar.' }
  }

  const updates = validation.data

  const mergedAccount = updates.account_id ?? current.account_id
  const mergedDestination =
    'transfer_destination_account_id' in updates
      ? (updates.transfer_destination_account_id ?? null)
      : current.transfer_destination_account_id
  const mergedStart = updates.start_date ?? current.start_date
  const mergedEnd =
    'end_date' in updates ? (updates.end_date ?? null) : current.end_date

  if (current.movement_type === 'transfer') {
    if (!mergedDestination) {
      return { ok: false, formError: 'La transferencia requiere cuenta destino.' }
    }
    if (mergedDestination === mergedAccount) {
      return {
        ok: false,
        formError: 'La cuenta origen y destino no pueden ser iguales.',
      }
    }
  } else if (mergedDestination != null) {
    return {
      ok: false,
      formError: 'Solo las transferencias usan cuenta destino.',
    }
  }

  if (mergedEnd != null && mergedEnd < mergedStart) {
    return {
      ok: false,
      formError: 'La fecha de fin debe ser posterior o igual al inicio.',
    }
  }

  type RecurrencePatch = {
    account_id?: string
    transfer_destination_account_id?: string | null
    currency_code?: string
    amount?: number
    category_id?: string | null
    subcategory_id?: string | null
    description?: string | null
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom'
    interval_count?: number
    interval_unit?: IntervalUnit
    max_occurrences?: number | null
    start_date?: string
    end_date?: string | null
  }

  const patch: RecurrencePatch = {}
  if (updates.account_id !== undefined) patch.account_id = updates.account_id
  if (updates.currency_code !== undefined) patch.currency_code = updates.currency_code
  if (updates.amount !== undefined) patch.amount = updates.amount
  if (updates.frequency !== undefined) {
    patch.frequency = updates.frequency as RecurrencePatch['frequency']
    // Keep the interval in sync with the label: presets derive it; 'custom'
    // takes the explicit interval from the same payload.
    if (updates.frequency === 'custom') {
      if (updates.interval_count !== undefined) {
        patch.interval_count = updates.interval_count
      }
      if (updates.interval_unit !== undefined) {
        patch.interval_unit = updates.interval_unit as IntervalUnit
      }
    } else {
      const preset = presetToInterval(updates.frequency)
      patch.interval_count = preset.count
      patch.interval_unit = preset.unit
    }
  }
  if ('max_occurrences' in updates) {
    patch.max_occurrences = updates.max_occurrences ?? null
  }
  if (updates.start_date !== undefined) patch.start_date = updates.start_date
  if ('transfer_destination_account_id' in updates) {
    patch.transfer_destination_account_id =
      updates.transfer_destination_account_id ?? null
  }
  if ('category_id' in updates) patch.category_id = updates.category_id ?? null
  if ('subcategory_id' in updates) {
    patch.subcategory_id = updates.subcategory_id ?? null
  }
  if ('description' in updates) patch.description = updates.description ?? null
  if ('end_date' in updates) patch.end_date = updates.end_date ?? null

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error: updateError } = await supabase
    .from('recurrences')
    .update(patch as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError) return { ok: false, formError: updateError.message }

  return { ok: true }
}

// ── pauseRecurrence / resumeRecurrence ─────────────────────────────────────────
// Pausar detiene futuras generaciones (que solo procesan status='active'). No
// toca instancias pendientes ya generadas — el usuario puede confirmarlas u
// omitirlas. Reanudar simplemente vuelve a 'active'; la próxima generación se
// computa desde last_generated_date como siempre (D8). Los errores de Postgres
// viajan por `errorCode` para que el shell los localice.

export async function pauseRecurrence(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
): Promise<RecurrenceActionResult<never>> {
  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return { ok: false, formError: 'La regla está eliminada.' }
  }
  if (rule.status === 'paused') return { ok: true }

  const { error } = await supabase
    .from('recurrences')
    .update({ status: 'paused' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

export async function resumeRecurrence(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
): Promise<RecurrenceActionResult<never>> {
  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return {
      ok: false,
      formError: 'La regla está eliminada y no puede reactivarse.',
    }
  }
  if (rule.status === 'active') return { ok: true }

  const { error } = await supabase
    .from('recurrences')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── deleteRecurrence (soft-delete) ─────────────────────────────────────────────
// Soft-delete: la regla queda con status='deleted' para no romper la integridad
// referencial de instancias confirmadas (mantienen su recurrence_id para audit).
// Las instancias pendientes se BORRAN porque son propuestas, no movimientos
// reales — el usuario ya decidió no seguir con la regla (D8). Las transacciones
// reales ya confirmadas NO se tocan.

export async function deleteRecurrence(
  supabase: GranaSupabaseClient,
  userId: string,
  id: string,
): Promise<RecurrenceActionResult<never>> {
  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') return { ok: true }

  const { error: updateError } = await supabase
    .from('recurrences')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError) return { ok: false, formError: updateError.message }

  const { error: deleteError } = await supabase
    .from('recurrence_instances')
    .delete()
    .eq('recurrence_id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (deleteError) {
    return { ok: false, formError: deleteError.message }
  }

  return { ok: true }
}

// ── deleteMovementResolvingRecurrence ─────────────────────────────────────────
// Borrar un movimiento que sembró una regla recurrente, resolviendo la regla
// primero. Desde 0053 el FK es ON DELETE RESTRICT: la base rechaza el borrado
// mientras la regla lo apunte, así que la decisión del usuario es obligatoria.
//
// Vive acá y no en @grana/transactions-mutations por la dirección de la
// dependencia: este paquete ya consume aquél (nunca al revés), y la rama
// 'delete_rule' necesita `deleteRecurrence` con su limpieza de instancias
// pendientes, que no se duplica.
//
//   'delete_rule'  elimina la regla (soft-delete + borra sus pendientes) y luego
//                  el movimiento. Las transacciones ya confirmadas se conservan.
//   'unlink'       conserva la regla, la desvincula y —si su cursor apuntaba a la
//                  semilla futura que se está borrando— lo repara. Lo ejecuta
//                  `deleteTransaction` con `seedResolution: 'unlink'`.

export type SeededRecurrenceResolution = 'delete_rule' | 'unlink'

export async function deleteMovementResolvingRecurrence(args: {
  supabase: GranaSupabaseClient
  userId: string
  transactionId: string
  recurrenceId: string
  resolution: SeededRecurrenceResolution
  today?: string
}): Promise<RecurrenceActionResult<never>> {
  const { supabase, userId, transactionId, recurrenceId, resolution, today } = args

  if (resolution === 'delete_rule') {
    const ruleResult = await deleteRecurrence(supabase, userId, recurrenceId)
    if (!ruleResult.ok) return ruleResult

    // La regla quedó en 'deleted' pero la FILA sigue existiendo (conserva la
    // trazabilidad de los movimientos que ya confirmó), así que su FK todavía
    // apunta al movimiento y RESTRICT bloquearía el borrado. `deleteTransaction`
    // desvincula sin preguntar cuando la regla ya está soft-deleted: no hay nada
    // que decidir sobre una regla que el usuario acaba de eliminar.
    const txResult = await deleteTransaction(supabase, userId, transactionId, { today })
    return txResult.ok ? { ok: true } : { ok: false, errorCode: txResult.errorCode }
  }

  const txResult = await deleteTransaction(supabase, userId, transactionId, {
    seedResolution: 'unlink',
    today,
  })
  return txResult.ok ? { ok: true } : { ok: false, errorCode: txResult.errorCode }
}

// ── acceptRecurrenceSuggestion ─────────────────────────────────────────────────
// Acepta una sugerencia y crea la regla activa con los valores propuestos.
// start_date = última fecha vista por la detección, last_generated_date = misma
// fecha, para que la generación produzca la próxima instancia en la siguiente
// fecha esperada (en el futuro).

export async function acceptRecurrenceSuggestion(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<RecurrenceActionResult<AcceptRecurrenceSuggestionInput> & { id?: string }> {
  const validation = await validateActionInput(
    acceptRecurrenceSuggestionSchema,
    input,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data

  if (data.movement_type === 'transfer' && !data.transfer_destination_account_id) {
    return { ok: false, formError: 'La transferencia requiere cuenta destino.' }
  }
  if (data.movement_type !== 'transfer' && !data.category_id) {
    return {
      ok: false,
      formError: 'Los ingresos y gastos requieren categoría.',
    }
  }

  const { data: recurrence, error: insertError } = await supabase
    .from('recurrences')
    .insert({
      user_id: userId,
      movement_type: data.movement_type,
      account_id: data.account_id,
      transfer_destination_account_id:
        data.movement_type === 'transfer'
          ? data.transfer_destination_account_id ?? null
          : null,
      currency_code: data.currency_code,
      amount: data.amount,
      category_id:
        data.movement_type === 'transfer' ? null : data.category_id ?? null,
      subcategory_id: null,
      description: data.description ?? null,
      frequency: data.frequency,
      start_date: data.start_date,
      end_date: null,
      last_generated_date: data.start_date,
      status: 'active',
      created_from_transaction_id: null,
    } as never)
    .select('id')
    .single()

  if (insertError || !recurrence) {
    return {
      ok: false,
      formError: insertError?.message ?? 'No se pudo crear la regla recurrente.',
    }
  }

  return { ok: true, id: (recurrence as { id: string }).id }
}

// ── dismissRecurrenceSuggestion ────────────────────────────────────────────────
// Persiste el fingerprint del patrón para que la detección on-the-fly no vuelva
// a sugerirlo. Idempotente vía UNIQUE (user_id, fingerprint).

export async function dismissRecurrenceSuggestion(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<RecurrenceActionResult<DismissRecurrenceSuggestionInput>> {
  const validation = await validateActionInput(
    dismissRecurrenceSuggestionSchema,
    input,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { error } = await supabase
    .from('recurrence_suggestion_dismissals')
    .upsert(
      {
        user_id: userId,
        fingerprint: validation.data.fingerprint,
      },
      { onConflict: 'user_id,fingerprint' },
    )

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}
