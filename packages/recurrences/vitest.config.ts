import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // `reconstruct-from-guard` boots a real Postgres compiled to WASM in its
    // `beforeAll`, and that is seconds of startup, not milliseconds — close
    // enough to the 10s hook default that CPU contention would make it fail
    // intermittently on a test that has nothing wrong with it.
    //
    // Only the HOOK. `testTimeout` stays at its 5s default on purpose: the DB is
    // built in the hook, so a test BODY that runs long is a hang, and a minute of
    // rope would only hide it.
    hookTimeout: 60_000,
  },
})
