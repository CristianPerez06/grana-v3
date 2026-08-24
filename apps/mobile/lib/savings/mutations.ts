import {
  reserveAvailability as reserveAvailabilityImpl,
  releaseAvailability as releaseAvailabilityImpl,
  type SavingsMutationResult,
} from '@grana/savings'
import { getTodayAR } from '@grana/money-logic'
import { supabase } from '../supabase'

/**
 * Native shell over the shared mutations. Mobile has no server actions, so the
 * user id comes from the session and the call goes straight to the package —
 * the cap and the floor still live inside it, validated against a fresh server
 * read at write time.
 */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Unauthorized')
  return id
}

export async function reserveAvailability(input: unknown): Promise<SavingsMutationResult> {
  return reserveAvailabilityImpl({
    supabase,
    userId: await currentUserId(),
    input,
    today: getTodayAR(),
  })
}

export async function releaseAvailability(input: unknown): Promise<SavingsMutationResult> {
  return releaseAvailabilityImpl({
    supabase,
    userId: await currentUserId(),
    input,
    today: getTodayAR(),
  })
}
