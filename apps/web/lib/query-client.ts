import { QueryClient } from '@tanstack/react-query'

const AUTH_OR_NOT_FOUND_PATTERN = /(401|403|404|JWT|Unauthorized|Forbidden|Not Found)/i

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  const message = error instanceof Error ? error.message : String(error)
  if (AUTH_OR_NOT_FOUND_PATTERN.test(message)) return false
  return true
}

const MINUTE = 60_000

// Per-family staleTime defaults. Configured via setQueryDefaults so that any
// caller (a useQuery on the matching key prefix) inherits the right cache
// policy without having to repeat it at the call site. Families not listed here
// inherit the global default (0 — refetch on mount; we rely on explicit
// invalidations after mutations to keep them fresh).
const STALE_TIME_BY_KEY_PREFIX: Array<{ prefix: readonly unknown[]; staleTime: number }> = [
  // Drawer / form data: rarely changes outside of mutations we already invalidate.
  { prefix: ['accounts', 'list'], staleTime: 5 * MINUTE },
  { prefix: ['categories', 'tree'], staleTime: 15 * MINUTE },
  { prefix: ['household', 'detail'], staleTime: 15 * MINUTE },
  // /transactions ancillary queries.
  { prefix: ['transactions', 'filter-options'], staleTime: 2 * MINUTE },
  // The welcome-vs-month-empty signal only flips on the first movement the user
  // ever creates; cache for the whole session and invalidate explicitly when a
  // movement is created.
  { prefix: ['transactions', 'has-any'], staleTime: Infinity },
  { prefix: ['recurrences', 'top-suggestion'], staleTime: 5 * MINUTE },
  // /accounts/[id] shell — institutions is a slow-changing catalog; the rest
  // (account detail, ascending history, pending reimbursements scoped) refetch
  // on mount and rely on explicit invalidations after mutations.
  { prefix: ['institutions'], staleTime: 15 * MINUTE },
]

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: shouldRetry,
        refetchOnReconnect: true,
        // Web has tab-switching; refetching on focus would be noisy for queries
        // whose freshness we already manage with explicit invalidations.
        refetchOnWindowFocus: false,
      },
    },
  })

  for (const { prefix, staleTime } of STALE_TIME_BY_KEY_PREFIX) {
    client.setQueryDefaults(prefix, { staleTime })
  }

  return client
}
