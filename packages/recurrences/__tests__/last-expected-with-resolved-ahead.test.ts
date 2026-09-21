import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getRecurrences } from '../src/queries'
import { actAs, actAsAdmin, createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * GASTAR UNA POSICIÓN ANTES DE TIEMPO NO ACORTA EL PLAN.
 *
 * Encontrado en el QA del 21-09: una regla de tres vencimientos decía «Último
 * vencimiento previsto: 20 de diciembre» y, después de resolver el primero por
 * anticipado, pasó a decir **20 de noviembre** — contradiciendo a la fila de al
 * lado, que seguía diciendo «restan 2».
 *
 * La causa es el único caso donde «gastada» y «todavía por delante en el
 * calendario» se superponen: una ocurrencia resuelta ANTES de su fecha.
 * `recurrence_positions_spent` la suma, y el caminante que proyecta el final la
 * vuelve a producir, así que se cuenta dos veces.
 *
 * La regla vive en `@grana/money-logic` y tiene su test de tabla ahí. Este va
 * por la LECTURA QUE SE DESPACHA, contra un Postgres real, porque lo que falló
 * no fue la regla sino el dato que nunca llegó hasta ella: `getRecurrences`
 * tenía las fechas y no sabía cuáles estaban resueltas.
 */

const RULE = '00000000-0000-4000-8000-00000000e301'

let db: PGlite
let supabase: ReturnType<typeof pglitePostgrest>
let positions: string[]

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  supabase = pglitePostgrest(db, U_A)

  // El 10 del mes que viene y los dos siguientes: tres posiciones, todas en el
  // futuro. El día 10 evita los meses cortos, que no son lo que se está probando.
  const { rows } = await db.query<{ p1: string; p2: string; p3: string }>(`
    with hoy as (
      select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d
    )
    select (date_trunc('month', d) + interval '1 month' + interval '9 days')::date::text as p1,
           (date_trunc('month', d) + interval '2 month' + interval '9 days')::date::text as p2,
           (date_trunc('month', d) + interval '3 month' + interval '9 days')::date::text as p3
      from hoy
  `)
  positions = [rows[0].p1, rows[0].p2, rows[0].p3]

  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${RULE}', '${U_A}', '${positions[0]}', 1, 'month', 'active', 1000, 'ARS',
            'expense', 3);
  `)
}, 120_000)

beforeEach(async () => {
  await actAs(db, U_A)
})

afterAll(async () => {
  await db?.close()
})

const rule = async () => {
  const rules = await getRecurrences(supabase, { statuses: ['active', 'paused'] })
  return rules.find((r) => r.id === RULE)
}

/** Resolver por anticipado: la ocurrencia se escribe YA resuelta, con su vencimiento real. */
const resolveAhead = async (dueDate: string) => {
  await actAsAdmin(db)
  await db.exec(`
    insert into public.recurrence_instances
      (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at,
       confirmed_transaction_id, resolution_kind, amount, currency_code)
    values ('${RULE}', '${U_A}', '${dueDate}', '${dueDate}', 'confirmed', now(),
            gen_random_uuid(), 'created', 1000, 'ARS');
  `)
  await actAs(db, U_A)
}

describe('el plan de una regla con límite', () => {
  it('proyecta las tres posiciones antes de gastar ninguna', async () => {
    const r = await rule()
    expect(r?.positions_spent).toBe(0)
    expect(r?.last_expected_occurrence).toEqual({ kind: 'date', date: positions[2] })
  })

  it('conserva el mismo final después de resolver la primera por anticipado', async () => {
    await resolveAhead(positions[0])

    const r = await rule()
    // Gastada: el conteo normativo la suma aunque su fecha no haya llegado.
    expect(r?.positions_spent).toBe(1)
    expect(r?.lifecycle.progress).toMatchObject({ spent: 1, total: 3, remaining: 2 })
    // Y el plan sigue terminando donde terminaba. Sin el arreglo, acá aparece la
    // SEGUNDA posición: el caminante vuelve a contar la que ya se gastó.
    expect(r?.last_expected_occurrence).toEqual({ kind: 'date', date: positions[2] })
  })

  it('la próxima es la segunda, no la que ya se resolvió', async () => {
    const r = await rule()
    expect(r?.next_occurrence).toBe(positions[1])
  })

  it('resolver la ÚLTIMA por anticipado no adelanta el final', async () => {
    // Fuera de orden: queda la del medio sin resolver y la última ya resuelta.
    // Lo único que queda por venir es la segunda, pero el plan sigue terminando
    // en la tercera.
    await resolveAhead(positions[2])

    const r = await rule()
    expect(r?.positions_spent).toBe(2)
    expect(r?.lifecycle.progress).toMatchObject({ spent: 2, total: 3, remaining: 1 })
    expect(r?.last_expected_occurrence).toEqual({ kind: 'date', date: positions[2] })
  })

  it('con la del medio sin resolver y por venir, la regla NO está finalizada', async () => {
    // Las tres posiciones existen ya: la primera y la última resueltas por
    // anticipado, y la del medio materializada sin resolver. El calendario no
    // va a producir nada nuevo —por eso la regla se mostraba «Finalizada»— pero
    // a esa regla le queda un vencimiento por delante, en noviembre.
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, amount, currency_code)
      values ('${RULE}', '${U_A}', '${positions[1]}', '${positions[1]}', 'pending', 1000, 'ARS');
    `)
    await actAs(db, U_A)

    const r = await rule()
    expect(r?.next_occurrence).toBeNull()
    expect(r?.lifecycle.unresolved).toBe(1)
    expect(r?.lifecycle.state).toBe('active')
  })
})
