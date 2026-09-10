import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createLegsDb } from './support/card-payment-legs-db'

/**
 * Migration 0067 — `card_period_pending` closed to `anon`.
 *
 * 0055 shut the anonymous role out of `public` with a blanket revoke, and 0061
 * reopened it for one function: Postgres grants EXECUTE to PUBLIC on every new
 * function, so a blanket revoke only covers what already exists. Found by
 * `validate_schema.sql` against the real database, months after the fact.
 *
 * The SQL is loaded VERBATIM from the migration, so what runs here is the
 * shipped statement and not a transcription of it. The test asserts BOTH
 * directions, because a migration that revokes from everybody would pass a
 * one-sided check while breaking card payments.
 */

const UID = '00000000-0000-0000-0000-0000000000a1'
const CARD = '00000000-0000-0000-0000-0000000c0001'
const BANK = '00000000-0000-0000-0000-0000000b0001'
const PERIOD = '00000000-0000-0000-0000-0000000d0001'

const migration = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0067_card_period_pending_anon_boundary.sql'),
  'utf-8',
)

/**
 * The migration's body, minus its own transaction: PGlite runs one statement at
 * a time. Deliberately NOT asserting on the statements themselves — what has to
 * hold is the privilege each role ends up with, and a test that reads the SQL
 * back passes for any rewrite that says the same words and none that does the
 * same thing.
 */
function activation(): string {
  if (!migration.includes('public.card_period_pending')) {
    throw new Error('0067 does not mention card_period_pending — wrong file')
  }
  return migration.replace(/^begin;$/m, '').replace(/^commit;$/m, '')
}

const canExecute = async (db: PGlite, role: string) => {
  const res = await db.query<{ allowed: boolean }>(
    `select has_function_privilege('${role}', 'public.card_period_pending(uuid)', 'EXECUTE') as allowed`,
  )
  return res.rows[0].allowed
}

let db: PGlite

beforeEach(async () => {
  db = await createLegsDb()
  // The harness has no roles: PostgREST's two live in the real database, and
  // what this migration changes is what they may do.
  await db.exec(`
    create role anon;
    create role authenticated;
    -- Supabase grants EXECUTE to anon DIRECTLY on every new function, on top of
    -- what it inherits from PUBLIC — the discovery 0055 documents, and the reason
    -- 0067 revokes twice. PGlite has no such default, so the harness reproduces
    -- it: without this line a revoke from PUBLIC alone would look sufficient here
    -- and fail in production, which is exactly the trap 0048/0050/0051/0052 fell
    -- into.
    grant execute on function public.card_period_pending(uuid) to anon;
    insert into auth.users (id) values ('${UID}');
    insert into public.accounts (id, user_id, name, type) values
      ('${CARD}', '${UID}', 'Visa', 'credit'),
      ('${BANK}', '${UID}', 'Santander', 'bank');
    insert into public.card_periods (id, account_id, start_date, end_date, due_date) values
      ('${PERIOD}', '${CARD}', '2026-07-08', '2026-08-07', '2026-08-14');
    insert into public.account_currencies (account_id, currency_code) values ('${BANK}', 'ARS');
    select set_config('request.jwt.claim.sub', '${UID}', false);
  `)
})

describe('0067 — the anonymous role executes nothing in public', () => {
  it('anon can execute it before the migration', async () => {
    // The defect itself, reproduced: nobody in the repo granted this. Postgres
    // and Supabase did, and the blanket revoke that ran in 0055 cannot reach a
    // function created in 0061.
    expect(await canExecute(db, 'anon')).toBe(true)
  })

  it('after the migration, anon cannot execute it', async () => {
    await db.exec(activation())
    expect(await canExecute(db, 'anon')).toBe(false)
  })

  it('after the migration, authenticated still can', async () => {
    await db.exec(activation())
    expect(await canExecute(db, 'authenticated')).toBe(true)
  })

  it('the authenticated card payment flow still settles the statement', async () => {
    // The module the migration touches, end to end, after it runs.
    //
    // Measured, not assumed: this flow survives even WITHOUT the grant to
    // `authenticated`, because `pay_card_period_legs` is SECURITY DEFINER, so
    // the trigger chain — and `card_period_pending` inside it — runs as the
    // definer and never as the caller. What guards the grant is the previous
    // test; what this one guards is that closing the door did not wall off the
    // callers that DO depend on the function being executable at all.
    await db.exec(`
      insert into public.transactions (id, user_id, account_id, type, amount, currency_code, status, card_period_id)
      values ('00000000-0000-0000-0000-00000000e001', '${UID}', '${CARD}', 'expense', 10000, 'ARS', 'pending', '${PERIOD}');
      insert into public.transactions (id, user_id, account_id, type, amount, currency_code)
      values ('00000000-0000-0000-0000-00000000e002', '${UID}', '${BANK}', 'expense', 10000, 'ARS');
    `)
    await db.exec(activation())

    const payload = JSON.stringify([
      {
        payment_account_id: BANK,
        payment_date: '2026-08-20',
        allocations: [{ settles_currency: 'ARS', settles_amount: 10000 }],
      },
    ])

    await db.exec('set role authenticated')
    const res = await db.query<{ result: { settled: boolean; pending_ars: string | number } }>(`
      select public.pay_card_period_legs(
        '${PERIOD}'::uuid, '${payload}'::jsonb, '2026-08-20'::date, 0
      ) as result
    `)
    await db.exec('reset role')

    expect(res.rows[0].result.settled).toBe(true)
    expect(Number(res.rows[0].result.pending_ars)).toBe(0)
  })
})
