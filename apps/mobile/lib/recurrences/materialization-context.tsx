import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { withGenerationTimeout } from '@grana/recurrences'
import { generateDueInstances } from './mutators'

/**
 * Materialization of due recurrence occurrences, for the WHOLE native app.
 *
 * It used to hang off the recurrences hub alone, so the feed showed occurrences
 * but never produced them: a user who only opened the feed depended on having
 * visited the hub. That is the "tengo recurrencias que no veo" symptom, and it
 * is why this lives at the app layout now.
 *
 * The outcome is kept instead of discarded. The old trigger swallowed every
 * failure in an empty `catch`, which left the screen identical to a user with
 * nothing to review — the opposite claim to the true one. Mirrors web's
 * `RecurrenceMaterializationProvider`, deliberately: the two surfaces answer the
 * same question and must not drift.
 */

export type MaterializationState = {
  running: boolean
  remaining: number
  error: string | null
  run: () => void
}

const MaterializationContext = createContext<MaterializationState | null>(null)

export function RecurrenceMaterializationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const run = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setRunning(true)

    // Wrapped so a dead network cannot leave this spinning forever with its
    // retry disabled — see `withGenerationTimeout`.
    withGenerationTimeout(generateDueInstances())
      .then((result) => {
        setRemaining(result.remaining)
        setError(result.error)
        if (result.created > 0) {
          void queryClient.invalidateQueries({ queryKey: ['recurrences'] })
          void queryClient.invalidateQueries({ queryKey: ['transactions'] })
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'unknown')
      })
      .finally(() => {
        inFlight.current = false
        setRunning(false)
      })
  }, [queryClient])

  // On focus rather than on mount: the native app is not remounted between
  // screens, and `run` is idempotent — what a rule owes is derived from its
  // calendar minus what already exists, so a second call creates nothing.
  useFocusEffect(
    useCallback(() => {
      run()
    }, [run]),
  )

  return (
    <MaterializationContext.Provider value={{ running, remaining, error, run }}>
      {children}
    </MaterializationContext.Provider>
  )
}

/** Null outside the provider, so a surface renders nothing instead of throwing. */
export function useRecurrenceMaterialization(): MaterializationState | null {
  return useContext(MaterializationContext)
}
