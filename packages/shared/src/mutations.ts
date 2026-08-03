import type { GranaSupabaseClient, Json } from '@grana/supabase'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import {
  assignSettlementSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  settlementSchema,
  updateHouseholdConfigSchema,
  validateActionInput,
  type AssignSettlementInput,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
  type SettlementInput,
  type UpdateHouseholdConfigInput,
} from '@grana/validation'
import { getHousehold, getHouseholdDebt } from './queries'

/**
 * Isomorphic result of a Compartido mutation core. Structurally identical to
 * web's `ActionResult<T>` so a web server action can return it directly; the
 * mobile handlers map it to their own error surface. Auth (resolving `userId`)
 * and cache glue (`revalidatePath` on web, react-query invalidation on mobile)
 * live in each platform's shell, never here.
 */
export type SharedMutationResult<T = never> =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
    }

// The household a user belongs to (Phase 1: at most one). Null when none.
async function getMyHouseholdId(
  supabase: GranaSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('household_member')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.household_id ?? null
}

async function countMembers(
  supabase: GranaSupabaseClient,
  householdId: string,
): Promise<number> {
  const { count } = await supabase
    .from('household_member')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
  return count ?? 0
}

// Unambiguous alphabet (no I, O, 0, 1, L) for human-readable invite codes.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  // Portable CSPRNG: `crypto.getRandomValues` is native on web/Node and
  // polyfilled in the Expo app (supabase-js already requires it), unlike Node's
  // `crypto.randomInt`. The modulo bias over a 30-char alphabet is immaterial
  // for a short-lived 4-char code guarded by a unique constraint + retry.
  const bytes = new Uint8Array(4)
  globalThis.crypto.getRandomValues(bytes)
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length]
  return `GRANA-${suffix}`
}

// ── createHousehold ───────────────────────────────────────────────────────────

export async function createHouseholdCore(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<SharedMutationResult<CreateHouseholdInput> & { id?: string }> {
  const validation = await validateActionInput(createHouseholdSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  if (await getMyHouseholdId(supabase, userId)) {
    return { ok: false, formError: 'Ya pertenecés a un hogar.' }
  }

  const { data: household, error } = await supabase
    .from('household')
    .insert({ name: validation.data.name, created_by: userId, default_split: [] })
    .select('id')
    .single()

  if (error || !household) {
    return { ok: false, formError: error?.message ?? 'No se pudo crear el hogar.' }
  }

  const { error: memberError } = await supabase
    .from('household_member')
    .insert({ household_id: household.id, user_id: userId })

  if (memberError) {
    await supabase.from('household').delete().eq('id', household.id) // rollback
    return { ok: false, formError: memberError.message }
  }

  return { ok: true, id: household.id }
}

// ── createInvite ────────────────────────────────────────────────────────────────

export async function createInviteCore(
  supabase: GranaSupabaseClient,
  userId: string,
): Promise<SharedMutationResult<never> & { code?: string }> {
  const householdId = await getMyHouseholdId(supabase, userId)
  if (!householdId) return { ok: false, formError: 'No tenés un hogar.' }
  if ((await countMembers(supabase, householdId)) >= 2) {
    return { ok: false, formError: 'El hogar ya está completo.' }
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // Retry once on the (very unlikely) unique-code collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateInviteCode()
    const { error } = await supabase
      .from('household_invite')
      .insert({ household_id: householdId, code, invited_by: userId, expires_at: expiresAt })
    if (!error) return { ok: true, code }
    if (attempt === 1) return { ok: false, formError: error.message }
  }
  return { ok: false, formError: 'No se pudo generar el código.' }
}

// ── joinHousehold ─────────────────────────────────────────────────────────────

export async function joinHouseholdCore(
  supabase: GranaSupabaseClient,
  input: unknown,
): Promise<SharedMutationResult<JoinHouseholdInput>> {
  const validation = await validateActionInput(joinHouseholdSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  // Joining is a single privileged, atomic operation: it resolves the code,
  // validates capacity/expiry/use, inserts the membership, claims the invite and
  // sets the 50·50 split. Invites are no longer client-readable (members only),
  // so the resolution must happen inside the RPC. See migration 0043.
  const { error } = await supabase.rpc('join_household_by_code', {
    p_code: validation.data.code,
  })
  if (error) {
    const msg = error.message
    if (msg.includes('already_in_household')) {
      return { ok: false, formError: 'Ya pertenecés a un hogar.' }
    }
    if (msg.includes('invite_not_found')) return { ok: false, fieldErrors: { code: 'Código inválido.' } }
    if (msg.includes('invite_used')) return { ok: false, fieldErrors: { code: 'El código ya fue usado.' } }
    if (msg.includes('invite_expired')) return { ok: false, fieldErrors: { code: 'El código venció.' } }
    if (msg.includes('household_full')) return { ok: false, fieldErrors: { code: 'El hogar ya está completo.' } }
    if (msg.includes('household_inactive')) return { ok: false, fieldErrors: { code: 'El hogar no está activo.' } }
    return { ok: false, formError: error.message }
  }

  return { ok: true }
}

// ── updateHouseholdConfig ─────────────────────────────────────────────────────

export async function updateHouseholdConfigCore(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<SharedMutationResult<UpdateHouseholdConfigInput>> {
  const validation = await validateActionInput(updateHouseholdConfigSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const householdId = await getMyHouseholdId(supabase, userId)
  if (!householdId) return { ok: false, formError: 'No tenés un hogar.' }

  const updates: { name?: string; default_split?: Json } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name
  if (validation.data.default_split !== undefined) {
    updates.default_split = validation.data.default_split as unknown as Json
  }
  if (Object.keys(updates).length === 0) return { ok: true }

  const { error } = await supabase.from('household').update(updates).eq('id', householdId)
  if (error) return { ok: false, formError: error.message }

  return { ok: true }
}

// ── leaveHousehold ────────────────────────────────────────────────────────────

export async function leaveHouseholdCore(
  supabase: GranaSupabaseClient,
  userId: string,
): Promise<SharedMutationResult<never>> {
  const householdId = await getMyHouseholdId(supabase, userId)
  if (!householdId) return { ok: false, formError: 'No tenés un hogar.' }

  const debt = await getHouseholdDebt(supabase)
  if (debt && (debt.ARS.kind === 'owes' || debt.USD.kind === 'owes')) {
    return { ok: false, formError: 'Saldá la deuda antes de salir del hogar.' }
  }

  const { count: pending } = await supabase
    .from('settlement')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .eq('status', 'pending_receipt')
  if ((pending ?? 0) > 0) {
    return { ok: false, formError: 'Hay liquidaciones pendientes. Resolvelas antes de salir.' }
  }

  // A live shared recurrence keeps generating shared movements for this
  // household; leaving would orphan it. Same honest-blocking criterion as debt
  // and pending settlements: ask the user to pause or delete it first.
  const { count: sharedRules } = await supabase
    .from('recurrences')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .eq('status', 'active')
  if ((sharedRules ?? 0) > 0) {
    return {
      ok: false,
      formError: 'Tenés una recurrencia compartida activa. Pausala o eliminala antes de salir.',
    }
  }

  const { error } = await supabase
    .from('household_member')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
  if (error) return { ok: false, formError: error.message }

  if ((await countMembers(supabase, householdId)) === 0) {
    await supabase.from('household').update({ is_active: false }).eq('id', householdId)
  }

  return { ok: true }
}

// ── registerSettlement ────────────────────────────────────────────────────────

export async function registerSettlementCore(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<SharedMutationResult<SettlementInput> & { id?: string }> {
  const validation = await validateActionInput(settlementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) {
    return { ok: false, formError: 'No tenés un hogar activo.' }
  }

  // Overpayment is allowed: paying more than the current debt settles it and
  // flips the balance so the partner owes the excess back. The debt derivation
  // (money-logic) handles the sign flip, and the receiver still confirms which
  // account received it, so no ceiling is enforced here — only shape/positivity
  // (schema) and household/account ownership (the RPC). See 0043.
  const currency = validation.data.currency_code

  // Atomic: payer leg (settlement movement that debits the account) + settlement row.
  const { data: settlementId, error } = await supabase.rpc('register_settlement', {
    p_account_id: validation.data.account_id,
    p_amount: validation.data.amount,
    p_currency: currency,
    p_date: validation.data.date,
  })
  if (error || !settlementId) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar la liquidación.' }
  }

  return { ok: true, id: settlementId }
}

// ── assignSettlementAccount (receiver) ─────────────────────────────────────────

export async function assignSettlementAccountCore(
  supabase: GranaSupabaseClient,
  userId: string,
  input: unknown,
): Promise<SharedMutationResult<AssignSettlementInput>> {
  const validation = await validateActionInput(assignSettlementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  // Friendly pre-check; the RPC is the real authorization guard.
  const { data: s } = await supabase
    .from('settlement')
    .select('receiver_id, status')
    .eq('id', validation.data.settlement_id)
    .maybeSingle()
  if (!s) return { ok: false, formError: 'Liquidación no encontrada.' }
  if (s.receiver_id !== userId) return { ok: false, formError: 'No autorizado.' }
  if (s.status !== 'pending_receipt') {
    return { ok: false, formError: 'La liquidación ya fue completada.' }
  }

  const today = formatDateISO(getTodayAR())

  // Atomic: receiver leg (settlement movement that credits the account) + completed.
  const { error } = await supabase.rpc('confirm_settlement', {
    p_settlement_id: validation.data.settlement_id,
    p_account_id: validation.data.account_id,
    p_date: today,
  })
  if (error) return { ok: false, formError: error.message }

  return { ok: true }
}

// ── deleteSettlement ──────────────────────────────────────────────────────────

export async function deleteSettlementCore(
  supabase: GranaSupabaseClient,
  userId: string,
  settlementId: string,
): Promise<SharedMutationResult<never>> {
  const { data: s } = await supabase
    .from('settlement')
    .select('id, payer_id, payer_movement_id, status')
    .eq('id', settlementId)
    .maybeSingle()
  if (!s) return { ok: false, formError: 'Liquidación no encontrada.' }

  if (s.status === 'pending_receipt') {
    // Only the payer's own leg exists; deleting it cascades the settlement row.
    if (s.payer_id !== userId) return { ok: false, formError: 'No autorizado.' }
    const { error } = await supabase.from('transactions').delete().eq('id', s.payer_movement_id)
    if (error) return { ok: false, formError: error.message }
  } else {
    // Completed: the receiver leg belongs to the other user → privileged reversal
    // (owner-only write RLS forbids the client touching it). See D10.
    const { error } = await supabase.rpc('reverse_settlement', { p_settlement_id: settlementId })
    if (error) return { ok: false, formError: error.message }
  }

  return { ok: true }
}
