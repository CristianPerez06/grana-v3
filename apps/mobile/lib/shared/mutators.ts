import type { QueryClient } from '@tanstack/react-query'
import {
  assignSettlementAccountCore,
  createHouseholdCore,
  createInviteCore,
  deleteSettlementCore,
  joinHouseholdCore,
  leaveHouseholdCore,
  registerSettlementCore,
  updateHouseholdConfigCore,
  type SharedMutationResult,
} from '@grana/shared'
import { supabase } from '../supabase'
import { invalidateAfterSharedMutation, invalidateAfterSettlement } from './invalidation'

// Native analogue of the web `'use server'` actions in `app/_actions/shared.ts`.
// No 'use server': screens call these directly. Each resolves the userId, calls
// the SAME isomorphic mutator-core the web action calls, and on success
// invalidates the affected query keys. The core's typed result (`ok`,
// `formError`, `fieldErrors`, plus `id`/`code`) is returned as-is — the
// `formError`/`fieldErrors` strings are already Spanish, exactly as web surfaces
// them, so there is no translation layer.

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

export type { SharedMutationResult }

export async function createHousehold(
  queryClient: QueryClient,
  input: unknown,
): Promise<SharedMutationResult & { id?: string }> {
  const userId = await requireUserId()
  const res = await createHouseholdCore(supabase, userId, input)
  if (res.ok) invalidateAfterSharedMutation(queryClient)
  return res
}

export async function joinHousehold(
  queryClient: QueryClient,
  input: unknown,
): Promise<SharedMutationResult> {
  await requireUserId() // require an authenticated session
  const res = await joinHouseholdCore(supabase, input)
  if (res.ok) invalidateAfterSharedMutation(queryClient)
  return res
}

export async function createInvite(
  queryClient: QueryClient,
): Promise<SharedMutationResult & { code?: string }> {
  const userId = await requireUserId()
  const res = await createInviteCore(supabase, userId)
  if (res.ok) invalidateAfterSharedMutation(queryClient)
  return res
}

export async function updateHouseholdConfig(
  queryClient: QueryClient,
  input: unknown,
): Promise<SharedMutationResult> {
  const userId = await requireUserId()
  const res = await updateHouseholdConfigCore(supabase, userId, input)
  if (res.ok) invalidateAfterSharedMutation(queryClient)
  return res
}

export async function leaveHousehold(queryClient: QueryClient): Promise<SharedMutationResult> {
  const userId = await requireUserId()
  const res = await leaveHouseholdCore(supabase, userId)
  if (res.ok) invalidateAfterSharedMutation(queryClient)
  return res
}

export async function registerSettlement(
  queryClient: QueryClient,
  input: unknown,
): Promise<SharedMutationResult & { id?: string }> {
  const userId = await requireUserId()
  const res = await registerSettlementCore(supabase, userId, input)
  if (res.ok) invalidateAfterSettlement(queryClient)
  return res
}

export async function assignSettlementAccount(
  queryClient: QueryClient,
  input: unknown,
): Promise<SharedMutationResult> {
  const userId = await requireUserId()
  const res = await assignSettlementAccountCore(supabase, userId, input)
  if (res.ok) invalidateAfterSettlement(queryClient)
  return res
}

export async function deleteSettlement(
  queryClient: QueryClient,
  settlementId: string,
): Promise<SharedMutationResult> {
  const userId = await requireUserId()
  const res = await deleteSettlementCore(supabase, userId, settlementId)
  if (res.ok) invalidateAfterSettlement(queryClient)
  return res
}
