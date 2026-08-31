import { supabase } from '../supabase'

/**
 * Native client for `user_guidance_events`.
 *
 * Web reaches this table through server actions; mobile has none, so it goes
 * straight to Supabase — RLS scopes every row to the caller, so the surface is
 * the same one the actions have.
 *
 * The catalog of ids lives on the web side (`apps/web/lib/guidance/catalog.ts`).
 * Only the ids mobile actually renders are mirrored here, so a typo cannot
 * silently create a row nobody reads.
 */
export const MOBILE_GUIDANCE_IDS = {
  SAVINGS_SUGGEST_AFTER_INCOME: 'savings.suggest_after_income',
} as const

export type MobileGuidanceId =
  (typeof MOBILE_GUIDANCE_IDS)[keyof typeof MOBILE_GUIDANCE_IDS]

export type GuidanceStatus = {
  seen_at: string | null
  dismissed_at: string | null
  completed_at: string | null
}

export async function getGuidanceStatus(id: MobileGuidanceId): Promise<GuidanceStatus | null> {
  const { data } = await supabase
    .from('user_guidance_events')
    .select('seen_at, dismissed_at, completed_at')
    .eq('guidance_id', id)
    .maybeSingle()

  return data ?? null
}

/**
 * `seen` is refreshed on every mark on purpose: for a recurring suggestion it is
 * a MONTHLY CURSOR, not a one-time flag. `completed` is deliberately not offered
 * — it would kill the suggestion for good, and this one has to come back next
 * month.
 */
export async function markGuidance(
  id: MobileGuidanceId,
  status: 'seen' | 'dismissed',
): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) return

  const now = new Date().toISOString()
  await supabase.from('user_guidance_events').upsert(
    {
      user_id: userId,
      guidance_id: id,
      updated_at: now,
      ...(status === 'seen' ? { seen_at: now } : { dismissed_at: now }),
    },
    { onConflict: 'user_id, guidance_id' },
  )
}
