import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { occurrencePositionsSpent } from '@grana/money-logic'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'

/**
 * El conteo de posiciones vive en dos implementaciones que TIENEN que coincidir:
 * `recurrence_positions_spent` (la normativa, que además corta la generación) y
 * `occurrencePositionsSpent`. Si divergen, el formulario ofrece una cuota que el
 * servidor no admite, o una regla agotada sigue recordándole plata al usuario.
 *
 * `expected` se saca A MANO del calendario, no de una corrida. La paridad sola no
 * alcanza: dos implementaciones alimentadas con la misma idea equivocada
 * coinciden perfectamente. El número tiene que ser correcto, no sólo compartido.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
})

afterAll(async () => {
  await db.close()
})

// Un plan de tres: 23/09, 23/10 y 23/11 de 2026.
const VERSION = {
  effective_from: '2026-09-23',
  effective_until: null,
  anchor_date: '2026-09-23',
  interval_count: 1,
  interval_unit: 'month' as const,
}

let ruleSeq = 0

type Resolved = { due_date: string; status: 'confirmed' | 'skipped' | 'pending' }

const spentBothWays = async (setup: {
  today: string
  instances?: Resolved[]
  maxOccurrences?: number | null
  seedOccurrenceDate?: string | null
}): Promise<{ ts: number; sql: number }> => {
  const id = `00000000-0000-4000-8000-00000000da${(ruleSeq++).toString(16).padStart(2, '0')}`
  const max = setup.maxOccurrences === undefined ? 3 : setup.maxOccurrences

  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_resolve_schedule_effective_from;
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    alter table public.recurrences disable trigger trg_recurrence_reconstruct_from_guard;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, end_date, max_occurrences, schedule_effective_from, seed_occurrence_date)
    values ('${id}', '${U_A}', '${VERSION.anchor_date}', ${VERSION.interval_count},
            '${VERSION.interval_unit}', 'active', 1000, 'ARS', 'expense', null,
            ${max == null ? 'null' : max}, '${VERSION.effective_from}',
            ${setup.seedOccurrenceDate == null ? 'null' : `'${setup.seedOccurrenceDate}'`});
    alter table public.recurrences enable trigger trg_recurrence_resolve_schedule_effective_from;
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
    alter table public.recurrences enable trigger trg_recurrence_reconstruct_from_guard;
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
       anchor_date, is_assumed)
    values ('${id}', '${U_A}', '${VERSION.effective_from}', null, ${VERSION.interval_count},
            '${VERSION.interval_unit}', '${VERSION.anchor_date}', false);
  `)

  for (const i of setup.instances ?? []) {
    // El CHECK de 0011 exige `resolved_at` en las resueltas y un movimiento en las
    // confirmadas; la fila apunta a un uuid cualquiera porque este test es sobre
    // el conteo, no sobre el movimiento.
    const resolvedAt = i.status === 'pending' ? 'null' : 'now()'
    const txId =
      i.status === 'confirmed' ? `'00000000-0000-4000-8000-0000000000ff'::uuid` : 'null'
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at,
         confirmed_transaction_id, amount, currency_code)
      values ('${id}', '${U_A}', '${i.due_date}', '${i.due_date}', '${i.status}',
              ${resolvedAt}, ${txId}, 1000, 'ARS');
    `)
  }

  const { rows } = await db.query<{ n: number }>(
    `select public.recurrence_positions_spent('${id}'::uuid, '${setup.today}'::date) as n`,
  )

  return {
    ts: occurrencePositionsSpent({
      versions: [VERSION],
      pauses: [],
      endDate: null,
      maxOccurrences: max,
      seedOccurrenceDate: setup.seedOccurrenceDate ?? null,
      today: setup.today,
      resolvedAheadDueDates: (setup.instances ?? [])
        .filter((i) => i.status !== 'pending' && i.due_date > setup.today)
        .map((i) => i.due_date),
    }),
    sql: Number(rows[0].n),
  }
}

const cases: Array<{ name: string; expected: number; setup: Parameters<typeof spentBothWays>[0] }> = [
  {
    name: 'antes del primer vencimiento, sin nada resuelto',
    expected: 0,
    setup: { today: '2026-09-03' },
  },
  {
    name: 'el vencimiento del 23 resuelto el 3',
    expected: 1,
    setup: { today: '2026-09-03', instances: [{ due_date: '2026-09-23', status: 'confirmed' }] },
  },
  {
    name: 'llega el 23 y no se cuenta dos veces',
    expected: 1,
    setup: { today: '2026-09-23', instances: [{ due_date: '2026-09-23', status: 'confirmed' }] },
  },
  {
    name: 'devuelto a revisión el 5, antes del vencimiento: libera la posición',
    expected: 0,
    setup: { today: '2026-09-05', instances: [{ due_date: '2026-09-23', status: 'pending' }] },
  },
  {
    name: 'devuelto a revisión el 25, después del vencimiento: la conserva',
    expected: 1,
    setup: { today: '2026-09-25', instances: [{ due_date: '2026-09-23', status: 'pending' }] },
  },
  {
    name: 'una omitida por anticipado también gasta su posición',
    expected: 1,
    setup: { today: '2026-09-03', instances: [{ due_date: '2026-09-23', status: 'skipped' }] },
  },
  {
    name: 'dos resueltas por anticipado cuentan dos',
    expected: 2,
    setup: {
      today: '2026-09-03',
      instances: [
        { due_date: '2026-09-23', status: 'confirmed' },
        { due_date: '2026-10-23', status: 'confirmed' },
      ],
    },
  },
  {
    name: 'no supera el tope',
    expected: 3,
    setup: {
      today: '2026-09-03',
      instances: [
        { due_date: '2026-09-23', status: 'confirmed' },
        { due_date: '2026-10-23', status: 'confirmed' },
        { due_date: '2026-11-23', status: 'confirmed' },
        { due_date: '2026-12-23', status: 'confirmed' },
      ],
    },
  },
  {
    name: 'la semilla no se cuenta dos veces',
    expected: 1,
    setup: {
      today: '2026-09-03',
      seedOccurrenceDate: '2026-09-23',
      instances: [{ due_date: '2026-09-23', status: 'confirmed' }],
    },
  },
  {
    name: 'sin tope, resolver por anticipado sigue contando',
    expected: 1,
    setup: {
      today: '2026-09-03',
      maxOccurrences: null,
      instances: [{ due_date: '2026-09-23', status: 'confirmed' }],
    },
  },
]

describe('recurrence_positions_spent ↔ occurrencePositionsSpent — resolver antes de la fecha', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const { ts, sql } = await spentBothWays(c.setup)
      expect({ ts, sql }).toEqual({ ts: c.expected, sql: c.expected })
    })
  }
})
