'use server'

import { revalidatePath } from 'next/cache'
import {
  assignSettlementAccountCore,
  createHouseholdCore,
  createInviteCore,
  deleteSettlementCore,
  joinHouseholdCore,
  leaveHouseholdCore,
  registerSettlementCore,
  updateHouseholdConfigCore,
} from '@grana/shared'
import type {
  AssignSettlementInput,
  CreateHouseholdInput,
  JoinHouseholdInput,
  SettlementInput,
  UpdateHouseholdConfigInput,
} from '@grana/validation'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from './types'
import { getAuthenticatedUserId } from './_lib/auth'

// These server actions are the `'use server'` boundary only: they resolve the
// authenticated user, build the server Supabase client and revalidate the
// affected routes. All validation + atomic RPC logic lives in the isomorphic
// mutator-cores in `@grana/shared`, shared with the mobile Hogar handlers.

export async function createHousehold(
  input: unknown,
): Promise<ActionResult<CreateHouseholdInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await createHouseholdCore(supabase, userId, input)
  if (res.ok) revalidatePath('/shared')
  return res
}

export async function createInvite(): Promise<ActionResult<never> & { code?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await createInviteCore(supabase, userId)
  if (res.ok) revalidatePath('/shared/settings')
  return res
}

export async function joinHousehold(input: unknown): Promise<ActionResult<JoinHouseholdInput>> {
  await getAuthenticatedUserId() // require an authenticated session
  const supabase = await createClient()
  const res = await joinHouseholdCore(supabase, input)
  if (res.ok) revalidatePath('/shared')
  return res
}

export async function updateHouseholdConfig(
  input: unknown,
): Promise<ActionResult<UpdateHouseholdConfigInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await updateHouseholdConfigCore(supabase, userId, input)
  if (res.ok) revalidatePath('/shared/settings')
  return res
}

export async function leaveHousehold(): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await leaveHouseholdCore(supabase, userId)
  if (res.ok) revalidatePath('/shared')
  return res
}

export async function registerSettlement(
  input: unknown,
): Promise<ActionResult<SettlementInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await registerSettlementCore(supabase, userId, input)
  if (res.ok) revalidatePath('/shared')
  return res
}

export async function assignSettlementAccount(
  input: unknown,
): Promise<ActionResult<AssignSettlementInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await assignSettlementAccountCore(supabase, userId, input)
  if (res.ok) revalidatePath('/shared')
  return res
}

export async function deleteSettlement(settlementId: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const res = await deleteSettlementCore(supabase, userId, settlementId)
  if (res.ok) revalidatePath('/shared')
  return res
}
