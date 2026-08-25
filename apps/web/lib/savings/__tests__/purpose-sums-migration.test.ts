import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createPurposeDb } from './support/purpose-sums-db'

/**
 * Migration 0058 — `savings_purpose`, `availability_reserve.purpose_id` and
 * `get_purpose_sums`.
 *
 * What these tests protect is the reason the function exists at all: with
 * purposes, "you can't take back more than you saved" stops being enough. The
 * global total can cover a withdrawal that leaves ONE purpose negative, and the
 * floor has to be per (purpose, currency). That sum is defined once, in SQL —
 * 0051's lesson one level down.
 *
 * The SQL runs on PGlite with the DDL and the function body loaded verbatim from
 * the migration file, so what is exercised is the shipped SQL.
 */

const UID = '00000000-0000-0000-0000-0000000000a1'
const OTHER_UID = '00000000-0000-0000-0000-0000000000a2'
const BANK = '00000000-0000-0000-0000-0000000b0001'

const EMERGENCIA = '00000000-0000-0000-0000-0000000e0001'
const JAPON = '00000000-0000-0000-0000-0000000e0002'

const TODAY = '2026-08-23'
const TOMORROW = '2026-08-24'

type PurposeSums = {
  purpose_id: string | null
  purpose_name: string | null
  purpose_icon: string | null
  currency_code: string
  reserved: string
}

let db: PGlite

/** Ordered so «Sin destino» (NULL) lands last and the rows read predictably. */
const sums = async (today = TODAY) =>
  (
    await db.query<PurposeSums>(`
      select * from public.get_purpose_sums('${today}')
      order by currency_code, purpose_name nulls last
    `)
  ).rows

const purpose = (id: string, name: string, opts: { icon?: string; user?: string } = {}) =>
  db.exec(`
    insert into public.savings_purpose (id, user_id, name, icon)
    values ('${id}', '${opts.user ?? UID}', '${name}', ${opts.icon ? `'${opts.icon}'` : 'null'});
  `)

const reserve = (
  amount: number,
  opts: { currency?: string; date?: string; user?: string; purposeId?: string | null } = {},
) =>
  db.exec(`
    insert into public.availability_reserve (user_id, currency_code, amount, date, purpose_id)
    values (
      '${opts.user ?? UID}', '${opts.currency ?? 'ARS'}', ${amount},
      '${opts.date ?? TODAY}', ${opts.purposeId ? `'${opts.purposeId}'` : 'null'}
    );
  `)

// One Postgres for the file, rows truncated between tests — same reasoning as the
// 0057 suite: booting PGlite is ~2s of WASM startup and the schema is immutable.
beforeAll(async () => {
  db = await createPurposeDb()
})

beforeEach(async () => {
  await db.exec(`
    truncate public.availability_reserve, public.savings_purpose, public.transactions, public.accounts cascade;
    truncate auth.users cascade;
    insert into auth.users (id) values ('${UID}'), ('${OTHER_UID}');
    insert into public.accounts (id, user_id, type, is_active) values ('${BANK}', '${UID}', 'bank', true);
  `)
})

describe('get_purpose_sums — the floor, one purpose at a time', () => {
  it('groups by purpose and carries the name and icon already resolved', async () => {
    await purpose(EMERGENCIA, 'Emergencia', { icon: '🚑' })
    await reserve(150_000, { purposeId: EMERGENCIA })

    expect(await sums()).toEqual([
      {
        purpose_id: EMERGENCIA,
        purpose_name: 'Emergencia',
        purpose_icon: '🚑',
        currency_code: 'ARS',
        reserved: '150000.00',
      },
    ])
  })

  it('reports untagged savings as their own group, not as an absence', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await reserve(150_000, { purposeId: EMERGENCIA })
    await reserve(40_000)

    // This is the case the whole function exists for. The global reserved is
    // $190.000, so a $60.000 release passes the phase-1 check — and leaves
    // «Sin destino» at −$20.000 while the total still adds up.
    const rows = await sums()
    expect(rows.map((r) => [r.purpose_name, r.reserved])).toEqual([
      ['Emergencia', '150000.00'],
      [null, '40000.00'],
    ])
  })

  it('keeps each currency on its own row — a purpose can hold both', async () => {
    await purpose(JAPON, 'Japón', { icon: '✈️' })
    await reserve(300_000, { purposeId: JAPON, currency: 'ARS' })
    await reserve(500, { purposeId: JAPON, currency: 'USD' })

    expect((await sums()).map((r) => [r.currency_code, r.reserved])).toEqual([
      ['ARS', '300000.00'],
      ['USD', '500.00'],
    ])
  })

  it('nets the signs inside each purpose', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await reserve(200_000, { purposeId: EMERGENCIA })
    await reserve(-50_000, { purposeId: EMERGENCIA })

    expect((await sums())[0].reserved).toBe('150000.00')
  })

  it('returns a purpose that nets to zero instead of dropping it', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await reserve(100_000, { purposeId: EMERGENCIA })
    await reserve(-100_000, { purposeId: EMERGENCIA })

    // The write path reads this as the floor. Zero and "no row" would both mean
    // "can't release", but only one of them says so out loud.
    expect(await sums()).toEqual([
      {
        purpose_id: EMERGENCIA,
        purpose_name: 'Emergencia',
        purpose_icon: null,
        currency_code: 'ARS',
        reserved: '0.00',
      },
    ])
  })

  it('excludes reserves dated after the cut', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await reserve(100_000, { purposeId: EMERGENCIA })
    await reserve(70_000, { purposeId: EMERGENCIA, date: TOMORROW })

    expect((await sums())[0].reserved).toBe('100000.00')
    expect((await sums(TOMORROW))[0].reserved).toBe('170000.00')
  })

  it('adds up to the same reserved that get_available_sums reports', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await purpose(JAPON, 'Japón')
    await reserve(150_000, { purposeId: EMERGENCIA })
    await reserve(300_000, { purposeId: JAPON })
    await reserve(40_000)

    // Two cuts of the same rows. Neither is derived from the other, so a drift
    // between them would be a real divergence and not a rounding artefact.
    const byPurpose = (await sums())
      .filter((r) => r.currency_code === 'ARS')
      .reduce((acc, r) => acc + Number(r.reserved), 0)

    const { rows } = await db.query<{ reserved: string }>(
      `select reserved from public.get_available_sums('${TODAY}') where currency_code = 'ARS'`,
    )
    expect(String(byPurpose)).toBe(String(Number(rows[0].reserved)))
  })
})

describe('savings_purpose — the label, and what it may never do', () => {
  it('sends the money back to «Sin destino» when the purpose is deleted', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(300_000, { purposeId: JAPON })

    await db.exec(`delete from public.savings_purpose where id = '${JAPON}';`)

    // Deleting a LABEL may never change a NUMBER. The row survives with a null
    // purpose; under ON DELETE CASCADE this would silently be an empty array and
    // the user's savings would have dropped by $300.000.
    expect(await sums()).toEqual([
      {
        purpose_id: null,
        purpose_name: null,
        purpose_icon: null,
        currency_code: 'ARS',
        reserved: '300000.00',
      },
    ])
  })

  it('refuses a second purpose with the same name in another case', async () => {
    await purpose(EMERGENCIA, 'Emergencia')

    await expect(purpose(JAPON, 'emergencia')).rejects.toThrow()
    await expect(purpose(JAPON, '  EMERGENCIA  ')).rejects.toThrow()
  })

  it('lets two users each have their own «Emergencia»', async () => {
    await purpose(EMERGENCIA, 'Emergencia')
    await expect(purpose(JAPON, 'Emergencia', { user: OTHER_UID })).resolves.toBeDefined()
  })

  it('refuses a blank name', async () => {
    await expect(purpose(EMERGENCIA, '   ')).rejects.toThrow()
  })
})
