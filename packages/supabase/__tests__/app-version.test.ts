import { describe, expect, it, vi } from 'vitest'
import type { GranaSupabaseClient } from '../src/client'
import {
  appVersionGate,
  compareAppVersions,
  getAppReleaseRequirement,
} from '../src/app-version'

describe('compareAppVersions', () => {
  it('compares part by part, not as text', () => {
    // The whole reason this exists. As strings '1.10.0' < '1.9.0', so a gate
    // built on `<` would let through exactly the builds it means to stop — and
    // block ones it means to allow.
    expect(compareAppVersions('1.10.0', '1.9.0')).toBe(1)
    expect(compareAppVersions('1.9.0', '1.10.0')).toBe(-1)
    expect(compareAppVersions('2.0.0', '10.0.0')).toBe(-1)
  })

  it('is zero for the same version', () => {
    expect(compareAppVersions('1.4.2', '1.4.2')).toBe(0)
  })

  it('orders by patch when major and minor agree', () => {
    expect(compareAppVersions('1.4.3', '1.4.2')).toBe(1)
  })

  it('tolerates surrounding whitespace', () => {
    expect(compareAppVersions(' 1.4.2 ', '1.4.2')).toBe(0)
  })

  it('gives up on anything that is not major.minor.patch', () => {
    // Giving up is what makes the gate fail open, so it must be honest about it
    // rather than guessing a number out of the string.
    expect(compareAppVersions('1.4', '1.4.0')).toBeNull()
    expect(compareAppVersions('1.4.2-beta.1', '1.4.2')).toBeNull()
    expect(compareAppVersions('', '1.0.0')).toBeNull()
    expect(compareAppVersions('v1.4.2', '1.4.2')).toBeNull()
  })
})

describe('appVersionGate', () => {
  const requirement = { min_version: '1.5.0', store_url: 'https://example.test/app' }

  it('blocks a build older than the minimum', () => {
    expect(appVersionGate({ current: '1.4.9', requirement })).toEqual({
      kind: 'blocked',
      minimum: '1.5.0',
      storeUrl: 'https://example.test/app',
    })
  })

  it('allows the minimum itself and anything newer', () => {
    expect(appVersionGate({ current: '1.5.0', requirement }).kind).toBe('allowed')
    expect(appVersionGate({ current: '2.0.0', requirement }).kind).toBe('allowed')
  })

  it('blocks without a link when there is none to give', () => {
    // The App Store id does not exist until the app is published. A blocked user
    // with no link still has to be told why they are blocked.
    expect(
      appVersionGate({ current: '1.0.0', requirement: { min_version: '1.5.0', store_url: null } }),
    ).toEqual({ kind: 'blocked', minimum: '1.5.0', storeUrl: null })
  })

  it('FAILS OPEN when the requirement could not be read', () => {
    // This runs before anything else on startup. A gate that bricks the app on a
    // flaky network bricks it for good — worse than the bug it prevents.
    expect(appVersionGate({ current: '1.0.0', requirement: null }).kind).toBe('allowed')
  })

  it('FAILS OPEN when the build does not know its own version', () => {
    expect(appVersionGate({ current: null, requirement }).kind).toBe('allowed')
  })

  it('FAILS OPEN when either version cannot be parsed', () => {
    expect(appVersionGate({ current: '1.5.0-rc.1', requirement }).kind).toBe('allowed')
    expect(
      appVersionGate({ current: '1.0.0', requirement: { min_version: 'x', store_url: null } }).kind,
    ).toBe('allowed')
  })

  it('is inert at the seeded floor, whatever the build', () => {
    // 0066 seeds `0.0.0`: applying the migration must block nobody. Arming the
    // gate is an operator decision taken once the new build is live in both
    // stores, not a side effect of a deploy.
    const inert = { min_version: '0.0.0', store_url: null }
    expect(appVersionGate({ current: '0.0.1', requirement: inert }).kind).toBe('allowed')
    expect(appVersionGate({ current: '1.0.0', requirement: inert }).kind).toBe('allowed')
  })
})

describe('getAppReleaseRequirement', () => {
  const clientReturning = (result: { data: unknown; error: unknown }) => {
    const maybeSingle = vi.fn(async () => result)
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle }) }),
      }),
    } as unknown as GranaSupabaseClient
    return { client, maybeSingle }
  }

  it('reads the row for the platform asked for', async () => {
    const { client } = clientReturning({
      data: { min_version: '1.5.0', store_url: 'https://example.test/app' },
      error: null,
    })

    await expect(getAppReleaseRequirement(client, 'ios')).resolves.toEqual({
      min_version: '1.5.0',
      store_url: 'https://example.test/app',
    })
  })

  it('answers null on a failed read instead of throwing', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'offline' } })
    await expect(getAppReleaseRequirement(client, 'android')).resolves.toBeNull()
  })

  it('answers null when there is no row for the platform', async () => {
    const { client } = clientReturning({ data: null, error: null })
    await expect(getAppReleaseRequirement(client, 'android')).resolves.toBeNull()
  })

  it('answers null when the client itself throws', async () => {
    const client = {
      from: () => {
        throw new Error('network')
      },
    } as unknown as GranaSupabaseClient

    await expect(getAppReleaseRequirement(client, 'ios')).resolves.toBeNull()
  })
})
