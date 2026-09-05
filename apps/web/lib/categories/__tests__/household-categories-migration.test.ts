import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  HH,
  U_A,
  U_B,
  U_C,
  actAs,
  actAsAdmin,
  applyMigration,
  createHouseholdCategoriesDb,
  lit,
} from './support/household-categories-db'

/**
 * Migration 0063 — categories owned by the household.
 *
 * A and B share a household; C is outside it. Every assertion below runs the
 * statement AS one of them, with RLS on, and checks what that user can see or
 * change. The migration file is loaded verbatim, self-check included.
 */

type Row = Record<string, unknown>

let db: PGlite

const q = async <T extends Row = Row>(sql: string): Promise<T[]> => (await db.query<T>(sql)).rows

const insertCategory = async (opts: {
  id: string
  user: string | null
  name: string
  household?: string | null
}) =>
  db.exec(
    `insert into public.categories (id, user_id, name, canonical_name, type, household_id)
     values (${lit(opts.id)}, ${lit(opts.user)}, ${lit(opts.name)}, ${lit(opts.name.toLowerCase().replace(/\s+/g, '-'))}, 'expense', ${lit(opts.household ?? null)});`,
  )

const CAT_SYS = '00000000-0000-0000-0000-00000000c000'
const CAT_A_OWN = '00000000-0000-0000-0000-00000000c0a1'
const CAT_A_HH = '00000000-0000-0000-0000-00000000c0a2'
const CAT_C_OWN = '00000000-0000-0000-0000-00000000c0c1'

beforeAll(async () => {
  db = await createHouseholdCategoriesDb()
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await actAsAdmin(db)
  await db.exec(
    'truncate public.transactions, public.recurrences, public.subcategories, public.categories cascade;',
  )
  await insertCategory({ id: CAT_SYS, user: null, name: 'Comida' })
  await insertCategory({ id: CAT_A_OWN, user: U_A, name: 'Privada de A' })
  await insertCategory({ id: CAT_A_HH, user: U_A, name: 'La Foresta', household: HH })
  await insertCategory({ id: CAT_C_OWN, user: U_C, name: 'Privada de C' })
})

describe('visibility', () => {
  it('the other member reads the household category; a non-member does not', async () => {
    await actAs(db, U_B)
    const seenByB = await q<{ id: string }>('select id from public.categories order by name')
    expect(seenByB.map((r) => r.id).sort()).toEqual([CAT_SYS, CAT_A_HH].sort())

    await actAs(db, U_C)
    const seenByC = await q<{ id: string }>('select id from public.categories order by name')
    expect(seenByC.map((r) => r.id).sort()).toEqual([CAT_SYS, CAT_C_OWN].sort())
  })

  it("a member's private category stays private", async () => {
    await actAs(db, U_B)
    const rows = await q(`select id from public.categories where id = ${lit(CAT_A_OWN)}`)
    expect(rows).toHaveLength(0)
  })
})

describe('editing', () => {
  it('any member edits a household category created by the other', async () => {
    await actAs(db, U_B)
    await db.exec(`update public.categories set name = 'Expensas' where id = ${lit(CAT_A_HH)};`)
    await actAsAdmin(db)
    const [row] = await q<{ name: string; user_id: string }>(
      `select name, user_id from public.categories where id = ${lit(CAT_A_HH)}`,
    )
    expect(row.name).toBe('Expensas')
    // Who created it does not change when the other member edits it.
    expect(row.user_id).toBe(U_A)
  })

  it("a member cannot edit the other's private category (RLS: zero rows)", async () => {
    await actAs(db, U_B)
    await db.exec(`update public.categories set name = 'Hackeada' where id = ${lit(CAT_A_OWN)};`)
    await actAsAdmin(db)
    const [row] = await q<{ name: string }>(`select name from public.categories where id = ${lit(CAT_A_OWN)}`)
    expect(row.name).toBe('Privada de A')
  })

  it('a non-member cannot insert a category into the household', async () => {
    await actAs(db, U_C)
    await expect(
      insertCategory({ id: '00000000-0000-0000-0000-00000000c0c9', user: U_C, name: 'Colada', household: HH }),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('ownership shape', () => {
  it('a household category never has a null user_id', async () => {
    await actAsAdmin(db)
    await expect(
      insertCategory({ id: '00000000-0000-0000-0000-00000000c0e1', user: null, name: 'Sin dueño', household: HH }),
    ).rejects.toThrow(/chk_categories_household_has_owner/)
  })

  it('canonical_name is unique per scope: own and household may coincide, two household ones may not', async () => {
    await actAs(db, U_A)
    // A's own "Hogar" next to the household's "Hogar": allowed.
    await insertCategory({ id: '00000000-0000-0000-0000-00000000c0f1', user: U_A, name: 'Hogar' })
    await insertCategory({ id: '00000000-0000-0000-0000-00000000c0f2', user: U_A, name: 'Hogar', household: HH })
    // B tries a second household "Hogar": rejected.
    await actAs(db, U_B)
    await expect(
      insertCategory({ id: '00000000-0000-0000-0000-00000000c0f3', user: U_B, name: 'Hogar', household: HH }),
    ).rejects.toThrow(/categories_household_canonical_name_unique/)
  })
})

describe('subcategories', () => {
  it('a subcategory under a household category inherits the household', async () => {
    await actAs(db, U_B)
    await db.exec(
      `insert into public.subcategories (id, category_id, user_id, name, canonical_name)
       values ('00000000-0000-0000-0000-00000000d001', ${lit(CAT_A_HH)}, ${lit(U_B)}, 'Expensas', 'expensas');`,
    )
    await actAsAdmin(db)
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.subcategories where id = '00000000-0000-0000-0000-00000000d001'`,
    )
    expect(row.household_id).toBe(HH)
    // And A, who did not create it, can see it.
    await actAs(db, U_A)
    expect(await q(`select id from public.subcategories where id = '00000000-0000-0000-0000-00000000d001'`)).toHaveLength(1)
  })

  it('moving a private category to the household drags its private subcategories along', async () => {
    await actAs(db, U_A)
    await db.exec(
      `insert into public.subcategories (id, category_id, user_id, name, canonical_name)
       values ('00000000-0000-0000-0000-00000000d002', ${lit(CAT_A_OWN)}, ${lit(U_A)}, 'Sub privada', 'sub-privada');`,
    )
    await db.exec(`update public.categories set household_id = ${lit(HH)} where id = ${lit(CAT_A_OWN)};`)
    await actAsAdmin(db)
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.subcategories where id = '00000000-0000-0000-0000-00000000d002'`,
    )
    expect(row.household_id).toBe(HH)
  })
})

describe('sharing promotes the classification', () => {
  it('a shared transaction with a private category moves it to the household', async () => {
    await actAs(db, U_A)
    await db.exec(
      `insert into public.transactions (user_id, household_id, is_shared, category_id)
       values (${lit(U_A)}, ${lit(HH)}, true, ${lit(CAT_A_OWN)});`,
    )
    await actAs(db, U_B)
    // B now sees it, by name.
    const rows = await q<{ name: string }>(`select name from public.categories where id = ${lit(CAT_A_OWN)}`)
    expect(rows).toEqual([{ name: 'Privada de A' }])
  })

  it('an unshared transaction promotes nothing', async () => {
    await actAs(db, U_A)
    await db.exec(
      `insert into public.transactions (user_id, is_shared, category_id) values (${lit(U_A)}, false, ${lit(CAT_A_OWN)});`,
    )
    await actAsAdmin(db)
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.categories where id = ${lit(CAT_A_OWN)}`,
    )
    expect(row.household_id).toBeNull()
  })

  it("a non-member's category is never promoted, even if a shared row pointed at it", async () => {
    // Not reachable through the app (RLS would not let A pick C's category), so
    // the harness plants the row as admin to prove the function refuses anyway.
    await actAsAdmin(db)
    await db.exec(
      `insert into public.transactions (user_id, household_id, is_shared, category_id)
       values (${lit(U_A)}, ${lit(HH)}, true, ${lit(CAT_C_OWN)});`,
    )
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.categories where id = ${lit(CAT_C_OWN)}`,
    )
    expect(row.household_id).toBeNull()
  })

  it('a shared recurrence promotes its category too', async () => {
    await actAs(db, U_A)
    await db.exec(
      `insert into public.recurrences (user_id, household_id, category_id) values (${lit(U_A)}, ${lit(HH)}, ${lit(CAT_A_OWN)});`,
    )
    await actAsAdmin(db)
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.categories where id = ${lit(CAT_A_OWN)}`,
    )
    expect(row.household_id).toBe(HH)
  })

  it('sharing an existing movement later (is_shared flips to true) promotes as well', async () => {
    await actAs(db, U_A)
    await db.exec(
      `insert into public.transactions (id, user_id, is_shared, category_id)
       values ('00000000-0000-0000-0000-00000000e001', ${lit(U_A)}, false, ${lit(CAT_A_OWN)});`,
    )
    await db.exec(
      `update public.transactions set is_shared = true, household_id = ${lit(HH)}
        where id = '00000000-0000-0000-0000-00000000e001';`,
    )
    await actAsAdmin(db)
    const [row] = await q<{ household_id: string | null }>(
      `select household_id from public.categories where id = ${lit(CAT_A_OWN)}`,
    )
    expect(row.household_id).toBe(HH)
  })
})

describe('backfill on apply', () => {
  it('promotes the private categories of already-shared rows when the migration runs', async () => {
    const fresh = await createHouseholdCategoriesDb({ applyMigration: false })
    try {
      await fresh.exec(
        `insert into public.categories (id, user_id, name, canonical_name, type)
           values (${lit(CAT_A_OWN)}, ${lit(U_A)}, 'La Foresta', 'la-foresta', 'expense');
         insert into public.subcategories (id, category_id, user_id, name, canonical_name)
           values ('00000000-0000-0000-0000-00000000d0a1', ${lit(CAT_A_OWN)}, ${lit(U_A)}, 'Expensas', 'expensas');
         insert into public.transactions (user_id, household_id, is_shared, category_id, subcategory_id)
           values (${lit(U_A)}, ${lit(HH)}, true, ${lit(CAT_A_OWN)}, '00000000-0000-0000-0000-00000000d0a1');`,
      )
      await applyMigration(fresh)
      const cat = (
        await fresh.query<{ household_id: string | null }>(
          `select household_id from public.categories where id = ${lit(CAT_A_OWN)}`,
        )
      ).rows[0]
      const sub = (
        await fresh.query<{ household_id: string | null }>(
          `select household_id from public.subcategories where id = '00000000-0000-0000-0000-00000000d0a1'`,
        )
      ).rows[0]
      expect(cat.household_id).toBe(HH)
      expect(sub.household_id).toBe(HH)
    } finally {
      await fresh.close()
    }
  })
})
