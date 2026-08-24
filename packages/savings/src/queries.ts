import type { GranaSupabaseClient } from '@grana/supabase'
import { formatDateISO, getTodayAR, type BalanceCurrency } from '@grana/money-logic'
import type { AvailableSums, ReserveEntry, ReserveFlowSums } from './types'

const isBalanceCurrency = (c: string): c is BalanceCurrency => c === 'ARS' || c === 'USD'

const toNumber = (v: number | string | null): number => (v == null ? 0 : Number(v))

// ── getAvailableSums ──────────────────────────────────────────────────────────
// El disponible real por moneda, agregado en Postgres por `get_available_sums`
// (migración 0057).
//
// Devuelve `available` ya restado y NO expone un helper que lo recomponga a
// partir de `accountsNet` y `reserved`. Esas dos columnas están para que la UI
// pueda EXPLICAR la resta (el drawer muestra "disponible − a guardar = queda"),
// no para que alguien la rehaga.
//
// La razón es la lección de la migración 0051: el criterio de "cuenta propia"
// estaba replicado a mano en cada call site y ya había divergido en producción.
// Esta función tiene TRES consumidores —el Hero, el tope del drawer y la
// validación del write path— así que derivar la resta por separado en cada uno
// garantiza que un día no coincidan.
//
// `p_today` fija el corte temporal al mismo "hoy" financiero que renderiza el
// resto de la UI: una reserva futura existe pero no descuenta todavía.
export async function getAvailableSums(
  supabase: GranaSupabaseClient,
  today: Date = getTodayAR(),
): Promise<AvailableSums[]> {
  const { data, error } = await supabase.rpc('get_available_sums', {
    p_today: formatDateISO(today),
  })

  if (error) throw error

  return (data ?? [])
    .filter((row) => isBalanceCurrency(row.currency_code))
    .map((row) => ({
      currencyCode: row.currency_code as BalanceCurrency,
      accountsNet: toNumber(row.accounts_net),
      reserved: toNumber(row.reserved),
      available: toNumber(row.available),
    }))
}

/**
 * El disponible de UNA moneda. Ausente en la respuesta = cero: un usuario sin
 * saldo ni reservas en dólares no tiene fila de dólares, y eso significa que no
 * tiene nada, no que el dato falte.
 */
export async function getAvailableForCurrency(
  supabase: GranaSupabaseClient,
  currencyCode: BalanceCurrency,
  today: Date = getTodayAR(),
): Promise<AvailableSums> {
  const sums = await getAvailableSums(supabase, today)
  return (
    sums.find((s) => s.currencyCode === currencyCode) ?? {
      currencyCode,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }
  )
}

// ── getReserveFlowSums ────────────────────────────────────────────────────────
// El neto reservado del período, por moneda. Alimenta la fila "Guardaste este
// mes" del dashboard.
//
// Existe por la misma razón que `getAvailableSums`: la fila es un FLUJO, y
// calcularlo a mano en TS reintroduce el mismo riesgo de divergencia que evita
// la lectura del stock. Nadie recompone ni uno ni otro.
export async function getReserveFlowSums(
  supabase: GranaSupabaseClient,
  from: Date,
  to: Date,
  today: Date = getTodayAR(),
): Promise<ReserveFlowSums[]> {
  const { data, error } = await supabase.rpc('get_reserve_flow_sums', {
    p_from: formatDateISO(from),
    p_to: formatDateISO(to),
    p_today: formatDateISO(today),
  })

  if (error) throw error

  return (data ?? [])
    .filter((row) => isBalanceCurrency(row.currency_code))
    .map((row) => ({
      currencyCode: row.currency_code as BalanceCurrency,
      reservedNet: toNumber(row.reserved_net),
    }))
}

// ── getReserveHistory ─────────────────────────────────────────────────────────
// Las decisiones de una moneda, más recientes primero.
//
// Alimenta la vista de detalle, que existe por una razón de fondo: como guardar
// NO es un movimiento, no aparece en Movimientos, y sin este listado el usuario
// no podría auditar su propia decisión.
//
// Orden determinístico hasta el desempate: dos reservas del mismo día llegan
// siempre en el mismo orden, o el listado se reordenaría solo entre renders.
export async function getReserveHistory(
  supabase: GranaSupabaseClient,
  currencyCode: BalanceCurrency,
): Promise<ReserveEntry[]> {
  const { data, error } = await supabase
    .from('availability_reserve')
    .select('id, currency_code, amount, date, created_at')
    .eq('currency_code', currencyCode)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    currencyCode: row.currency_code as BalanceCurrency,
    amount: toNumber(row.amount),
    date: row.date,
    createdAt: row.created_at,
  }))
}

// ── getLatestIncome ───────────────────────────────────────────────────────────
// El ÚLTIMO ingreso cargado del período, en una moneda: su monto y cuándo se
// registró.
//
// Es la base sobre la que la tira propone guardar, y tiene que ser ese y no el
// total del mes: lo que el usuario acaba de cobrar es la plata sobre la que está
// dispuesto a decidir, mientras que el total del mes incluye plata que ya gastó.
//
// Ordena por `created_at`, NO por `date`: lo que la tira persigue es "el que
// acabás de cargar", y eso es cuándo se registró, no qué fecha contable le
// pusiste. Cargar hoy un sueldo con fecha del 19 tiene que disparar la
// sugerencia igual — la plata es igual de nueva para el usuario.
//
// El rango sigue acotado por `date` al mes en curso: un ingreso de julio cargado
// en agosto es plata de julio, y proponer guardarla ahora hablaría de un mes que
// la pantalla no está mirando.
export async function getLatestIncome(
  supabase: GranaSupabaseClient,
  currencyCode: BalanceCurrency,
  fromISO: string,
  toISO: string,
): Promise<{ amount: number; createdAt: string } | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, created_at')
    .eq('type', 'income')
    .eq('currency_code', currencyCode)
    .is('status', null)
    .gte('date', fromISO)
    .lte('date', toISO)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)

  if (error) throw error

  const row = (data ?? [])[0]
  return row ? { amount: toNumber(row.amount), createdAt: row.created_at } : null
}
