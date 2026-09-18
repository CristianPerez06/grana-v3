import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  cancelPendingSettlement,
  createSettlementGuardDb,
  reverseSettlement,
  seedSettlement,
  seedSharedExpense,
  sqlstateOf,
} from './support/settlement-guard-db'

/**
 * SÓLO UNA LIQUIDACIÓN VIGENTE PROTEGE ALGO.
 *
 * Las guardas de 0049 no miraban el estado de la liquidación, y `reverse_settlement`
 * conserva la original y agrega un contraasiento fechado el día de la reversión.
 * El resultado es que revertir no destrababa nada y encima agregaba un bloqueo
 * más nuevo que cualquier gasto del pasado — al usuario se le pedía hacer algo
 * irreversible que lo dejaba igual de trabado, o peor.
 *
 * `GASTO` cae el 10/09; las liquidaciones se fechan el 20/09, posteriores a él.
 */

const GASTO = '2026-09-10'
const LIQUIDACION = '2026-09-20'
const HOY = '2026-10-01'
/** For the one case that boots Postgres in its body. */
const BOOTS_POSTGRES = 30_000

let db: PGlite

afterEach(async () => {
  await db?.close()
})

const unshare = (id: string) =>
  `update public.transactions set is_shared = false, household_id = null where id = '${id}';`

describe('guardas de liquidación — qué sigue protegiendo', () => {
  // The boot lives in a HOOK, under `hookTimeout`, and not in the test body:
  // a WASM Postgres takes seconds to come up when the whole monorepo suite is
  // competing for CPU, and the 5s `testTimeout` is not for that. Measured: the
  // first case failed in the full run and passed alone, on the same commit.
  beforeEach(async () => {
    db = await createSettlementGuardDb()
  })

  it('una liquidación completada sigue bloqueando', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })

    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  })

  it('una liquidación pendiente de asignación sigue bloqueando', async () => {
    // La plata ya salió de la cuenta del pagador: que el receptor no haya
    // asignado la suya no la vuelve inofensiva.
    const gasto = await seedSharedExpense(db, { date: GASTO })
    await seedSettlement(db, { date: LIQUIDACION, status: 'pending_receipt' })

    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  })

  it('una liquidación correctamente revertida deja de bloquear', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await reverseSettlement(db, liquidacion, HOY)

    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('el contraasiento no bloquea por su propia fecha', async () => {
    // Es el corazón del defecto: la pata del contraasiento está fechada el día de
    // la reversión, posterior a cualquier gasto del pasado. Si contara, el hogar
    // quedaría trabado para siempre justo después de destrabarse.
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await reverseSettlement(db, liquidacion, HOY)

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.settlement where status = 'contra'`,
    )
    expect(rows[0].n).toBe(1)
    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('revertir una de dos no destraba si la otra sigue vigente', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const primera = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await reverseSettlement(db, primera, HOY)

    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  })

  it('cancelar una pendiente destraba sin depender del predicado', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'pending_receipt' })
    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')

    await cancelPendingSettlement(db, liquidacion)
    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('una `reversed` a la que le falta el contraasiento se sigue protegiendo', async () => {
    // Estado a medio escribir: no se puede afirmar que el par sumó cero, así que
    // la guarda se queda del lado conservador.
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await db.exec(`update public.settlement set status = 'reversed' where id = '${liquidacion}';`)

    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  })

  it('una liquidación en otra moneda sigue sin bloquear', async () => {
    const gasto = await seedSharedExpense(db, { date: GASTO, currency: 'ARS' })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed', currency: 'USD' })

    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('un gasto posterior a toda liquidación sigue sin bloquearse', async () => {
    const gasto = await seedSharedExpense(db, { date: '2026-09-25' })
    await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })

    expect(await sqlstateOf(db, unshare(gasto))).toBeNull()
  })

  it('la guarda de BORRADO comparte el criterio', async () => {
    // El requirement las define juntas: si sólo se corrigiera una, el sistema
    // contestaría distinto a dos preguntas que son la misma.
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })

    const borrar = `delete from public.transactions where id = '${gasto}';`
    expect(await sqlstateOf(db, borrar)).toBe('GRN01')

    await reverseSettlement(db, liquidacion, HOY)
    expect(await sqlstateOf(db, borrar)).toBeNull()
  })
})

describe('sin la corrección — el defecto que 0072 repara', () => {
  // This one boots WITHOUT the fix, so it cannot share the hook above; the
  // boot is in the body and the case gets the time it needs, and nothing else
  // does (the same shape as `migration-0064-phase-guard.test.ts`).
  it('revertir NO destrababa, y encima agregaba un bloqueo más nuevo', async () => {
    db = await createSettlementGuardDb({ applyFix: false })
    const gasto = await seedSharedExpense(db, { date: GASTO })
    const liquidacion = await seedSettlement(db, { date: LIQUIDACION, status: 'completed' })
    await reverseSettlement(db, liquidacion, HOY)

    // Con el predicado viejo el usuario queda trabado después de haber hecho lo
    // único que la app le decía que hiciera.
    expect(await sqlstateOf(db, unshare(gasto))).toBe('GRN01')
  }, BOOTS_POSTGRES)
})
