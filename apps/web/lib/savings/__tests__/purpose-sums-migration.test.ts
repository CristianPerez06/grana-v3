import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createPurposeDb } from './support/purpose-sums-db'

/**
 * Migration 0059 — `savings_purpose_allocation`, the invariant trigger and the
 * rewritten `get_purpose_sums`.
 *
 * What these tests protect is the correction 0059 makes to 0058: a purpose is
 * not a label on a historical row, it is a SHARE of what is currently set aside.
 * Saved money is fungible — the same reason a reserve has no `account_id` —
 * so "those $300.000 from July" do not exist; "$190.000 are set aside" does.
 *
 * The invariant lives in the database and fires from BOTH tables, because both
 * can break it: allocating too much breaks it from above, and taking back money
 * that was already allocated breaks it from below without touching a single
 * allocation row.
 */

const UID = '00000000-0000-0000-0000-0000000000a1'
const OTHER_UID = '00000000-0000-0000-0000-0000000000a2'
const BANK = '00000000-0000-0000-0000-0000000b0001'

const JAPON = '00000000-0000-0000-0000-0000000e0001'
const EMERGENCIA = '00000000-0000-0000-0000-0000000e0002'

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

const named = async (today = TODAY) =>
  (await sums(today)).map((r) => [r.purpose_name, r.reserved] as const)

const purpose = (id: string, name: string, opts: { icon?: string; user?: string } = {}) =>
  db.exec(`
    insert into public.savings_purpose (id, user_id, name, icon)
    values ('${id}', '${opts.user ?? UID}', '${name}', ${opts.icon ? `'${opts.icon}'` : 'null'});
  `)

const reserve = (
  amount: number,
  opts: { currency?: string; date?: string; user?: string } = {},
) =>
  db.exec(`
    insert into public.availability_reserve (user_id, currency_code, amount, date)
    values ('${opts.user ?? UID}', '${opts.currency ?? 'ARS'}', ${amount}, '${opts.date ?? TODAY}');
  `)

const allocate = (
  purposeId: string,
  amount: number,
  opts: { currency?: string; date?: string; user?: string } = {},
) =>
  db.exec(`
    insert into public.savings_purpose_allocation (user_id, purpose_id, currency_code, amount, date)
    values (
      '${opts.user ?? UID}', '${purposeId}', '${opts.currency ?? 'ARS'}',
      ${amount}, '${opts.date ?? TODAY}'
    );
  `)

beforeAll(async () => {
  db = await createPurposeDb()
})

beforeEach(async () => {
  await db.exec(`
    truncate public.savings_purpose_allocation, public.availability_reserve,
             public.savings_purpose, public.transactions, public.accounts cascade;
    truncate auth.users cascade;
    insert into auth.users (id) values ('${UID}'), ('${OTHER_UID}');
    insert into public.accounts (id, user_id, type, is_active) values ('${BANK}', '${UID}', 'bank', true);
  `)
})

describe('get_purpose_sums — el reparto, con «Sin destino» derivado', () => {
  it('derives «Sin destino» as what is left over, not as a group of rows', async () => {
    await purpose(JAPON, 'Japón', { icon: '✈️' })
    await reserve(190_000)
    await allocate(JAPON, 150_000)

    expect(await named()).toEqual([
      ['Japón', '150000.00'],
      [null, '40000.00'],
    ])
  })

  it('reports the whole stock as «Sin destino» when nothing is allocated', async () => {
    await reserve(190_000)

    expect(await sums()).toEqual([
      {
        purpose_id: null,
        purpose_name: null,
        purpose_icon: null,
        currency_code: 'ARS',
        reserved: '190000.00',
      },
    ])
  })

  it('carries the name and icon already resolved', async () => {
    await purpose(JAPON, 'Japón', { icon: '✈️' })
    await reserve(300_000)
    await allocate(JAPON, 300_000)

    const rows = await sums()
    expect(rows[0]).toMatchObject({ purpose_id: JAPON, purpose_name: 'Japón', purpose_icon: '✈️' })
    // Allocated everything: the remainder is zero, and it is a row, not an absence.
    expect(rows[1].reserved).toBe('0.00')
  })

  it('keeps each currency on its own row — a purpose can hold both', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(300_000, { currency: 'ARS' })
    await reserve(500, { currency: 'USD' })
    await allocate(JAPON, 200_000, { currency: 'ARS' })
    await allocate(JAPON, 400, { currency: 'USD' })

    expect((await sums()).map((r) => [r.currency_code, r.purpose_name, r.reserved])).toEqual([
      ['ARS', 'Japón', '200000.00'],
      ['ARS', null, '100000.00'],
      ['USD', 'Japón', '400.00'],
      ['USD', null, '100.00'],
    ])
  })

  it('nets the signs inside a purpose — allocating and letting go', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(300_000)
    await allocate(JAPON, 200_000)
    await allocate(JAPON, -50_000)

    expect(await named()).toEqual([
      ['Japón', '150000.00'],
      [null, '150000.00'],
    ])
  })

  it('excludes allocations dated after the cut', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(300_000)
    await allocate(JAPON, 100_000)
    await allocate(JAPON, 70_000, { date: TOMORROW })

    expect(await named()).toEqual([
      ['Japón', '100000.00'],
      [null, '200000.00'],
    ])
    expect(await named(TOMORROW)).toEqual([
      ['Japón', '170000.00'],
      [null, '130000.00'],
    ])
  })

  it('adds up to the same reserved that get_available_sums reports', async () => {
    await purpose(JAPON, 'Japón')
    await purpose(EMERGENCIA, 'Emergencia')
    await reserve(190_000)
    await allocate(JAPON, 100_000)
    await allocate(EMERGENCIA, 50_000)

    // Two cuts of the same money. The groups are a decomposition of the total,
    // so a drift between them would be a real divergence.
    const byGroup = (await sums())
      .filter((r) => r.currency_code === 'ARS')
      .reduce((acc, r) => acc + Number(r.reserved), 0)

    const { rows } = await db.query<{ reserved: string }>(
      `select reserved from public.get_available_sums('${TODAY}') where currency_code = 'ARS'`,
    )
    expect(byGroup).toBe(Number(rows[0].reserved))
  })
})

describe('el invariante — vive en la base y se dispara desde las dos tablas', () => {
  it('refuses to allocate more than what is set aside', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)

    await expect(allocate(JAPON, 200_000)).rejects.toThrow(/allocation_exceeds_reserved/)
  })

  it('accepts allocating exactly the whole stock', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)

    await expect(allocate(JAPON, 190_000)).resolves.toBeDefined()
  })

  it('refuses to leave a purpose negative', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)
    await allocate(JAPON, 50_000)

    await expect(allocate(JAPON, -60_000)).rejects.toThrow(/purpose_allocation_negative/)
  })

  it('refuses to take back money that is already allocated', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)
    await allocate(JAPON, 150_000)

    // This is the half a write-path check would miss: it breaks the invariant
    // from the OTHER table, without touching a single allocation row.
    await expect(reserve(-100_000)).rejects.toThrow(/allocation_exceeds_reserved/)
  })

  it('allows taking back what is NOT allocated', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)
    await allocate(JAPON, 150_000)

    await expect(reserve(-40_000)).resolves.toBeDefined()
    expect(await named()).toEqual([
      ['Japón', '150000.00'],
      [null, '0.00'],
    ])
  })

  it('keeps each currency independent — pesos allocated never block dollars', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000, { currency: 'ARS' })
    await reserve(500, { currency: 'USD' })
    await allocate(JAPON, 190_000, { currency: 'ARS' })

    await expect(reserve(-500, { currency: 'USD' })).resolves.toBeDefined()
  })
})

describe('savings_purpose — borrar una etiqueta ya no puede tocar plata', () => {
  it('returns the money to the remainder when the purpose is deleted', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)
    await allocate(JAPON, 150_000)

    await db.exec(`delete from public.savings_purpose where id = '${JAPON}';`)

    // The allocation cascades away and the money reappears in the remainder —
    // not because anything moves it, but because the remainder is derived and
    // the reserve was never touched.
    expect(await sums()).toEqual([
      {
        purpose_id: null,
        purpose_name: null,
        purpose_icon: null,
        currency_code: 'ARS',
        reserved: '190000.00',
      },
    ])
  })

  it('leaves the total set aside untouched by the deletion', async () => {
    await purpose(JAPON, 'Japón')
    await reserve(190_000)
    await allocate(JAPON, 150_000)
    await db.exec(`delete from public.savings_purpose where id = '${JAPON}';`)

    const { rows } = await db.query<{ reserved: string }>(
      `select reserved from public.get_available_sums('${TODAY}') where currency_code = 'ARS'`,
    )
    expect(rows[0].reserved).toBe('190000.00')
  })

  it('refuses a second purpose with the same name in another case', async () => {
    await purpose(JAPON, 'Japón')

    await expect(purpose(EMERGENCIA, 'japón')).rejects.toThrow()
    await expect(purpose(EMERGENCIA, '  JAPÓN  ')).rejects.toThrow()
  })

  it('lets two users each have their own «Japón»', async () => {
    await purpose(JAPON, 'Japón')
    await expect(purpose(EMERGENCIA, 'Japón', { user: OTHER_UID })).resolves.toBeDefined()
  })

  it('refuses a blank name', async () => {
    await expect(purpose(JAPON, '   ')).rejects.toThrow()
  })
})

describe('la fila de la reserva ya no sabe para qué es', () => {
  it('has no purpose_id column left', async () => {
    const { rows } = await db.query<{ n: string }>(`
      select count(*)::text as n from information_schema.columns
      where table_schema = 'public' and table_name = 'availability_reserve'
        and column_name = 'purpose_id'
    `)
    expect(rows[0].n).toBe('0')
  })
})

describe('write_reserve — las dos filas, o ninguna', () => {
  // `auth.uid()` no existe en el harness: se stubea para que RLS y la función
  // resuelvan el usuario igual que en Supabase.
  const asUser = async (id: string) => {
    await db.exec(`
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid
        language sql stable as $fn$ select '${id}'::uuid $fn$;
    `)
  }

  const write = (amount: number, purposeId: string | null, currency = 'ARS') =>
    db.query<{ write_reserve: string }>(
      `select public.write_reserve(${amount}, '${currency}', '${TODAY}', ${
        purposeId ? `'${purposeId}'` : 'null'
      })`,
    )

  beforeEach(async () => {
    await asUser(UID)
  })

  it('saves and allocates in one go', async () => {
    await purpose(JAPON, 'Japón')
    await write(200_000, JAPON)

    expect(await named()).toEqual([
      ['Japón', '200000.00'],
      [null, '0.00'],
    ])
  })

  it('leaves nothing behind when the allocation half is impossible', async () => {
    await purpose(JAPON, 'Japón', { user: OTHER_UID })

    // Ajeno: RLS no lo deja ver, así que la función corta antes de escribir.
    await expect(write(200_000, JAPON)).rejects.toThrow(/purpose_not_found/)

    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from public.availability_reserve`,
    )
    expect(rows[0].n).toBe('0')
  })

  it('takes back from a purpose, lowering both sides', async () => {
    await purpose(JAPON, 'Japón')
    await write(200_000, JAPON)
    await write(-50_000, JAPON)

    expect(await named()).toEqual([
      ['Japón', '150000.00'],
      [null, '0.00'],
    ])
  })

  it('refuses to take back more than the purpose holds', async () => {
    await purpose(JAPON, 'Japón')
    await write(200_000, JAPON)

    await expect(write(-250_000, JAPON)).rejects.toThrow(/purpose_allocation_negative/)
  })

  it('saves without a purpose, landing in the remainder', async () => {
    await write(80_000, null)

    expect(await named()).toEqual([[null, '80000.00']])
  })
})
