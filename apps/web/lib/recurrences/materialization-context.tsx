'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { withGenerationTimeout } from '@grana/recurrences'
import { generateDueRecurrenceInstancesAction } from '@/app/_actions/recurrences'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'

/**
 * Materialization of due recurrence occurrences, for the WHOLE app.
 *
 * It used to hang off two routes — the /transactions shell and the recurrences
 * hub — so a user who opened the app on the dashboard and stayed there never
 * materialized anything, ever. That is the "tengo recurrencias que no veo"
 * symptom, and it is why this lives at the app layout now: any screen counts.
 *
 * The outcome is kept instead of discarded. The old triggers swallowed every
 * failure in an empty `catch`, which left the screen identical to a user with
 * nothing to review — the opposite claim to the true one. Here a failure is a
 * state with a retry, and a run that still owes occurrences says so and offers
 * to continue, because a large backlog takes several runs and nobody is going to
 * reopen the app eight times to see their own history.
 */

export type MaterializationState = {
  /** True while a run is in flight — the first one or a continuation. */
  running: boolean
  /** Occurrences still owed after the last run. */
  remaining: number
  /** Set when the last run could not materialize what it owed. */
  error: string | null
  /** Run again: the retry after a failure, and "continuar reconstrucción". */
  run: () => void
}

const MaterializationContext = createContext<MaterializationState | null>(null)

export function RecurrenceMaterializationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Guards the run that fires on mount. A continuation is explicit and may
  // always run, which is why this only covers the automatic one.
  const autoFired = useRef(false)
  const inFlight = useRef(false)

  const run = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setRunning(true)

    // Wrapped so a dead network cannot leave this spinning forever with its
    // retry disabled — see `withGenerationTimeout`.
    withGenerationTimeout(generateDueRecurrenceInstancesAction())
      .then((result) => {
        setRemaining(result.remaining)
        setError(result.error)
        if (result.created > 0) {
          // The block is a TanStack container on some routes and server-rendered
          // on others, so both paths are refreshed.
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.recurrencesPendingInstances })
          queryClient.invalidateQueries({ queryKey: ['transactions', 'page'] })
          router.refresh()
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'unknown')
      })
      .finally(() => {
        inFlight.current = false
        setRunning(false)
      })
  }, [queryClient, router])

  useEffect(() => {
    if (autoFired.current) return
    autoFired.current = true
    run()
  }, [run])

  return (
    <MaterializationContext.Provider value={{ running, remaining, error, run }}>
      {children}
    </MaterializationContext.Provider>
  )
}

/**
 * Null outside the provider — every surface that shows the notice has to render
 * nothing rather than throw, because the provider lives at the app layout and a
 * component may legitimately be mounted elsewhere (a test, a story).
 */
export function useRecurrenceMaterialization(): MaterializationState | null {
  return useContext(MaterializationContext)
}
