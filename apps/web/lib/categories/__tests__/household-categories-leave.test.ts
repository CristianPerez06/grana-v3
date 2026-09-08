import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  HH,
  U_A,
  U_B,
  U_C,
  actAs,
  actAsAdmin,
  createHouseholdCategoriesDb,
  lit,
} from './support/household-categories-db'

/**
 * `detach_household_classifications` (0063 §6b) — the step `leaveHouseholdCore`
 * runs before deleting the membership. A is about to leave the household she
 * shares with B; the RPC runs AS A, under RLS, and must leave her own rows
 * classified with copies she will still be able to read, without touching
 * anything shared or anything of B's.
 */

type Row = Record<string, unknown>

let db: PGlite

const q = async <T extends Row = Row>(sql: string): Promise<T[]> => (await db.query<T>(sql)).rows

const CAT_SYS = '00000000-0000-0000-0000-00000000c000'
const CAT_HH = '00000000-0000-0000-0000-00000000c0a2' // household "La Foresta", created by A
const SUB_HH = '00000000-0000-0000-0000-00000000d0a2' // household "Expensas" under La Foresta
const SUB_HH_SYS = '00000000-0000-0000-0000-00000000d0a3' // household "Verdulería" under system Comida
const CAT_A_OWN_CLASH = '00000000-0000-0000-0000-00000000c0a9' // A's own, also canonical la-foresta

const TX_A_PRIVATE = '00000000-0000-0000-0000-00000000e0a1'
const TX_A_PRIVATE_SYS = '00000000-0000-0000-0000-00000000e0a2'
const TX_A_SHARED = '00000000-0000-0000-0000-00000000e0a3'
const TX_B_PRIVATE = '00000000-0000-0000-0000-00000000e0b1'
const REC_A = '00000000-0000-0000-0000-00000000f0a1'
const INST_A = '00000000-0000-0000-0000-00000000f0a2'

beforeAll(async () => {
  db = await createHouseholdCategoriesDb()
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await actAsAdmin(db)
  await db.exec(
    'truncate public.recurrence_instances, public.transactions, public.recurrences, public.subcategories, public.categories cascade;',
  )
  await db.exec(`
    insert into public.categories (id, user_id, household_id, name, canonical_name, type, icon, color)
    values (${lit(CAT_SYS)}, null, null, 'Comida', 'comida', 'expense', null, null),
           (${lit(CAT_HH)}, ${lit(U_A)}, ${lit(HH)}, 'La Foresta', 'la-foresta', 'expense', '🏡', '#123456'),
           (${lit(CAT_A_OWN_CLASH)}, ${lit(U_A)}, null, 'La Foresta', 'la-foresta', 'expense', null, null);
    insert into public.subcategories (id, category_id, user_id, household_id, name, canonical_name)
    values (${lit(SUB_HH)}, ${lit(CAT_HH)}, ${lit(U_B)}, ${lit(HH)}, 'Expensas', 'expensas'),
           (${lit(SUB_HH_SYS)}, ${lit(CAT_SYS)}, ${lit(U_B)}, ${lit(HH)}, 'Verdulería', 'verduleria');

    -- A: a private movement on La Foresta > Expensas, a private one on Comida >
    -- Verdulería, and a shared one on La Foresta. B: a private one on La Foresta.
    insert into public.transactions (id, user_id, household_id, is_shared, category_id, subcategory_id)
    values (${lit(TX_A_PRIVATE)}, ${lit(U_A)}, null, false, ${lit(CAT_HH)}, ${lit(SUB_HH)}),
           (${lit(TX_A_PRIVATE_SYS)}, ${lit(U_A)}, null, false, ${lit(CAT_SYS)}, ${lit(SUB_HH_SYS)}),
           (${lit(TX_A_SHARED)}, ${lit(U_A)}, ${lit(HH)}, true, ${lit(CAT_HH)}, ${lit(SUB_HH)}),
           (${lit(TX_B_PRIVATE)}, ${lit(U_B)}, null, false, ${lit(CAT_HH)}, null);

    -- A: a private rule with a pending instance, both on La Foresta.
    insert into public.recurrences (id, user_id, household_id, category_id, subcategory_id)
    values (${lit(REC_A)}, ${lit(U_A)}, null, ${lit(CAT_HH)}, ${lit(SUB_HH)});
    insert into public.recurrence_instances (id, recurrence_id, user_id, category_id, subcategory_id)
    values (${lit(INST_A)}, ${lit(REC_A)}, ${lit(U_A)}, ${lit(CAT_HH)}, ${lit(SUB_HH)});
  `)
})

const detachAs = async (user: string) => {
  await actAs(db, user)
  const [row] = await q<{ n: number }>(
    `select public.detach_household_classifications(${lit(HH)}) as n`,
  )
  return row.n
}

const copyOfLaForesta = async () => {
  await actAsAdmin(db)
  const rows = await q<{
    id: string
    user_id: string
    household_id: string | null
    name: string
    canonical_name: string
    icon: string | null
    color: string | null
  }>(
    `select id, user_id, household_id, name, canonical_name, icon, color
       from public.categories
      where user_id = ${lit(U_A)} and household_id is null and canonical_name like 'la-foresta-hogar%'`,
  )
  expect(rows).toHaveLength(1)
  return rows[0]
}

describe('detach_household_classifications', () => {
  it('copies the household category as an own one and repoints the private movement', async () => {
    const copied = await detachAs(U_A)
    expect(copied).toBe(1)

    const copy = await copyOfLaForesta()
    // Same look; canonical suffixed because A already had an own "la-foresta".
    expect(copy).toMatchObject({
      user_id: U_A,
      household_id: null,
      name: 'La Foresta',
      canonical_name: 'la-foresta-hogar',
      icon: '🏡',
      color: '#123456',
    })

    const [tx] = await q<{ category_id: string; subcategory_id: string }>(
      `select category_id, subcategory_id from public.transactions where id = ${lit(TX_A_PRIVATE)}`,
    )
    expect(tx.category_id).toBe(copy.id)
    // The subcategory copy hangs from the copied category, canonical intact.
    const [sub] = await q<{ category_id: string; user_id: string; household_id: string | null; canonical_name: string }>(
      `select category_id, user_id, household_id, canonical_name from public.subcategories where id = ${lit(tx.subcategory_id)}`,
    )
    expect(sub).toEqual({ category_id: copy.id, user_id: U_A, household_id: null, canonical_name: 'expensas' })
  })

  it('leaves the shared movement, the other member and the household rows untouched', async () => {
    await detachAs(U_A)
    await actAsAdmin(db)

    const [shared] = await q<{ category_id: string; subcategory_id: string }>(
      `select category_id, subcategory_id from public.transactions where id = ${lit(TX_A_SHARED)}`,
    )
    expect(shared).toEqual({ category_id: CAT_HH, subcategory_id: SUB_HH })

    const [ofB] = await q<{ category_id: string }>(
      `select category_id from public.transactions where id = ${lit(TX_B_PRIVATE)}`,
    )
    expect(ofB.category_id).toBe(CAT_HH)

    const [hh] = await q<{ user_id: string; household_id: string | null; name: string }>(
      `select user_id, household_id, name from public.categories where id = ${lit(CAT_HH)}`,
    )
    expect(hh).toEqual({ user_id: U_A, household_id: HH, name: 'La Foresta' })
    // B still sees exactly what she saw before.
    await actAs(db, U_B)
    const seenByB = await q<{ id: string }>('select id from public.categories')
    expect(seenByB.map((r) => r.id).sort()).toEqual([CAT_SYS, CAT_HH].sort())
  })

  it('a household subcategory under a system category is copied under that same category, with a suffixed canonical', async () => {
    await detachAs(U_A)
    await actAsAdmin(db)
    const [tx] = await q<{ category_id: string; subcategory_id: string }>(
      `select category_id, subcategory_id from public.transactions where id = ${lit(TX_A_PRIVATE_SYS)}`,
    )
    expect(tx.category_id).toBe(CAT_SYS)
    expect(tx.subcategory_id).not.toBe(SUB_HH_SYS)
    const [sub] = await q<{ category_id: string; user_id: string; household_id: string | null; name: string; canonical_name: string }>(
      `select category_id, user_id, household_id, name, canonical_name from public.subcategories where id = ${lit(tx.subcategory_id)}`,
    )
    expect(sub).toEqual({
      category_id: CAT_SYS,
      user_id: U_A,
      household_id: null,
      name: 'Verdulería',
      canonical_name: 'verduleria-hogar',
    })
    // The household one is still there for B.
    const [orig] = await q<{ household_id: string | null }>(
      `select household_id from public.subcategories where id = ${lit(SUB_HH_SYS)}`,
    )
    expect(orig.household_id).toBe(HH)
  })

  it('repoints private rules and their instances too', async () => {
    await detachAs(U_A)
    const copy = await copyOfLaForesta()
    const [rec] = await q<{ category_id: string; subcategory_id: string }>(
      `select category_id, subcategory_id from public.recurrences where id = ${lit(REC_A)}`,
    )
    const [inst] = await q<{ category_id: string; subcategory_id: string }>(
      `select category_id, subcategory_id from public.recurrence_instances where id = ${lit(INST_A)}`,
    )
    expect(rec.category_id).toBe(copy.id)
    expect(inst.category_id).toBe(copy.id)
    expect(rec.subcategory_id).toBe(inst.subcategory_id)
    const [sub] = await q<{ category_id: string }>(
      `select category_id from public.subcategories where id = ${lit(rec.subcategory_id)}`,
    )
    expect(sub.category_id).toBe(copy.id)
  })

  it('after the copy, nothing private of A points at a household classification', async () => {
    await detachAs(U_A)
    await actAsAdmin(db)
    const [row] = await q<{ n: number }>(`
      select count(*)::int as n
        from (
          select category_id, subcategory_id from public.transactions where user_id = ${lit(U_A)} and not is_shared
          union all
          select category_id, subcategory_id from public.recurrences where user_id = ${lit(U_A)} and household_id is null
          union all
          select category_id, subcategory_id from public.recurrence_instances where user_id = ${lit(U_A)}
        ) r
        left join public.categories c on c.id = r.category_id
        left join public.subcategories s on s.id = r.subcategory_id
       where c.household_id is not null or s.household_id is not null
    `)
    expect(row.n).toBe(0)
  })

  it('a second call copies nothing more', async () => {
    expect(await detachAs(U_A)).toBe(1)
    expect(await detachAs(U_A)).toBe(0)
    await actAsAdmin(db)
    const [row] = await q<{ n: number }>(
      `select count(*)::int as n from public.categories where user_id = ${lit(U_A)} and household_id is null`,
    )
    expect(row.n).toBe(2) // the pre-existing own one + the single copy
  })

  it('a member without an own name clash keeps the canonical as is', async () => {
    // B's only reference is her private movement on La Foresta.
    expect(await detachAs(U_B)).toBe(1)
    await actAsAdmin(db)
    const [copy] = await q<{ id: string; canonical_name: string }>(
      `select id, canonical_name from public.categories where user_id = ${lit(U_B)} and household_id is null`,
    )
    expect(copy.canonical_name).toBe('la-foresta')
    const [ofB] = await q<{ category_id: string }>(
      `select category_id from public.transactions where id = ${lit(TX_B_PRIVATE)}`,
    )
    expect(ofB.category_id).toBe(copy.id)
    // A's rows never moved.
    const [ofA] = await q<{ category_id: string }>(
      `select category_id from public.transactions where id = ${lit(TX_A_PRIVATE)}`,
    )
    expect(ofA.category_id).toBe(CAT_HH)
  })

  it('a non-member is refused', async () => {
    await actAs(db, U_C)
    await expect(
      db.query(`select public.detach_household_classifications(${lit(HH)})`),
    ).rejects.toThrow(/not_member/)
  })
})
