import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  createSettlementGuardDb,
  seedSettlement,
  seedSharedExpense,
  sqlstateOf,
  U_OTHER,
  U_PAYER,
} from './support/settlement-guard-db'

/**
 * LA GUARDA TIENE QUE VER LA VERDAD COMPLETA, NO LA DE QUIEN LA DISPARA.
 *
 * Encontrado en QA: un gasto compartido del 5/10, una liquidación vigente del
 * 6/10 registrada por el OTRO miembro, y desvincular el gasto funcionó igual.
 *
 * La fila `settlement` la ven los dos miembros; su FECHA no, porque vive en el
 * movimiento del pagador, que es personal. Con la guarda corriendo como el que
 * dispara el UPDATE, el `join` no encontraba nada y la protección desaparecía
 * justo en el caso que más importa: el que uno no puede revisar por su cuenta.
 *
 * `GASTO` cae el 10/09; las liquidaciones se fechan el 20/09, posteriores a él.
 */

const GASTO = '2026-09-10'
const LIQUIDACION = '2026-09-20'
/** Ni dueño del gasto ni miembro del hogar. */
const AJENO = '00000000-0000-0000-0000-0000000000c3'

let db: PGlite

afterEach(async () => {
  await db?.close()
})

const unshare = (id: string) =>
  `update public.transactions set is_shared = false, household_id = null where id = '${id}';`

describe('la guarda bloquea aunque la liquidación sea del otro miembro', () => {
  beforeEach(async () => {
    db = await createSettlementGuardDb()
  })

  it('bloquea desvincular', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  })

  it('bloquea borrar', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    expect(await sqlstateOf(db, `delete from public.transactions where id = '${gasto}';`)).toBe(
      'GRN01',
    )
  })

  it('sigue dejando pasar lo que ninguna liquidación cubre', async () => {
    // Que vea más no puede significar que bloquee de más: la liquidación del
    // otro es ANTERIOR al gasto, así que no lo liquidó.
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: '2026-09-01', status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('el usuario, por su cuenta, no ve la liquidación que lo traba', async () => {
    // El síntoma en crudo, y la razón de que el mensaje necesite su propio RPC:
    // preguntando como la app preguntaba, la respuesta es «ninguna».
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n
         from public.settlement s
         join public.transactions pm on pm.id = s.payer_movement_id
        where s.household_id = (select household_id from public.shared_expense_split
                                 where transaction_id = '${gasto}' limit 1)`,
    )
    expect(rows[0].n).toBe(0)
  })
})

describe('el mensaje ve lo mismo que la guarda', () => {
  beforeEach(async () => {
    db = await createSettlementGuardDb()
  })

  it('nombra la liquidación ajena que bloquea, con su estado y quién la registró', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, {
      date: LIQUIDACION,
      status: 'pending_receipt',
      payer: U_OTHER,
    })

    await actAs(db, U_PAYER)
    const { rows } = await db.query<{ id: string; status: string; payer_id: string }>(
      `select * from public.settlements_blocking_movement('${gasto}')`,
    )
    expect(rows).toEqual([
      { id: liquidacion, status: 'pending_receipt', payer_id: U_OTHER },
    ])
  })

  it('no le contesta a quien no ve el movimiento', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, AJENO)
    const { rows } = await db.query(`select * from public.settlements_blocking_movement('${gasto}')`)
    expect(rows).toHaveLength(0)
  })

  it('no nombra nada sobre un movimiento personal', async () => {
    await actAsAdmin(db)
    const { rows: mov } = await db.query<{ id: string }>(
      `insert into public.transactions (user_id, date) values ('${U_PAYER}', '${GASTO}')
       returning id`,
    )
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    const { rows } = await db.query(
      `select * from public.settlements_blocking_movement('${mov[0].id}')`,
    )
    expect(rows).toHaveLength(0)
  })
})

describe('sin 0073 — el defecto que esta migración repara', () => {
  it('desvincular pasaba aunque la liquidación ajena estuviera vigente', async () => {
    db = await createSettlementGuardDb({ upTo: '0072' })
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', payer: U_OTHER })

    await actAs(db, U_PAYER)
    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  }, 30_000)
})
