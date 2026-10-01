import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * When the phone asks whether its session still stands. `AppState` and the
 * Supabase client cannot run under Node, so both are doubles; what the client
 * does with the answer is pinned in `session-ending.test.ts`.
 */

type Module = typeof import('../session-watch')

function fakeAppState() {
  const listeners: ((state: string) => void)[] = []
  return {
    listeners,
    addEventListener: (_type: 'change', listener: (state: string) => void) => {
      listeners.push(listener)
    },
    emit: (state: string) => listeners.forEach((listener) => listener(state)),
  }
}

describe('registerSessionWatch', () => {
  let mod: Module

  beforeEach(async () => {
    vi.useFakeTimers()
    // The once-only guard is module state: a fresh module per test.
    vi.resetModules()
    mod = await import('../session-watch')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const appState = fakeAppState()
    const auth = { getUser: vi.fn(() => Promise.resolve()) }
    mod.registerSessionWatch(appState, auth)
    return { appState, auth }
  }

  it('asks once when the app opens', () => {
    const { auth } = setup()

    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('asks again every 5 minutes while the app is in front', () => {
    const { auth } = setup()

    vi.advanceTimersByTime(mod.CHECK_EVERY_MS * 2)

    expect(auth.getUser).toHaveBeenCalledTimes(3)
  })

  it('stops asking while the app is in the background', () => {
    const { appState, auth } = setup()

    appState.emit('background')
    vi.advanceTimersByTime(mod.CHECK_EVERY_MS * 3)

    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('asks at once on return, and restarts the interval from there', () => {
    const { appState, auth } = setup()
    appState.emit('background')

    vi.advanceTimersByTime(mod.CHECK_EVERY_MS - 1000)
    appState.emit('active')
    expect(auth.getUser).toHaveBeenCalledTimes(2)

    // The old interval would have fired one second later; the new one waits.
    vi.advanceTimersByTime(mod.CHECK_EVERY_MS - 1)
    expect(auth.getUser).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(1)
    expect(auth.getUser).toHaveBeenCalledTimes(3)
  })

  it('stops on iOS inactive as well', () => {
    const { appState, auth } = setup()

    appState.emit('inactive')
    vi.advanceTimersByTime(mod.CHECK_EVERY_MS)

    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('registers a single watch even when called twice', () => {
    const appState = fakeAppState()
    const auth = { getUser: vi.fn(() => Promise.resolve()) }
    mod.registerSessionWatch(appState, auth)
    mod.registerSessionWatch(appState, auth)

    vi.advanceTimersByTime(mod.CHECK_EVERY_MS)

    expect(appState.listeners).toHaveLength(1)
    expect(auth.getUser).toHaveBeenCalledTimes(2)
  })
})
