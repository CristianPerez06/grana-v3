import { QueryClient } from '@tanstack/react-query'

const AUTH_OR_NOT_FOUND_PATTERN = /(401|403|404|JWT|Unauthorized|Forbidden|Not Found)/i

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  const message = error instanceof Error ? error.message : String(error)
  if (AUTH_OR_NOT_FOUND_PATTERN.test(message)) return false
  return true
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
    },
  })
}
