/**
 * The slice of `AppState` this module needs. Typed structurally so the module
 * never imports `react-native`, which ships as Flow and does not parse under the
 * Node test harness.
 */
type AppStateLike = {
  addEventListener: (type: 'change', listener: (state: string) => void) => unknown
}

/** The slice of `supabase.auth` this module needs. */
type AutoRefreshAuth = {
  startAutoRefresh: () => Promise<void>
  stopAutoRefresh: () => Promise<void>
}

let registered = false

/**
 * Keep the session fresh only while the app is in front (spec `auth`).
 *
 * The client pauses its refresh timer for a hidden tab in a browser and nowhere
 * else — on a phone it would run, freeze or fire late at the platform's whim.
 * Starting it again runs one check at once, so a session that expired while the
 * app was away is renewed on return; a refresh that cannot reach the service
 * keeps the session and is tried again on the next tick.
 *
 * Any state but `active` stops it, iOS's `inactive` included: a brief pause costs
 * one check on return and reads nothing. Registered once, for the life of the
 * client. The app is already in front when this runs, and `autoRefreshToken`
 * starts the timer for that.
 */
export function registerSessionRefresh(appState: AppStateLike, auth: AutoRefreshAuth) {
  if (registered) return
  registered = true
  appState.addEventListener('change', (state) => {
    if (state === 'active') void auth.startAutoRefresh()
    else void auth.stopAutoRefresh()
  })
}
