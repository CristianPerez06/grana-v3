import { describe, expect, it, vi } from 'vitest'
import {
  READ_TIMEOUT_ERROR,
  READ_TIMEOUT_MS,
  getPendingRecurrenceInstances,
  reviewFeedState,
  withReadTimeout,
} from '../src'
import type { GranaSupabaseClient } from '@grana/supabase'

/**
 * A read that never comes back is not an empty list — and until this deadline
 * existed, that is exactly what it looked like: `fetch` hangs when there is no
 * route to the host, the feed stays in `loading`, and `loading` renders nothing.
 * A screen with nothing on it is what somebody with no vencimientos sees.
 */
describe('withReadTimeout', () => {
  it('hands back what the read read', async () => {
    await expect(withReadTimeout(Promise.resolve(['a', 'b']))).resolves.toEqual(['a', 'b'])
  })

  it('lets a real failure through unchanged', async () => {
    // The deadline must not turn every failure into a timeout: a 403 is a
    // different problem and the message is what a developer has to see.
    const boom = new Error('permission denied for table recurrence_instances')
    await expect(withReadTimeout(Promise.reject(boom))).rejects.toThrow(boom)
  })

  it('fails when the read never comes back', async () => {
    vi.useFakeTimers()
    try {
      const never = new Promise<string[]>(() => {})
      const raced = withReadTimeout(never)
      const settled = vi.fn()
      void raced.catch(settled)

      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1)
      expect(settled).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toHaveBeenCalledWith(new Error(READ_TIMEOUT_ERROR))
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets a merely slow read win', async () => {
    vi.useFakeTimers()
    try {
      const slow = new Promise<string[]>((resolve) => {
        setTimeout(() => resolve(['late']), READ_TIMEOUT_MS - 1_000)
      })
      const raced = withReadTimeout(slow)
      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS)
      await expect(raced).resolves.toEqual(['late'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits fifteen seconds by default', () => {
    expect(READ_TIMEOUT_MS).toBe(15_000)
  })
})

/** A client whose request never settles: a phone with the network off. */
function hangingClient(): GranaSupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    range: () => new Promise(() => {}),
  }
  return { from: () => builder } as unknown as GranaSupabaseClient
}

describe('getPendingRecurrenceInstances — the deadline is wired to the read', () => {
  it('gives up on a client that hangs', async () => {
    // The helper being right is not the same as the read using it: this is the
    // one that fails if someone unwraps the call.
    vi.useFakeTimers()
    try {
      const failed = vi.fn()
      void getPendingRecurrenceInstances(hangingClient()).catch(failed)

      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1)
      expect(failed).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(failed).toHaveBeenCalledWith(new Error(READ_TIMEOUT_ERROR))
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('what a timed-out read shows', () => {
  const timedOut = new Error(READ_TIMEOUT_ERROR)

  it('with nothing cached, says nobody knows — not that there is nothing', () => {
    expect(reviewFeedState({ isPending: false, error: timedOut, data: undefined })).toEqual({
      kind: 'unreadable',
    })
  })

  it('with rows cached, keeps them and says they may be stale', () => {
    expect(reviewFeedState({ isPending: false, error: timedOut, data: [{ id: 'a' }] })).toEqual({
      kind: 'list',
      refreshFailed: true,
    })
  })

  it('an empty cached list plus a timeout is still unreadable', () => {
    // "No tenés nada por revisar" is a claim, and a read that timed out cannot
    // support it.
    expect(reviewFeedState({ isPending: false, error: timedOut, data: [] })).toEqual({
      kind: 'unreadable',
    })
  })
})
