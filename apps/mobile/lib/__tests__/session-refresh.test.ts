import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The session is renewed only while the app is in front. The real `AppState`
 * and Supabase client cannot run under Node, so both are doubles that record
 * what was called; the device check lives in the change's tasks.
 */

type Register = typeof import('../session-refresh').registerSessionRefresh

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

function fakeAuth() {
  return {
    startAutoRefresh: vi.fn(() => Promise.resolve()),
    stopAutoRefresh: vi.fn(() => Promise.resolve()),
  }
}

describe('registerSessionRefresh', () => {
  let register: Register

  beforeEach(async () => {
    // The once-only guard is module state: a fresh module per test.
    vi.resetModules()
    register = (await import('../session-refresh')).registerSessionRefresh
  })

  it('resumes the refresh when the app comes back to the front', () => {
    const appState = fakeAppState()
    const auth = fakeAuth()
    register(appState, auth)

    appState.emit('active')

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1)
    expect(auth.stopAutoRefresh).not.toHaveBeenCalled()
  })

  it.each(['background', 'inactive'])('pauses the refresh on %s', (state) => {
    const appState = fakeAppState()
    const auth = fakeAuth()
    register(appState, auth)

    appState.emit(state)

    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
    expect(auth.startAutoRefresh).not.toHaveBeenCalled()
  })

  it('registers a single listener even when called twice', () => {
    const appState = fakeAppState()
    const auth = fakeAuth()
    register(appState, auth)
    register(appState, auth)

    appState.emit('active')

    expect(appState.listeners).toHaveLength(1)
    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1)
  })
})
