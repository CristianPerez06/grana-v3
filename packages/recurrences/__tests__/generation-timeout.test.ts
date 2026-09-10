import { describe, expect, it, vi } from 'vitest'
import {
  GENERATION_TIMEOUT_MS,
  withGenerationTimeout,
  type GenerationResult,
} from '../src/queries'

/**
 * A dead network is worse than a failing one, and this is what closes that gap.
 *
 * Found in QA on an iPhone with the network off: `fetch` did not reject, it
 * hung — well over a minute — and the whole time the notice read "Actualizando…"
 * with its retry DISABLED. The one surface whose job is to say "we could not
 * update your vencimientos" said nothing and offered nothing.
 */

const ok: GenerationResult = { created: 3, remaining: 0, error: null }

describe('withGenerationTimeout', () => {
  it('gives a run that answers in time its own answer', async () => {
    await expect(withGenerationTimeout(Promise.resolve(ok), 50)).resolves.toEqual(ok)
  })

  it('passes a reported failure through untouched', async () => {
    const failed: GenerationResult = { created: 0, remaining: 4, error: 'boom' }
    await expect(withGenerationTimeout(Promise.resolve(failed), 50)).resolves.toEqual(failed)
  })

  it('answers with a failure when the run never comes back', async () => {
    vi.useFakeTimers()
    try {
      // The shape of a hung fetch: a promise that simply never settles.
      const hung = new Promise<GenerationResult>(() => {})
      const raced = withGenerationTimeout(hung, 15_000)

      await vi.advanceTimersByTimeAsync(15_000)

      // An ERROR, not a quiet empty run: the surface has to say so and offer a
      // retry, which it cannot do while a run is still in flight.
      await expect(raced).resolves.toEqual({
        created: 0,
        remaining: 0,
        error: 'generation_timeout',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not give up early on a run that is merely slow', async () => {
    vi.useFakeTimers()
    try {
      let settle: (value: GenerationResult) => void = () => {}
      const slow = new Promise<GenerationResult>((resolve) => {
        settle = resolve
      })
      const raced = withGenerationTimeout(slow, 15_000)

      await vi.advanceTimersByTimeAsync(14_000)
      settle(ok)

      await expect(raced).resolves.toEqual(ok)
    } finally {
      vi.useRealTimers()
    }
  })

  it('defaults to a wait a person would actually tolerate', () => {
    // Not a network setting: how long somebody stares at a spinner before the
    // app owes them an answer.
    expect(GENERATION_TIMEOUT_MS).toBe(15_000)
  })
})
