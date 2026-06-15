'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { generateDueRecurrenceInstancesAction } from '@/app/_actions/recurrences'

/**
 * Lazy materialization of due recurrence instances for /transactions/recurring.
 * Fired-and-forgotten on mount so it never blocks the read path
 * (web-data-access spec): the page's server-rendered `Promise.all` no longer
 * waits on the generation write. When something was materialized, the route is
 * refreshed so the new "A confirmar" instance appears without a manual reload
 * (the RSC equivalent of TanStack invalidation, since this route's pending
 * block is server-rendered, not a TanStack container).
 */
export const RecurrenceGenerationTrigger = () => {
  const router = useRouter()
  const generationFired = useRef(false)

  useEffect(() => {
    if (generationFired.current) return
    generationFired.current = true
    generateDueRecurrenceInstancesAction()
      .then(({ created }) => {
        if (created > 0) router.refresh()
      })
      .catch(() => {
        // Best-effort: a failed generation just means the instance shows up on
        // the next visit. The read path must never depend on it.
      })
  }, [router])

  return null
}
