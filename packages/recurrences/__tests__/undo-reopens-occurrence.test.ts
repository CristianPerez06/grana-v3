import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  applyActivation,
  createRecurrenceIdentityDb,
  U_A,
  U_B,
} from './support/recurrence-identity-db'

/**
 * Borrar el movimiento que resuelve una ocurrencia (#104), y la vuelta a revisión
 * con los datos de la regla (#186). 0075 contra un Postgres real.
 *
 * Dos piezas del schema real que el arnés compartido no trae y que son
 * exactamente las que producen #104, así que se cuelgan acá:
 *
 *   · la FK `confirmed_transaction_id → transactions ON DELETE SET NULL` de 0011.
 *     El arnés la omite porque `seedInstance` inventa ids de movimiento; sin ella,
 *     el DELETE no tiene nada que poner en NULL y el defecto no existe.
 *   · el trigger de borrado de la guarda de liquidaciones (0049/0072). El arnés
 *     cuelga sólo el de descompartir.
 *
 * Con la activación (0066) aplicada, como en producción: con el índice de «una
 * pendiente por regla» en pie, reabrir una ocurrencia chocaría con otra pendiente
 * por una regla que ya no rige.
 */

const HOGAR = '00000000-0000-0000-0000-00000000c001'
const REGLA = '00000000-0000-4000-8000-00000000e001'
const BILLETERA = '00000000-0000-4000-8000-0000000a0001'
const VISA = '00000000-0000-4000-8000-0000000a0002'
const CINE = '00000000-0000-4000-8000-0000000c0001'
const COMIDA = '00000000-0000-4000-8000-0000000c0002'
const VENCE = '2026-09-23'
const HOY = '2026-10-08'

let db: PGlite

const hangSchemaPieces = async (database: PGlite) => {
  await database.exec(`
    alter table public.recurrence_instances
      add constraint recurrence_instances_confirmed_transaction_id_fkey
      foreign key (confirmed_transaction_id)
      references public.transactions(id) on delete set null;

    drop trigger if exists trg_block_shared_delete_with_settlement on public.transactions;
    create trigger trg_block_shared_delete_with_settlement
      before delete on public.transactions
      for each row
      execute function public.trg_fn_block_shared_delete_with_settlement();

    insert into public.accounts (id, user_id, name, type) values
      ('${BILLETERA}', '${U_A}', 'Billetera', 'cash'),
      ('${VISA}', '${U_A}', 'Visa Galicia', 'credit');
    insert into public.categories (id, user_id, name) values
      ('${CINE}', '${U_A}', 'Entretenimiento'),
      ('${COMIDA}', '${U_A}', 'Comida');
  `)
}

const build = async (options: { undoMigration?: boolean } = {}) => {
  const database = await createRecurrenceIdentityDb({ undoReopens: options.undoMigration })
  await applyActivation(database)
  await hangSchemaPieces(database)
  return database
}

beforeEach(async () => {
  db = await build()
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

/** «Prueba recurr»: $500 en Billetera, Entretenimiento. Mensual desde VENCE. */
const makeRule = async (
  opts: { shared?: boolean; maxOccurrences?: number | null; status?: string; anchor?: string } = {},
) => {
  const anchor = opts.anchor ?? VENCE
  const split = opts.shared
    ? `'[{"user_id":"${U_A}","percentage":50},{"user_id":"${U_B}","percentage":50}]'::jsonb`
    : 'null'
  await actAsAdmin(db)
  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, description,
       account_id, category_id, currency_code, movement_type, household_id, default_split,
       max_occurrences, schedule_effective_from)
    values ('${REGLA}', '${U_A}', '${anchor}', 1, 'month', '${opts.status ?? 'active'}', 500,
            'Prueba recurr', '${BILLETERA}', '${CINE}', 'ARS', 'expense',
            ${opts.shared ? `'${HOGAR}'` : 'null'}, ${split},
            ${opts.maxOccurrences == null ? 'null' : opts.maxOccurrences}, '${anchor}');
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
       anchor_date, is_assumed)
    values ('${REGLA}', '${U_A}', '${anchor}', null, 1, 'month', '${anchor}', false);
  `)
}

/** «Comida»: $3.333,33 en Visa Galicia. */
const makeMovement = async (opts: { date?: string; shared?: boolean } = {}): Promise<string> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ id: string }>(`
    insert into public.transactions
      (user_id, date, amount, type, currency_code, account_id, category_id, description,
       is_shared, household_id)
    values ('${U_A}', '${opts.date ?? '2026-09-03'}', 3333.33, 'expense', 'ARS', '${VISA}',
            '${COMIDA}', 'Comida', ${opts.shared ? 'true' : 'false'},
            ${opts.shared ? `'${HOGAR}'` : 'null'})
    returning id
  `)
  const id = rows[0].id
  if (opts.shared) {
    for (const u of [U_A, U_B]) {
      await db.exec(`
        insert into public.shared_expense_split
          (transaction_id, household_id, user_id, percentage, amount_assigned)
        values ('${id}', '${HOGAR}', '${u}', 50, 1666.665);
      `)
    }
  }
  return id
}

/**
 * Una ocurrencia resuelta REGISTRANDO, con la foto del movimiento — lo que deja
 * `confirmRecurrenceInstance` / `registerRecurrenceAhead`. `due` en null es un
 * pago anterior a 0064: vencimiento desconocido.
 */
const resolveCreated = async (txId: string, due: string | null = VENCE): Promise<string> => {
  await actAsAdmin(db)
  // Una fila histórica no se puede escribir con el trigger de compatibilidad
  // prendido: en un INSERT sin `due_date` lo deriva de `scheduled_date`. Se
  // apaga sólo para sembrarla, como la dejó el backfill de 0064.
  if (due == null) {
    await db.exec(
      'alter table public.recurrence_instances disable trigger trg_recurrence_instance_compat;',
    )
  }
  const { rows } = await db.query<{ id: string }>(`
    insert into public.recurrence_instances
      (recurrence_id, user_id, due_date, due_date_is_unknown, scheduled_date, status,
       resolved_at, confirmed_transaction_id, resolution_kind, amount, account_id,
       category_id, description, currency_code)
    values ('${REGLA}', '${U_A}', ${due == null ? 'null' : `'${due}'`}, ${due == null},
            '${due ?? '2026-08-23'}', 'confirmed', now(), '${txId}', 'created', 3333.33,
            '${VISA}', '${COMIDA}', 'Comida', 'ARS')
    returning id
  `)
  if (due == null) {
    await db.exec(
      'alter table public.recurrence_instances enable trigger trg_recurrence_instance_compat;',
    )
  }
  return rows[0].id
}

const resolveLinked = async (txId: string, due = VENCE, confirmConversion = false) => {
  await actAs(db, U_A)
  const { rows } = await db.query<{ id: string }>(
    `select public.recurrence_link_movement('${REGLA}'::uuid, '${due}'::date,
       '${txId}'::uuid, ${confirmConversion}) as id`,
  )
  return rows[0].id
}

const deleteMovement = async (txId: string) => {
  await actAs(db, U_A)
  await db.exec(`delete from public.transactions where id = '${txId}';`)
}

const instanceRow = async (id: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{
    status: string
    resolution_kind: string | null
    confirmed_transaction_id: string | null
    resolved_at: string | null
    due_date: string | null
    amount: string
    account_id: string | null
    category_id: string | null
    description: string | null
  }>(
    `select status, resolution_kind, confirmed_transaction_id, resolved_at::text,
            due_date::text, amount::text, account_id, category_id, description
       from public.recurrence_instances where id = '${id}'`,
  )
  return rows[0]
}

const movementExists = async (id: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.transactions where id = '${id}'`,
  )
  return rows[0].n === 1
}

const expectReopenedWithRuleData = async (instanceId: string, due = VENCE) => {
  const row = await instanceRow(instanceId)
  expect(row.status).toBe('pending')
  expect(row.resolution_kind).toBeNull()
  expect(row.confirmed_transaction_id).toBeNull()
  expect(row.resolved_at).toBeNull()
  expect(row.due_date).toBe(due)
  expect(row.amount).toBe('500.00')
  expect(row.account_id).toBe(BILLETERA)
  expect(row.category_id).toBe(CINE)
  expect(row.description).toBe('Prueba recurr')
}

const positionsSpent = async (today = HOY) => {
  await actAs(db, U_A)
  const { rows } = await db.query<{ n: number }>(
    `select public.recurrence_positions_spent('${REGLA}'::uuid, '${today}'::date) as n`,
  )
  return rows[0].n
}

// ── #104: el defecto, tal como existía ───────────────────────────────────────

describe('sin 0075', () => {
  it('borrar un pago registrado falla con el CHECK (23514)', async () => {
    await db.close()
    db = await build({ undoMigration: false })
    await makeRule()
    const tx = await makeMovement()
    await resolveCreated(tx)
    expect(await sqlstateOf(() => deleteMovement(tx))).toBe('23514')
  })

  it('borrar un movimiento vinculado falla igual', async () => {
    await db.close()
    db = await build({ undoMigration: false })
    await makeRule()
    const tx = await makeMovement()
    await resolveLinked(tx)
    expect(await sqlstateOf(() => deleteMovement(tx))).toBe('23514')
  })
})

// ── Borrar el movimiento devuelve el vencimiento a revisión ───────────────────

describe('borrar el movimiento que resuelve una ocurrencia', () => {
  it('un pago registrado vuelve a por revisar con los datos de la regla, no omitido', async () => {
    await makeRule()
    const tx = await makeMovement()
    const instance = await resolveCreated(tx)

    await deleteMovement(tx)

    expect(await movementExists(tx)).toBe(false)
    await expectReopenedWithRuleData(instance)
  })

  it('un movimiento vinculado vuelve a por revisar con los datos de la regla', async () => {
    await makeRule()
    const tx = await makeMovement()
    const instance = await resolveLinked(tx)

    await deleteMovement(tx)

    expect(await movementExists(tx)).toBe(false)
    await expectReopenedWithRuleData(instance)
  })

  it('un pago anterior a 0064 (vencimiento desconocido) sale del historial', async () => {
    await makeRule()
    const tx = await makeMovement()
    const instance = await resolveCreated(tx, null)

    await deleteMovement(tx)

    expect(await movementExists(tx)).toBe(false)
    expect(await instanceRow(instance)).toBeUndefined()
  })

  it('una regla eliminada: la ocurrencia sale del historial', async () => {
    await makeRule({ status: 'deleted' })
    const tx = await makeMovement()
    const instance = await resolveCreated(tx)

    await deleteMovement(tx)

    expect(await movementExists(tx)).toBe(false)
    expect(await instanceRow(instance)).toBeUndefined()
  })

  it('una regla pausada reabre igual', async () => {
    await makeRule({ status: 'paused' })
    const tx = await makeMovement()
    const instance = await resolveCreated(tx)

    await deleteMovement(tx)

    await expectReopenedWithRuleData(instance)
  })

  it('un borrado sin vínculo con recurrencias no cambia nada', async () => {
    await makeRule()
    const suelto = await makeMovement()
    await deleteMovement(suelto)
    expect(await movementExists(suelto)).toBe(false)
  })
})

// ── Lo que bloquea: todo o nada ──────────────────────────────────────────────

describe('una liquidación vigente posterior', () => {
  const liquidar = async () => {
    await actAsAdmin(db)
    const { rows: leg } = await db.query<{ id: string }>(
      `insert into public.transactions (user_id, date, type)
       values ('${U_A}', '2026-09-25', 'settlement') returning id`,
    )
    await db.exec(`
      insert into public.settlement
        (household_id, payer_id, receiver_id, payer_movement_id, status, currency_code)
      values ('${HOGAR}', '${U_A}', '${U_B}', '${leg[0].id}', 'completed', 'ARS');
    `)
  }

  it('rechaza con GRN01 y no cambia ni el movimiento ni la ocurrencia', async () => {
    await makeRule({ shared: true })
    const tx = await makeMovement({ shared: true })
    const instance = await resolveCreated(tx)
    await liquidar()

    expect(await sqlstateOf(() => deleteMovement(tx))).toBe('GRN01')

    expect(await movementExists(tx)).toBe(true)
    const row = await instanceRow(instance)
    expect(row.status).toBe('confirmed')
    expect(row.confirmed_transaction_id).toBe(tx)
    expect(row.amount).toBe('3333.33')
  })
})

// ── El límite de vencimientos ────────────────────────────────────────────────

describe('la posición del límite', () => {
  it('un pago anticipado deshecho libera la posición', async () => {
    // Vence el 23/09, 23/10, 23/11. Hoy 08/10: el 23/09 ya llegó.
    await makeRule({ maxOccurrences: 3 })
    const tx = await makeMovement({ date: '2026-10-05' })
    await resolveCreated(tx, '2026-11-23')
    expect(await positionsSpent()).toBe(2)

    await deleteMovement(tx)

    expect(await positionsSpent()).toBe(1)
  })

  it('un pago cuya fecha ya llegó sigue consumiendo la posición', async () => {
    await makeRule({ maxOccurrences: 3 })
    const tx = await makeMovement()
    await resolveCreated(tx, VENCE)
    expect(await positionsSpent()).toBe(1)

    await deleteMovement(tx)

    expect(await positionsSpent()).toBe(1)
  })

  it('deshacer y volver a resolver no agrega vencimientos', async () => {
    await makeRule({ maxOccurrences: 3 })
    const primero = await makeMovement()
    const instance = await resolveLinked(primero)
    await deleteMovement(primero)

    const otro = await makeMovement({ date: '2026-09-04' })
    const again = await resolveLinked(otro)

    expect(again).toBe(instance)
    await actAsAdmin(db)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${REGLA}'`,
    )
    expect(rows[0].n).toBe(1)
    expect(await positionsSpent()).toBe(1)
  })
})

// ── #186: desvincular devuelve los datos de la regla ─────────────────────────

describe('desvincular', () => {
  it('devuelve el vencimiento con nombre, cuenta, categoría e importe de la regla', async () => {
    await makeRule()
    const comida = await makeMovement()
    const instance = await resolveLinked(comida)
    // Vincular deja la foto del movimiento (0074): el historial muestra lo real.
    expect((await instanceRow(instance)).amount).toBe('3333.33')

    await actAs(db, U_A)
    await db.exec(`select public.recurrence_unlink_movement('${instance}'::uuid);`)

    await expectReopenedWithRuleData(instance)
    // El movimiento desvinculado no se toca.
    await actAsAdmin(db)
    const { rows } = await db.query<{ amount: string; description: string }>(
      `select amount::text, description from public.transactions where id = '${comida}'`,
    )
    expect(rows[0]).toEqual({ amount: '3333.33', description: 'Comida' })
  })
})
