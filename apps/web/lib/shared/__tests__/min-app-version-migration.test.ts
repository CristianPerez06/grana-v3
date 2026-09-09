import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

/**
 * Migration 0066 — the minimum supported native client.
 *
 * The shipped SQL runs on a real Postgres compiled to WASM, because the three
 * things worth checking here are things a grep cannot see: that the requirement
 * is READABLE by a signed-in user (the gate has to close), NOT readable by
 * `anon` (this schema's standing invariant — see 8.2C.3 in
 * `validate_schema.sql`), and NOT WRITABLE by either (raising the floor locks
 * users out of the app, which is an operator action with the service role).
 *
 * And that it is seeded INERT. Applying this migration must block nobody:
 * shipping the mechanism and arming it are two decisions, and only the first
 * belongs in a deploy.
 */

const SQL = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0066_min_supported_app_version.sql'),
  'utf-8',
)

const SCHEMA = `
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create role anon;
  create role authenticated;
  grant usage on schema public to anon, authenticated;
`

let db: PGlite

const as = async (role: 'anon' | 'authenticated') => {
  await db.exec(`set role ${role};`)
}
const asAdmin = async () => {
  await db.exec('reset role;')
}

/** The rejection's SQLSTATE, or null when the statement went through. */
const stateOf = async (sql: string): Promise<string | null> => {
  try {
    await db.exec(sql)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'UNKNOWN'
  }
}

const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(SQL)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

describe('migration 0066 — app_release_requirements', () => {
  it('ships INERT: both platforms seeded at 0.0.0, blocking nobody', async () => {
    const { rows } = await db.query<{ platform: string; min_version: string; store_url: null }>(
      'select platform, min_version, store_url from public.app_release_requirements order by platform',
    )

    expect(rows).toEqual([
      { platform: 'android', min_version: '0.0.0', store_url: null },
      { platform: 'ios', min_version: '0.0.0', store_url: null },
    ])
  })

  it('accepts only the two platforms that have a store', async () => {
    expect(
      await stateOf(
        `insert into public.app_release_requirements (platform, min_version) values ('web', '1.0.0');`,
      ),
    ).toBe(CHECK_VIOLATION)
  })

  it('refuses a version the client could not parse', async () => {
    // The client fails OPEN on anything it cannot read, so a typo here would
    // silently DISARM the gate instead of announcing itself.
    for (const bad of ['1.5', 'v1.5.0', '1.5.0-rc.1', '']) {
      expect(
        await stateOf(
          `update public.app_release_requirements set min_version = '${bad}' where platform = 'ios';`,
        ),
      ).toBe(CHECK_VIOLATION)
    }
  })

  it('is readable by a signed-in user', async () => {
    await as('authenticated')
    const { rows } = await db.query('select min_version from public.app_release_requirements')
    await asAdmin()

    expect(rows).toHaveLength(2)
  })

  it('is NOT readable by anon, invariant over convenience', async () => {
    // Blocking an out-of-date build on the login screen too would be nicer, and
    // the number is not even secret. It is still refused: `anon` holding no
    // privilege on any table in public is what keeps RLS from being a single
    // point of failure, and one convenient exception is how that stops being
    // true. The gate closes as soon as there is a session, which is also the
    // only state in which an old client can do the damage it prevents.
    await as('anon')
    const state = await stateOf('select min_version from public.app_release_requirements;')
    await asAdmin()

    expect(state).toBe(INSUFFICIENT_PRIVILEGE)
  })

  it('cannot be raised from a client', async () => {
    // The write that locks every old build out of the app. If a client could
    // make it, a compromised token could lock out every user at once.
    for (const role of ['authenticated'] as const) {
      await as(role)
      const update = await stateOf(
        `update public.app_release_requirements set min_version = '9.9.9' where platform = 'ios';`,
      )
      const insert = await stateOf(
        `insert into public.app_release_requirements (platform, min_version) values ('ios', '9.9.9');`,
      )
      const remove = await stateOf(`delete from public.app_release_requirements;`)
      await asAdmin()

      expect({ role, update, insert, remove }).toEqual({
        role,
        update: INSUFFICIENT_PRIVILEGE,
        insert: INSUFFICIENT_PRIVILEGE,
        remove: INSUFFICIENT_PRIVILEGE,
      })
    }
  })

  it('still holds its seeded values after all of that', async () => {
    const { rows } = await db.query<{ min_version: string }>(
      'select min_version from public.app_release_requirements',
    )
    expect(rows.map((row) => row.min_version)).toEqual(['0.0.0', '0.0.0'])
  })
})
