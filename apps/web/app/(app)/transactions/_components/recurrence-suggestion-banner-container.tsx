'use client'

import { useQuery } from '@tanstack/react-query'
import { RecurrenceSuggestionBanner } from '@/lib/recurrences/components/recurrence-suggestion-banner'
import { getTopRecurrenceSuggestionAction } from '@/app/_actions/queries'
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
    queryFn: () => getTopRecurrenceSuggestionAction(),
  })

  if (!suggestion) return null
  return <RecurrenceSuggestionBanner suggestion={suggestion} />
}
