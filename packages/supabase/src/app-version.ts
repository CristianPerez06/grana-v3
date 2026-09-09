import type { GranaSupabaseClient } from './client'

/**
 * "Is this build still allowed to run?" — the minimum supported native client.
 *
 * The activation migration drops the single-pending index, and from then on the
 * backlog exists. A user who stays on an OLD native build never runs the new
 * generator: their backlog is never materialized, so #96 stays alive for them,
 * now with nothing containing it. The compatibility trigger keeps what that
 * client writes VALID; it cannot make it run logic it does not have.
 *
 * So the requirement lives on the server (`app_release_requirements`, migration
 * 0066): a number baked into a shipped build cannot be raised for the builds
 * already installed, which are exactly the ones this is about.
 *
 * IT FAILS OPEN, EVERYWHERE. A read that failed, a missing row, a version
 * neither side can parse — all of them let the user in. A gate that bricks the
 * app on a flaky network is worse than the bug it prevents, and this one runs
 * before anything else on startup, so it would brick it for good.
 */

export type AppPlatform = 'ios' | 'android'

export type AppReleaseRequirement = {
  min_version: string
  store_url: string | null
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

function parse(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * `-1`, `0` or `1`, comparing part by part — never as strings, where '1.10.0'
 * sorts BELOW '1.9.0' and a gate would let through exactly the builds it means
 * to stop. `null` when either side is not a plain `major.minor.patch`.
 */
export function compareAppVersions(a: string, b: string): number | null {
  const left = parse(a)
  const right = parse(b)
  if (left == null || right == null) return null
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1
  }
  return 0
}

export type AppVersionGate =
  | { kind: 'allowed' }
  | { kind: 'blocked'; minimum: string; storeUrl: string | null }

/**
 * What the running build is allowed to do.
 *
 * `blocked` only when both versions are known AND the running one is strictly
 * older. Everything else — no requirement read yet, a failed read, an
 * unparseable version on either side — is `allowed`, deliberately.
 */
export function appVersionGate(state: {
  current: string | null
  requirement: AppReleaseRequirement | null
}): AppVersionGate {
  const { current, requirement } = state
  if (current == null || requirement == null) return { kind: 'allowed' }

  const comparison = compareAppVersions(current, requirement.min_version)
  if (comparison == null || comparison >= 0) return { kind: 'allowed' }

  return {
    kind: 'blocked',
    minimum: requirement.min_version,
    storeUrl: requirement.store_url,
  }
}

/**
 * The requirement for one platform, or null when there is none to be had.
 *
 * Never throws: the caller is the app's own startup path, and the one thing it
 * must not do is stop on this read. A null answer means "no requirement known",
 * which `appVersionGate` reads as allowed.
 */
export async function getAppReleaseRequirement(
  supabase: GranaSupabaseClient,
  platform: AppPlatform,
): Promise<AppReleaseRequirement | null> {
  try {
    const { data, error } = await supabase
      .from('app_release_requirements')
      .select('min_version, store_url')
      .eq('platform', platform)
      .maybeSingle()

    if (error || !data) return null
    return { min_version: data.min_version, store_url: data.store_url }
  } catch {
    return null
  }
}
