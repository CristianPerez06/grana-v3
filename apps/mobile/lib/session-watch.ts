/**
 * How often an open phone asks whether its session still stands (spec `auth`).
 *
 * The time within which a password changed elsewhere reaches sign-in here. One
 * small request each time, and only while the app is in front.
 */
export const CHECK_EVERY_MS = 5 * 60 * 1000

/**
 * The slice of `AppState` this module needs. Typed structurally so the module
 * never imports `react-native`, which ships as Flow and does not parse under the
 * Node test harness.
 */
type AppStateLike = {
  addEventListener: (type: 'change', listener: (state: string) => void) => unknown
}

/** The slice of `supabase.auth` this module needs. */
type SessionAuth = {
  getUser: () => Promise<unknown>
}

let registered = false

/**
 * Notices a session ended from another device.
 *
 * Supabase does not tell a phone that its session was ended elsewhere: it finds
 * out when its access token expires, up to an hour later, or when it asks the
 * service. So it asks — once when the app opens, on every return to the front,
 * and every `CHECK_EVERY_MS` while it stays there.
 *
 * The answer is not read here. When the service says the session is gone, the
 * client removes it and emits `SIGNED_OUT`, and the root layout takes the person
 * to sign-in and forgets their data, the way it does for any sign-out. With no
 * connection the client keeps the session and emits nothing, so nobody is
 * signed out for want of signal (`__tests__/session-ending.test.ts` pins both).
 * With nobody signed in, `getUser()` makes no request at all.
 *
 * The timer exists only while the app is in front, and a return restarts it, so
 * a return never asks twice in a row. Registered once, beside the client.
 */
export function registerSessionWatch(appState: AppStateLike, auth: SessionAuth) {
  if (registered) return
  registered = true

  let timer: ReturnType<typeof setInterval> | null = null
  const check = () => void auth.getUser()
  const stop = () => {
    if (timer !== null) clearInterval(timer)
    timer = null
  }
  const start = () => {
    stop()
    check()
    timer = setInterval(check, CHECK_EVERY_MS)
  }

  // The app is in front when this runs; no `change` event says so.
  start()
  appState.addEventListener('change', (state) => {
    if (state === 'active') start()
    else stop()
  })
}
