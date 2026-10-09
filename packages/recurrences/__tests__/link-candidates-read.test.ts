import type { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getRecurrenceLinkCandidates, linkAmountDiffers } from '../src/link'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * Lo que la lista «¿Cuál de estos es?» necesita para que cada fila se reconozca
 * (#190): la cuenta y la clasificación de cada candidato, sin perder el orden de
 * proximidad que decide el RPC.
 */

const REGLA = '00000000-0000-4000-8000-00000000f190'
const VENCE = '2026-09-23'
const CUENTA = '00000000-0000-4000-8000-0000000a0190'
const CATEGORIA = '00000000-0000-4000-8000-0000000c0190'
const SUBCATEGORIA = '00000000-0000-4000-8000-0000000d0190'

let db: PGlite

beforeEach(async () => {
  db = await createRecurrenceIdentityDb()
  await actAsAdmin(db)
  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, schedule_effective_from, account_id)
    values ('${REGLA}', '${U_A}', '${VENCE}', 1, 'month', 'active', 1000, 'ARS', 'expense',
            '${VENCE}', '${CUENTA}');
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
       anchor_date, is_assumed)
    values ('${REGLA}', '${U_A}', '${VENCE}', null, 1, 'month', '${VENCE}', false);

    insert into public.accounts (id, user_id, name, type)
    values ('${CUENTA}', '${U_A}', 'Visa Galicia', 'credit');
    insert into public.categories (id, user_id, name, canonical_name)
    values ('${CATEGORIA}', null, 'Alimentación', 'food');
    insert into public.subcategories (id, user_id, category_id, name, canonical_name)
    values ('${SUBCATEGORIA}', null, '${CATEGORIA}', 'Supermercado', 'supermarket');
  `)
})

afterEach(async () => {
  await db?.close()
})

const movement = async (opts: {
  amount: number
  description?: string | null
  accountId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
}): Promise<string> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ id: string }>(`
    insert into public.transactions
      (user_id, date, amount, type, currency_code, account_id, category_id, subcategory_id,
       description)
    values ('${U_A}', '${VENCE}', ${opts.amount}, 'expense', 'ARS',
            ${opts.accountId ? `'${opts.accountId}'` : 'null'},
            ${opts.categoryId ? `'${opts.categoryId}'` : 'null'},
            ${opts.subcategoryId ? `'${opts.subcategoryId}'` : 'null'},
            ${opts.description ? `'${opts.description}'` : 'null'})
    returning id
  `)
  return rows[0].id
}

const read = async () => {
  await actAs(db, U_A)
  return getRecurrenceLinkCandidates(pglitePostgrest(db), { recurrenceId: REGLA, dueDate: VENCE })
}

describe('getRecurrenceLinkCandidates — con qué se nombra cada fila', () => {
  it('trae la cuenta, la categoría y la subcategoría de cada candidato', async () => {
    const tx = await movement({
      amount: 1000,
      accountId: CUENTA,
      categoryId: CATEGORIA,
      subcategoryId: SUBCATEGORIA,
    })
    const [candidate] = await read()
    expect(candidate.id).toBe(tx)
    expect(candidate.account).toMatchObject({ id: CUENTA, name: 'Visa Galicia', type: 'credit' })
    expect(candidate.category).toMatchObject({ id: CATEGORIA, canonical_name: 'food', user_id: null })
    expect(candidate.subcategory).toMatchObject({
      id: SUBCATEGORIA,
      canonical_name: 'supermarket',
      user_id: null,
    })
  })

  it('sin clasificación ni cuenta, los tres llegan en null y la fila sigue', async () => {
    const tx = await movement({ amount: 1000 })
    const [candidate] = await read()
    expect(candidate).toMatchObject({
      id: tx,
      account: null,
      category: null,
      subcategory: null,
      type: 'expense',
    })
  })

  it('conserva el orden del RPC', async () => {
    // La segunda lectura vuelve en el orden que se le ocurra a la base: la fusión
    // tiene que respetar el del RPC. Sin coincidencia por nombre ordena el
    // importe, y la cuenta de la regla no adelanta a nadie (0077).
    const lejos = await movement({ amount: 9000 })
    const cerca = await movement({ amount: 1100 })
    const mismaCuenta = await movement({ amount: 5000, accountId: CUENTA })
    expect((await read()).map((c) => c.id)).toEqual([cerca, mismaCuenta, lejos])
  })

  it('sin candidatos devuelve una lista vacía', async () => {
    expect(await read()).toEqual([])
  })
})

describe('linkAmountDiffers', () => {
  it('iguales, aunque lleguen como texto y número', () => {
    expect(linkAmountDiffers(450000, '450000.00')).toBe(false)
  })

  it('un centavo de diferencia ya es distinto', () => {
    expect(linkAmountDiffers('3333.33', '3333.34')).toBe(true)
  })

  it('distintos', () => {
    expect(linkAmountDiffers(610000, 450000)).toBe(true)
  })
})

/** La regla de la prueba, con su nombre. Sin descripción ni clasificación por defecto. */
const nameRule = async (fields: {
  description?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
}) => {
  await actAsAdmin(db)
  await db.query(
    'update public.recurrences set description = $1, category_id = $2, subcategory_id = $3 where id = $4',
    [fields.description ?? null, fields.categoryId ?? null, fields.subcategoryId ?? null, REGLA],
  )
}

describe('recurrence_link_candidates — el orden (0077)', () => {
  it('primero lo que coincide con la descripción de la regla, aunque el importe sea otro', async () => {
    await nameRule({ description: 'Gimnasio' })
    const cine = await movement({ amount: 1000, description: 'Cine' })
    const gimnasio = await movement({ amount: 10000, description: 'Gimnasio' })
    expect((await read()).map((c) => c.id)).toEqual([gimnasio, cine])
  })

  it('la descripción coincide sin distinguir mayúsculas, acentos ni espacios', async () => {
    await nameRule({ description: 'Música' })
    const otro = await movement({ amount: 1000, description: 'Cine' })
    const musica = await movement({ amount: 10000, description: '  MUSICA ' })
    expect((await read()).map((c) => c.id)).toEqual([musica, otro])
  })

  it('sin descripción, coincide la subcategoría de la regla', async () => {
    await nameRule({ categoryId: CATEGORIA, subcategoryId: SUBCATEGORIA })
    const misma = await movement({ amount: 9000, categoryId: CATEGORIA, subcategoryId: SUBCATEGORIA })
    const soloCategoria = await movement({ amount: 1000, categoryId: CATEGORIA })
    expect((await read()).map((c) => c.id)).toEqual([misma, soloCategoria])
  })

  it('sin descripción ni subcategoría, coincide la categoría', async () => {
    await nameRule({ categoryId: CATEGORIA })
    const otra = await movement({ amount: 1000 })
    const misma = await movement({ amount: 9000, categoryId: CATEGORIA })
    expect((await read()).map((c) => c.id)).toEqual([misma, otra])
  })

  it('entre los que coinciden, el importe más parecido primero', async () => {
    await nameRule({ description: 'Gimnasio' })
    const lejos = await movement({ amount: 9000, description: 'Gimnasio' })
    const cerca = await movement({ amount: 1200, description: 'Gimnasio' })
    expect((await read()).map((c) => c.id)).toEqual([cerca, lejos])
  })
})
