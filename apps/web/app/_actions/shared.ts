'use server'

import { randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@grana/supabase'
import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getHousehold, getHouseholdDebt } from '@/lib/shared/queries'
import {
  createHouseholdSchema,
  joinHouseholdSchema,
  updateHouseholdConfigSchema,
  settlementSchema,
  assignSettlementSchema,
  validateActionInput,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
  type UpdateHouseholdConfigInput,
  type SettlementInput,
  type AssignSettlementInput,
} from '@grana/validation'
import type { ActionResult } from './types'
import { getAuthenticatedUserId } from './_lib/auth'

// The household a user belongs to (Phase 1: at most one). Null when none.
async function getMyHouseholdId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('household_member')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.household_id ?? null
}

async function countMembers(supabase: SupabaseClient, householdId: string): Promise<number> {
  const { count } = await supabase
    .from('household_member')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
  return count ?? 0
}

// Unambiguous alphabet (no I, O, 0, 1, L) for human-readable invite codes.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  return `GRANA-${suffix}`
}

// ── createHousehold ───────────────────────────────────────────────────────────

export async function createHousehold(
  input: unknown,
): Promise<ActionResult<CreateHouseholdInput> & { id?: string }> {
  const validation = await validateActionInput(createHouseholdSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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

  revalidatePath('/shared')
  return { ok: true, id: household.id }
}

// ── createInvite ────────────────────────────────────────────────────────────────

export async function createInvite(): Promise<ActionResult<never> & { code?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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
    if (!error) {
      revalidatePath('/shared/settings')
      return { ok: true, code }
    }
    if (attempt === 1) return { ok: false, formError: error.message }
  }
  return { ok: false, formError: 'No se pudo generar el código.' }
}

// ── joinHousehold ─────────────────────────────────────────────────────────────

export async function joinHousehold(
  input: unknown,
): Promise<ActionResult<JoinHouseholdInput>> {
  const validation = await validateActionInput(joinHouseholdSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  await getAuthenticatedUserId() // require an authenticated session
  const supabase = await createClient()

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

  revalidatePath('/shared')
  return { ok: true }
}

// ── updateHouseholdConfig ─────────────────────────────────────────────────────

export async function updateHouseholdConfig(
  input: unknown,
): Promise<ActionResult<UpdateHouseholdConfigInput>> {
  const validation = await validateActionInput(updateHouseholdConfigSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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

  revalidatePath('/shared/settings')
  return { ok: true }
}

// ── leaveHousehold ────────────────────────────────────────────────────────────

export async function leaveHousehold(): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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

  const { error } = await supabase
    .from('household_member')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
  if (error) return { ok: false, formError: error.message }

  if ((await countMembers(supabase, householdId)) === 0) {
    await supabase.from('household').update({ is_active: false }).eq('id', householdId)
  }

  revalidatePath('/shared')
  return { ok: true }
}

// ── registerSettlement ────────────────────────────────────────────────────────

export async function registerSettlement(
  input: unknown,
): Promise<ActionResult<SettlementInput> & { id?: string }> {
  const validation = await validateActionInput(settlementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const household = await getHousehold(supabase)
  if (!household || household.members.length < 2) {
    return { ok: false, formError: 'No tenés un hogar activo.' }
  }

  // The amount cannot exceed what THIS user currently owes in that currency.
  // The debt derivation lives in TS (money-logic), so this ceiling stays here;
  // the RPC only guarantees atomicity and server-side authorship. See 0043.
  const currency = validation.data.currency_code
  const debt = await getHouseholdDebt(supabase)
  const entry = debt?.[currency]
  const youOwe = entry?.kind === 'owes' && entry.from === userId ? entry.amount : 0
  if (validation.data.amount > youOwe + 0.0001) {
    return { ok: false, fieldErrors: { amount: 'El monto no puede superar la deuda.' } }
  }

  const today = formatDateISO(getTodayAR())

  // Atomic: payer leg (settlement movement that debits the account) + settlement row.
  const { data: settlementId, error } = await supabase.rpc('register_settlement', {
    p_account_id: validation.data.account_id,
    p_amount: validation.data.amount,
    p_currency: currency,
    p_date: today,
  })
  if (error || !settlementId) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar la liquidación.' }
  }

  revalidatePath('/shared')
  return { ok: true, id: settlementId }
}

// ── assignSettlementAccount (receiver) ─────────────────────────────────────────

export async function assignSettlementAccount(
  input: unknown,
): Promise<ActionResult<AssignSettlementInput>> {
  const validation = await validateActionInput(assignSettlementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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

  revalidatePath('/shared')
  return { ok: true }
}

// ── deleteSettlement ──────────────────────────────────────────────────────────

export async function deleteSettlement(settlementId: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

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

  revalidatePath('/shared')
  return { ok: true }
}
