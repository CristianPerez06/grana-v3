import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import {
  appVersionGate,
  getAppReleaseRequirement,
  type AppPlatform,
  type AppVersionGate,
} from '@grana/supabase'
import { supabase } from './supabase'

/**
 * The minimum supported build, read at startup.
 *
 * Why it has to exist before the activation, and why it fails open on every
 * unknown, is in `packages/supabase/src/app-version.ts` and in migration 0066.
 * This file is only the wiring: which platform, which version, and holding the
 * answer while the read is in flight.
 *
 * WHILE IT IS UNKNOWN THE APP RUNS. There is no blocking splash: making every
 * cold start wait on a network read would trade a rare, deliberate block for a
 * delay on every single launch — and on a bad connection, for a launch that
 * never finishes. A build old enough to be blocked gets blocked a moment later,
 * which is soon enough for something the user has to go to a store to fix.
 *
 * The requirement is readable by SIGNED-IN users only — `anon` holds no
 * privilege on any table in this schema, and that invariant is worth more than
 * blocking on the login screen — so the check is repeated when a session
 * arrives. Without that, a user who opens the app signed out and then logs in
 * would keep an old build running for the rest of the session, which is exactly
 * the session in which it can do harm.
 */

/** `null` where the gate does not apply — web, or a platform with no store. */
function currentPlatform(): AppPlatform | null {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return null
}

/**
 * The build's own version, from the app config.
 *
 * `expoConfig` can be absent (a bare runtime, an odd build), and that reads as
 * "unknown" rather than as an old version — the gate then lets the user in.
 */
export function currentAppVersion(): string | null {
  const version = Constants.expoConfig?.version
  return typeof version === 'string' && version.length > 0 ? version : null
}

export function useAppVersionGate(): AppVersionGate {
  const [gate, setGate] = useState<AppVersionGate>({ kind: 'allowed' })

  useEffect(() => {
    const platform = currentPlatform()
    if (platform == null) return

    let cancelled = false
    const check = () => {
      void getAppReleaseRequirement(supabase, platform).then((requirement) => {
        if (cancelled) return
        setGate(appVersionGate({ current: currentAppVersion(), requirement }))
      })
    }

    // Once on mount, for a session restored from secure storage…
    check()

    // …and again when one arrives, because the read needs it to return a row.
    // Not on focus and not on an interval: the requirement moves when an
    // operator raises it, which is rare and deliberate, and locking someone out
    // mid-form is not something a background poll should be able to do.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') check()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return gate
}
