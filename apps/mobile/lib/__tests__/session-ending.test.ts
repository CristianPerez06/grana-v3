import { createClient } from '@grana/supabase'
import { describe, expect, it } from 'vitest'

/**
 * The library behaviour the phone's session handling rests on (spec `auth`).
 *
 * The root layout sends the person to sign-in, and forgets their data, on every
 * `SIGNED_OUT`. `lib/session-watch.ts` only asks the service; it never reads the
 * answer. That is safe only while the client emits `SIGNED_OUT` after the
 * service says the session is gone, and never because the phone could not ask.
 * If an upgrade of `@supabase/supabase-js` changes that, this fails before a
 * phone with no signal starts signing people out.
 *
 * A real client, with `fetch` and storage faked, and a session already stored.
 */

const STORAGE_KEY = 'test-auth-token'

function storedSession() {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'person@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

function setup(fetch: typeof globalThis.fetch) {
  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(storedSession())]])
  const client = createClient('https://example.supabase.co', 'anon-key', {
    auth: {
      storage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      storageKey: STORAGE_KEY,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch },
  })
  const events: string[] = []
  client.auth.onAuthStateChange((event) => {
    events.push(event)
  })
  return { client, store, events }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
  })
}

describe('how a session ends on the phone', () => {
  it('ends it, and emits SIGNED_OUT, when the service says it no longer exists', async () => {
    const { client, store, events } = setup(async () =>
      jsonResponse(403, {
        code: 'session_not_found',
        message: 'Session from session_id claim in JWT does not exist',
      }),
    )

    await client.auth.getUser()

    expect(events).toContain('SIGNED_OUT')
    expect(store.has(STORAGE_KEY)).toBe(false)
  })

  it('keeps it, and emits nothing, when there is no connection', async () => {
    const { client, store, events } = setup(async () => {
      throw new TypeError('Network request failed')
    })

    const { error } = await client.auth.getUser()

    expect(error).not.toBeNull()
    expect(events).not.toContain('SIGNED_OUT')
    expect(store.has(STORAGE_KEY)).toBe(true)
  })

  it('keeps it, and emits nothing, when the service is down', async () => {
    const { client, store, events } = setup(async () => new Response('Bad gateway', { status: 503 }))

    await client.auth.getUser()

    expect(events).not.toContain('SIGNED_OUT')
    expect(store.has(STORAGE_KEY)).toBe(true)
  })

  it('asks nothing, and emits nothing, when nobody is signed in', async () => {
    let calls = 0
    const { client, store, events } = setup(async () => {
      calls += 1
      return jsonResponse(200, {})
    })
    store.clear()

    await client.auth.getUser()

    expect(calls).toBe(0)
    expect(events).not.toContain('SIGNED_OUT')
  })
})
