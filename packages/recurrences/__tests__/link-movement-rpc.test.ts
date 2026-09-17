import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  U_A,
  U_B,
} from './support/recurrence-identity-db'

/**
 * Los tres RPC de 0072, contra un Postgres real y con las restricciones de 0064
 * puestas: el CHECK de resolución, el trigger de compatibilidad —que pone
 * `created` a toda confirmación que no declare otra cosa— y la inmutabilidad del
 * vencimiento.
 *
 * El recorrido completo que se ejercita acá: vincular → convertir a compartido →
 * liquidar → cancelar o revertir → desvincular.
 */

const HOGAR = '00000000-0000-0000-0000-00000000c001'
const REGLA = '00000000-0000-4000-8000-00000000e001'
const VENCE = '2026-09-23'

let db: PGlite

beforeEach(async () => {
  db = await createRecurrenceIdentityDb()
})

afterEach(async () => {
  await db?.close()
})

const sqlstateOf = async (fn: () => Promise<unknown>): Promise<string | null> => {
  try {
    await fn()
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

const makeRule = async (opts: { shared?: boolean; amount?: number } = {}) => {
  const split = opts.shared
    ? `'[{"user_id":"${U_A}","percentage":50},{"user_id":"${U_B}","percentage":50}]'::jsonb`
    : 'null'
  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, household_id, default_split)
    values ('${REGLA}', '${U_A}', '${VENCE}', 1, 'month', 'active',
            ${opts.amount ?? 1000}, 'ARS', 'expense',
            ${opts.shared ? `'${HOGAR}'` : 'null'}, ${split});
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
  `)
}

const makeMovement = async (opts: {
  date: string
  amount?: number
  type?: string
  currency?: string
  shared?: boolean
  household?: string
  splitOther?: string
}): Promise<string> => {
  const { rows } = await db.query<{ id: string }>(`
    insert into public.transactions
      (user_id, date, amount, type, currency_code, is_shared, household_id)
    values ('${U_A}', '${opts.date}', ${opts.amount ?? 1000}, '${opts.type ?? 'expense'}',
            '${opts.currency ?? 'ARS'}', ${opts.shared ? 'true' : 'false'},
            ${opts.shared ? `'${opts.household ?? HOGAR}'` : 'null'})
    returning id
  `)
  const id = rows[0].id
  if (opts.shared) {
    for (const [u, pct] of [
      [U_A, 50],
      [opts.splitOther ?? U_B, 50],
    ] as const) {
      await db.exec(`
        insert into public.shared_expense_split
          (transaction_id, household_id, user_id, percentage, amount_assigned)
        values ('${id}', '${opts.household ?? HOGAR}', '${u}', ${pct},
                ${((opts.amount ?? 1000) * (pct as number)) / 100});
      `)
    }
  }
  return id
}

const candidates = async (widen = false) => {
  await actAs(db, U_A)
  const { rows } = await db.query<{ id: string; needs_conversion: boolean }>(
    `select id, needs_conversion from public.recurrence_link_candidates(
       '${REGLA}'::uuid, '${VENCE}'::date, ${widen})`,
  )
  return rows
}

const link = async (txId: string, confirmConversion = false) => {
  await actAs(db, U_A)
  const { rows } = await db.query<{ id: string }>(
    `select public.recurrence_link_movement('${REGLA}'::uuid, '${VENCE}'::date,
       '${txId}'::uuid, ${confirmConversion}) as id`,
  )
  return rows[0].id
}

const unlink = async (instanceId: string) => {
  await actAs(db, U_A)
  await db.exec(`select public.recurrence_unlink_movement('${instanceId}'::uuid);`)
}

const instanceRow = async (id: string) => {
  const { rows } = await db.query<{
    status: string
    resolution_kind: string | null
    linked_conversion: boolean
    confirmed_transaction_id: string | null
    due_date: string
  }>(
    `select status, resolution_kind, linked_conversion, confirmed_transaction_id,
            due_date::text from public.recurrence_instances where id = '${id}'`,
  )
  return rows[0]
}

const movementRow = async (id: string) => {
  const { rows } = await db.query<{ is_shared: boolean; household_id: string | null; splits: number }>(
    `select t.is_shared, t.household_id,
            (select count(*)::int from public.shared_expense_split s
              where s.transaction_id = t.id) as splits
       from public.transactions t where t.id = '${id}'`,
  )
  return rows[0]
}

// ── Candidatos ───────────────────────────────────────────────────────────────

describe('recurrence_link_candidates', () => {
  it('ofrece un pago hecho veinte días antes del vencimiento', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    expect((await candidates()).map((r) => r.id)).toContain(tx)
  })

  it('no esconde un movimiento cuyo importe cambió', async () => {
    await makeRule({ amount: 450000 })
    const tx = await makeMovement({ date: '2026-09-03', amount: 610000 })
    expect((await candidates()).map((r) => r.id)).toContain(tx)
  })

  it('deja fuera lo que cae más allá de la ventana, y ampliar lo trae', async () => {
    await makeRule()
    const lejos = await makeMovement({ date: '2026-07-01' })
    expect((await candidates()).map((r) => r.id)).not.toContain(lejos)
    expect((await candidates(true)).map((r) => r.id)).toContain(lejos)
  })

  it('no ofrece un movimiento ya vinculado a otra ocurrencia', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    await link(tx)
    expect((await candidates()).map((r) => r.id)).not.toContain(tx)
  })

  it('no ofrece un ingreso para una regla de gasto', async () => {
    await makeRule()
    const ingreso = await makeMovement({ date: '2026-09-03', type: 'income' })
    expect((await candidates()).map((r) => r.id)).not.toContain(ingreso)
  })

  it('no ofrece otra moneda', async () => {
    await makeRule()
    const usd = await makeMovement({ date: '2026-09-03', currency: 'USD' })
    expect((await candidates()).map((r) => r.id)).not.toContain(usd)
  })

  it('ordena por proximidad: misma cuenta, después importe, después fecha', async () => {
    await makeRule({ amount: 1000 })
    const lejano = await makeMovement({ date: '2026-09-01', amount: 9999 })
    const cercano = await makeMovement({ date: '2026-09-20', amount: 1000 })
    expect((await candidates()).map((r) => r.id)[0]).toBe(cercano)
    expect((await candidates()).map((r) => r.id)).toContain(lejano)
  })

  it('marca cuál necesitaría conversión a compartido', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const compartido = await makeMovement({ date: '2026-09-04', shared: true })
    const rows = await candidates()
    expect(rows.find((r) => r.id === personal)?.needs_conversion).toBe(true)
    expect(rows.find((r) => r.id === compartido)?.needs_conversion).toBe(false)
  })

  it('no ofrece un movimiento compartido con otro reparto', async () => {
    await makeRule({ shared: true })
    const otroReparto = await makeMovement({
      date: '2026-09-03',
      shared: true,
      splitOther: '00000000-0000-0000-0000-0000000000c3',
    })
    expect((await candidates()).map((r) => r.id)).not.toContain(otroReparto)
  })
})

// ── Vincular ─────────────────────────────────────────────────────────────────

describe('recurrence_link_movement', () => {
  it('resuelve el vencimiento sin crear ningún movimiento', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    const { rows: before } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.transactions',
    )
    const instance = await link(tx)
    const { rows: after } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.transactions',
    )

    expect(after[0].n).toBe(before[0].n)
    const row = await instanceRow(instance)
    expect(row.status).toBe('confirmed')
    expect(row.confirmed_transaction_id).toBe(tx)
    expect(row.due_date).toBe(VENCE)
  })

  it('marca la resolución como vinculada, no como originada', async () => {
    // El trigger de compatibilidad de 0064 pone 'created' a toda confirmación que
    // no declare otra cosa; si el RPC no lo escribiera explícito, desvincular
    // terminaría borrando un movimiento que la recurrencia nunca creó.
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    expect((await instanceRow(await link(tx))).resolution_kind).toBe('linked')
  })

  it('un movimiento no puede resolver dos vencimientos', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    await link(tx)
    expect(await sqlstateOf(() => link(tx))).toBe('GRN12')
  })

  it('rechaza un movimiento de otro tipo', async () => {
    await makeRule()
    const ingreso = await makeMovement({ date: '2026-09-03', type: 'income' })
    expect(await sqlstateOf(() => link(ingreso))).toBe('GRN11')
  })

  it('reusa la ocurrencia pendiente si ya estaba materializada', async () => {
    await makeRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, due_date, scheduled_date, status, amount, currency_code)
      values ('${REGLA}', '${U_A}', '${VENCE}', '${VENCE}', 'pending', 1000, 'ARS');
    `)
    const tx = await makeMovement({ date: '2026-09-03' })
    await link(tx)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${REGLA}'`,
    )
    expect(rows[0].n).toBe(1)
  })
})

// ── Compartido ───────────────────────────────────────────────────────────────

describe('vincular a una regla compartida', () => {
  it('no convierte sin confirmación explícita', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })

    expect(await sqlstateOf(() => link(personal))).toBe('GRN14')
    expect((await movementRow(personal)).is_shared).toBe(false)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${REGLA}'`,
    )
    expect(rows[0].n).toBe(0)
  })

  it('con confirmación, convierte y vincula en la misma operación', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const instance = await link(personal, true)

    const mov = await movementRow(personal)
    expect(mov.is_shared).toBe(true)
    expect(mov.splits).toBe(2)
    expect((await instanceRow(instance)).linked_conversion).toBe(true)
  })

  it('los splits suman exactamente el total del movimiento', async () => {
    // Si no dan el total exacto, el invariante diferido rechaza el commit.
    await makeRule({ shared: true, amount: 1000 })
    const personal = await makeMovement({ date: '2026-09-03', amount: 1000.01 })
    await link(personal, true)
    const { rows } = await db.query<{ suma: string }>(
      `select sum(amount_assigned)::text as suma from public.shared_expense_split
        where transaction_id = '${personal}'`,
    )
    expect(Number(rows[0].suma)).toBe(1000.01)
  })

  it('un reparto compatible se vincula sin tocar el reparto', async () => {
    await makeRule({ shared: true })
    const compartido = await makeMovement({ date: '2026-09-03', shared: true })
    const instance = await link(compartido)
    expect((await instanceRow(instance)).linked_conversion).toBe(false)
    expect((await movementRow(compartido)).splits).toBe(2)
  })

  it('rechaza un movimiento compartido con otro reparto', async () => {
    await makeRule({ shared: true })
    const otro = await makeMovement({
      date: '2026-09-03',
      shared: true,
      splitOther: '00000000-0000-0000-0000-0000000000c3',
    })
    expect(await sqlstateOf(() => link(otro))).toBe('GRN13')
  })
})

// ── Desvincular ──────────────────────────────────────────────────────────────

describe('recurrence_unlink_movement', () => {
  it('conserva el movimiento y devuelve el vencimiento a por revisar', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    const instance = await link(tx)
    await unlink(instance)

    const row = await instanceRow(instance)
    expect(row.status).toBe('pending')
    expect(row.resolution_kind).toBeNull()
    expect(row.confirmed_transaction_id).toBeNull()
    expect(row.due_date).toBe(VENCE)

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.transactions where id = '${tx}'`,
    )
    expect(rows[0].n).toBe(1)
  })

  it('no se ofrece sobre un pago que creó la recurrencia', async () => {
    await makeRule()
    const tx = await makeMovement({ date: '2026-09-03' })
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, due_date, scheduled_date, status, resolved_at,
         confirmed_transaction_id, resolution_kind, amount, currency_code)
      values ('${REGLA}', '${U_A}', '${VENCE}', '${VENCE}', 'confirmed', now(),
              '${tx}', 'created', 1000, 'ARS');
    `)
    const { rows } = await db.query<{ id: string }>(
      `select id from public.recurrence_instances where recurrence_id = '${REGLA}'`,
    )
    expect(await sqlstateOf(() => unlink(rows[0].id))).toBe('GRN15')
  })

  it('revierte la conversión a compartido', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const instance = await link(personal, true)
    await unlink(instance)

    const mov = await movementRow(personal)
    expect(mov.is_shared).toBe(false)
    expect(mov.household_id).toBeNull()
    expect(mov.splits).toBe(0)
  })

  it('no toca el reparto de un movimiento que ya era compartido', async () => {
    await makeRule({ shared: true })
    const compartido = await makeMovement({ date: '2026-09-03', shared: true })
    const instance = await link(compartido)
    await unlink(instance)

    const mov = await movementRow(compartido)
    expect(mov.is_shared).toBe(true)
    expect(mov.splits).toBe(2)
  })

  it('un vencimiento desvinculado se puede volver a resolver', async () => {
    await makeRule()
    const primero = await makeMovement({ date: '2026-09-03' })
    const otro = await makeMovement({ date: '2026-09-04' })
    const instance = await link(primero)
    await unlink(instance)
    await link(otro)

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${REGLA}'`,
    )
    // La regla no gana ningún vencimiento adicional.
    expect(rows[0].n).toBe(1)
  })
})

// ── El recorrido completo, con liquidación de por medio ──────────────────────

describe('liquidar, revertir o cancelar, y desvincular', () => {
  const liquidar = async (status: 'pending_receipt' | 'completed', date = '2026-09-25') => {
    const { rows: leg } = await db.query<{ id: string }>(
      `insert into public.transactions (user_id, date, type)
       values ('${U_A}', '${date}', 'settlement') returning id`,
    )
    const { rows } = await db.query<{ id: string }>(
      `insert into public.settlement
         (household_id, payer_id, receiver_id, payer_movement_id, status, currency_code)
       values ('${HOGAR}', '${U_A}', '${U_B}', '${leg[0].id}', '${status}', 'ARS')
       returning id`,
    )
    return rows[0].id
  }

  it('una liquidación vigente conserva el estado anterior POR COMPLETO', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const instance = await link(personal, true)
    await liquidar('completed')

    expect(await sqlstateOf(() => unlink(instance))).toBe('GRN01')

    // Ni el vínculo suelto ni el gasto descompartido: el deshacer parcial es
    // exactamente lo que esto prohíbe.
    const row = await instanceRow(instance)
    expect(row.status).toBe('confirmed')
    expect(row.confirmed_transaction_id).toBe(personal)
    const mov = await movementRow(personal)
    expect(mov.is_shared).toBe(true)
    expect(mov.splits).toBe(2)
  })

  it('revertir una liquidación completada destraba la desvinculación', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const instance = await link(personal, true)
    const liquidacion = await liquidar('completed')
    expect(await sqlstateOf(() => unlink(instance))).toBe('GRN01')

    // Lo que hace reverse_settlement (0044): conserva la original y agrega el
    // contraasiento, fechado el día de la reversión. Corre como operación
    // privilegiada porque la pata del contraasiento es un movimiento del OTRO
    // miembro, y RLS no deja que un usuario escriba filas ajenas — es la misma
    // razón por la que la reversión real es SECURITY DEFINER.
    await actAsAdmin(db)
    const { rows: leg } = await db.query<{ id: string }>(
      `insert into public.transactions (user_id, date, type)
       values ('${U_B}', '2026-10-01', 'settlement') returning id`,
    )
    await db.exec(`
      update public.settlement set status = 'reversed', reversed_at = now()
       where id = '${liquidacion}';
      insert into public.settlement
        (household_id, payer_id, receiver_id, payer_movement_id, status, reverses_settlement_id)
      values ('${HOGAR}', '${U_B}', '${U_A}', '${leg[0].id}', 'contra', '${liquidacion}');
    `)

    await unlink(instance)
    expect((await instanceRow(instance)).status).toBe('pending')
    expect((await movementRow(personal)).is_shared).toBe(false)
  })

  it('cancelar una liquidación pendiente destraba la desvinculación', async () => {
    await makeRule({ shared: true })
    const personal = await makeMovement({ date: '2026-09-03' })
    const instance = await link(personal, true)
    const liquidacion = await liquidar('pending_receipt')
    expect(await sqlstateOf(() => unlink(instance))).toBe('GRN01')

    // Cancelar: sólo existe la pata del pagador, y borrarla retira la fila.
    await db.exec(`delete from public.settlement where id = '${liquidacion}';`)

    await unlink(instance)
    expect((await instanceRow(instance)).status).toBe('pending')
    expect((await movementRow(personal)).is_shared).toBe(false)
  })
})

// ── El self-check de la migración ────────────────────────────────────────────

describe('self-check de 0072', () => {
  it('rechaza la migración si le falta una de las funciones nuevas', async () => {
    const { MIGRATION_0072 } = await import('./support/recurrence-identity-db')
    const { PGlite } = await import('@electric-sql/pglite')

    // Se le saca `recurrence_unlink_movement` y nada más. Sin el self-check la
    // migración aplicaría igual y el fallo aparecería recién cuando un usuario
    // apretara «Desvincular».
    const mutilada = MIGRATION_0072.replace(
      /create or replace function public\.recurrence_unlink_movement[\s\S]*?\nend \$\$;/,
      '',
    )
    expect(mutilada).not.toEqual(MIGRATION_0072)

    const fresh = new PGlite()
    await fresh.exec('create schema if not exists public;')
    // No hace falta el esquema entero: el self-check corre antes del COMMIT y
    // esto falla en él, que es lo que se está verificando.
    await expect(fresh.exec(mutilada)).rejects.toThrow()
    await fresh.close()
  })
})
