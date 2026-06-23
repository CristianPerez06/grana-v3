import type { DbClient } from '@/lib/supabase/db-client'

// Argentina calendar formatter (en-CA yields YYYY-MM-DD). The signup timestamp
// is stored UTC; the floor is the user's AR calendar day, so we format in the
// financial timezone — consistent with getTodayAR/formatDateISO.
const arDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The user's signup date (`profiles.created_at`) as an AR `YYYY-MM-DD` string,
 * or null when unavailable. Used as the lower bound for the movement date
 * picker: you cannot register a movement dated before you started using the app
 * (it would otherwise live in a month the lists never show and predate every
 * account's initial balance). Null falls back to no floor.
 */
export async function getAppStartDate(supabase: DbClient): Promise<string | null> {
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.created_at) return null
  return arDateFormatter.format(new Date(data.created_at))
}
