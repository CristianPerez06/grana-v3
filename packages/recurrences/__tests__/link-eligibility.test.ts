import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * 0076: qué movimiento puede resolver un vencimiento (#190).
 *
 * La lista y vincular comparten UNA definición. Cada caso se mira por los dos
 * lados: que la lista no lo ofrezca —tampoco al ampliar— y que vincular lo
 * rechace con GRN19 sin dejar ocurrencia, porque la lista sola no es defensa.
 */

const REGLA = '00000000-0000-4000-8000-00000000e190'
const VENCE = '2026-09-23'

let db: PGlite

beforeEach(async () => {
  db = await createRecurrenceIdentityDb()
  await actAsAdmin(db)
  // El trigger de sincronización está apagado para que la versión de abajo sea
  // el único calendario de la regla, como en `link-movement-rpc.test.ts`.
  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, schedule_effective_from)
    values ('${REGLA}', '${U_A}', '${VENCE}', 1, 'month', 'active', 1000, 'ARS', 'expense',
            '${VENCE}');
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
       anchor_date, is_assumed)
    values ('${REGLA}', '${U_A}', '${VENCE}', null, 1, 'month', '${VENCE}', false);
  `)
})

afterEach(async () => {
  await db?.close()
})

const movement = async (
  opts: { type?: string; isParent?: boolean; parentId?: string; date?: string } = {},
): Promise<string> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ id: string }>(`
    insert into public.transactions (user_id, date, amount, type, currency_code, is_parent, parent_id)
    values ('${U_A}', '${opts.date ?? VENCE}', 1000, '${opts.type ?? 'expense'}', 'ARS',
            ${opts.isParent ? 'true' : 'false'},
            ${opts.parentId ? `'${opts.parentId}'` : 'null'})
    returning id
  `)
  return rows[0].id
}

const candidates = async (widen = false): Promise<string[]> => {
  await actAs(db, U_A)
  const { rows } = await db.query<{ id: string }>(
    `select id from public.recurrence_link_candidates('${REGLA}'::uuid, '${VENCE}'::date, ${widen})`,
  )
  return rows.map((r) => r.id)
}

const link = async (txId: string) => {
  await actAs(db, U_A)
  await db.query(
    `select public.recurrence_link_movement('${REGLA}'::uuid, '${VENCE}'::date, '${txId}'::uuid, false)`,
  )
}

const sqlstateOf = async (fn: () => Promise<unknown>): Promise<string | null> => {
  try {
    await fn()
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}

const occurrenceCount = async (): Promise<number> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${REGLA}'`,
  )
  return rows[0].n
}

/** Lo que la lista no ofrece y vincular rechaza, sin dejar nada escrito. */
const expectNotLinkable = async (txId: string) => {
  expect(await candidates()).not.toContain(txId)
  expect(await candidates(true)).not.toContain(txId)
  expect(await sqlstateOf(() => link(txId))).toBe('GRN19')
  expect(await occurrenceCount()).toBe(0)
}

describe('recurrence_movement_linkable (0076)', () => {
  it('una compra en cuotas: ni la madre ni sus cuotas', async () => {
    const madre = await movement({ isParent: true })
    const cuota = await movement({ parentId: madre })
    await expectNotLinkable(madre)
    await expectNotLinkable(cuota)
  })

  it('el débito de un pago de resumen y su impuesto de sellos', async () => {
    const debito = await movement()
    const sellos = await movement()
    await actAsAdmin(db)
    await db.exec(`
      insert into public.period_payments (transaction_id, stamp_tax_transaction_id)
      values ('${debito}', '${sellos}');
    `)
    await expectNotLinkable(debito)
    await expectNotLinkable(sellos)
  })

  it('un gasto suelto —como una compra con tarjeta en un pago— sí se ofrece y se vincula', async () => {
    const compra = await movement()
    expect(await candidates()).toContain(compra)
    expect(await sqlstateOf(() => link(compra))).toBeNull()
    expect(await occurrenceCount()).toBe(1)
  })

  it('vincular rechaza una madre de cuotas, que 0072/0074 aceptaban', async () => {
    const madre = await movement({ isParent: true })
    expect(await sqlstateOf(() => link(madre))).toBe('GRN19')
  })

  it('sin 0076 la lista ofrecía la cuota y vincular la aceptaba (#190)', async () => {
    await db.close()
    db = await createRecurrenceIdentityDb({ linkEligibility: false })
    await actAsAdmin(db)
    await db.exec(`
      alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount,
         currency_code, movement_type, schedule_effective_from)
      values ('${REGLA}', '${U_A}', '${VENCE}', 1, 'month', 'active', 1000, 'ARS', 'expense',
              '${VENCE}');
      alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
      insert into public.recurrence_schedule_versions
        (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
         anchor_date, is_assumed)
      values ('${REGLA}', '${U_A}', '${VENCE}', null, 1, 'month', '${VENCE}', false);
    `)
    const madre = await movement({ isParent: true })
    const cuota = await movement({ parentId: madre })
    expect(await candidates()).toContain(cuota)
    expect(await sqlstateOf(() => link(cuota))).toBeNull()
  })

  it('un vínculo previo a una cuota se conserva y se puede desvincular', async () => {
    const madre = await movement({ isParent: true })
    const cuota = await movement({ parentId: madre })
    // Escrito como lo dejó 0074, antes de que existiera la regla.
    await actAsAdmin(db)
    const { rows } = await db.query<{ id: string }>(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, due_date, scheduled_date, status, confirmed_transaction_id,
         resolution_kind, resolved_at, amount, currency_code)
      values ('${REGLA}', '${U_A}', '${VENCE}', '${VENCE}', 'confirmed', '${cuota}',
              'linked', now(), 1000, 'ARS')
      returning id
    `)
    await actAs(db, U_A)
    await db.exec(`select public.recurrence_unlink_movement('${rows[0].id}'::uuid);`)
    await actAsAdmin(db)
    const after = await db.query<{ status: string; confirmed_transaction_id: string | null }>(
      `select status, confirmed_transaction_id from public.recurrence_instances where id = '${rows[0].id}'`,
    )
    expect(after.rows[0]).toEqual({ status: 'pending', confirmed_transaction_id: null })
  })

  describe('el sello de un pago anterior al vínculo (0077)', () => {
    const SELLOS = '00000000-0000-4000-8000-0000000d0177'
    const PERIODO = '00000000-0000-4000-8000-0000000e0177'

    const sello = async (opts: { cardPeriodId: string | null }): Promise<string> => {
      await actAsAdmin(db)
      await db.exec(`
        insert into public.subcategories (id, user_id, name, canonical_name)
        values ('${SELLOS}', null, 'Impuesto de sellos', 'impuesto-de-sellos')
        on conflict (id) do nothing;
      `)
      const { rows } = await db.query<{ id: string }>(`
        insert into public.transactions
          (user_id, date, amount, type, currency_code, subcategory_id, card_period_id, description)
        values ('${U_A}', '${VENCE}', 1000, 'expense', 'ARS', '${SELLOS}',
                ${opts.cardPeriodId ? `'${opts.cardPeriodId}'` : 'null'}, 'Impuesto de sellos')
        returning id
      `)
      return rows[0].id
    }

    it('el de un resumen pagado antes del vínculo no se ofrece ni se vincula', async () => {
      const id = await sello({ cardPeriodId: PERIODO })
      const debito = await movement()
      await actAsAdmin(db)
      await db.exec(`
        insert into public.period_payments (period_id, transaction_id, stamp_tax_link_known)
        values ('${PERIODO}', '${debito}', false);
      `)
      await expectNotLinkable(id)
    })

    it('el de un resumen cuyo pago sí registra el sello no se esconde por la subcategoría', async () => {
      // Ese pago ata su sello por id; un sello suelto en el mismo resumen no es el
      // suyo, así que la heurística no aplica.
      const id = await sello({ cardPeriodId: PERIODO })
      const debito = await movement()
      await actAsAdmin(db)
      await db.exec(`
        insert into public.period_payments (period_id, transaction_id, stamp_tax_link_known)
        values ('${PERIODO}', '${debito}', true);
      `)
      expect(await candidates()).toContain(id)
    })

    it('uno cargado a mano en una cuenta bancaria sí se ofrece', async () => {
      const id = await sello({ cardPeriodId: null })
      expect(await candidates()).toContain(id)
    })
  })
})
