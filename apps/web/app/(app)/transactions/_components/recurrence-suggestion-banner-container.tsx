'use client'

import { useQuery } from '@tanstack/react-query'
import { RecurrenceSuggestionBanner } from '@/lib/recurrences/components/recurrence-suggestion-banner'
import { createClient } from '@/lib/supabase/client'
import { getTopRecurrenceSuggestion } from '@/lib/recurrences/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'

/**
 * Client wrapper around `<RecurrenceSuggestionBanner>` that fetches the top
 * recurrence suggestion via TanStack Query. The banner is a hint; failing or
 * loading silently is intentional — the user sees nothing instead of a
 * skeleton or error placeholder for a non-essential prompt.
 *
 * The banner itself invalidates the relevant query keys on accept/dismiss via
 * `invalidateAfterSuggestionMutation`, so the banner updates without a full
 * page refresh.
 */
export function RecurrenceSuggestionBannerContainer() {
  const { data: suggestion } = useQuery({
    queryKey: QUERY_KEYS.recurrencesTopSuggestion,
    queryFn: () => getTopRecurrenceSuggestion(createClient()),
    // The 6-month pattern detection is stable within a session — cache it so
    // navigating away and back does not recompute it (web-data-access spec).
    staleTime: 30 * 60 * 1000,
  })

  if (!suggestion) return null
  return <RecurrenceSuggestionBanner suggestion={suggestion} />
}
