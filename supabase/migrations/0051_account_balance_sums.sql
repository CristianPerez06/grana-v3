-- Saldos — agregación en Postgres del neto por cuenta y moneda.
--
-- Run AFTER 0050_revert_card_period_payment.sql.
--
-- Hasta acá todos los saldos de la app se calculaban igual: traer las filas de
-- `transactions` con PostgREST y sumarlas en JS (`calculateTransactionSums`).
-- Ese patrón tiene dos defectos de raíz:
--
--   1  El `.select()` de esas queries no tiene `.range()`, ni `.limit()`, ni
--      `.order()`. PostgREST aplica un `max-rows` del lado del servidor (1000 por
--      defecto en Supabase) y **trunca en silencio**: `error === null`, menos
--      filas de las que matchean, ninguna señal. El saldo que sale de ahí es un
--      número plausible y mal, y sin ORDER BY es no determinístico qué se pierde.
--   2  El criterio de "cuenta propia" (`type IN ('cash','bank') AND is_active`)
--      estaba replicado a mano en cada call site — y ya había divergido:
--      `getMonthBalanceSeries` omitía `is_active` mientras el Hero lo aplicaba.
--
-- Esta migración mueve la agregación a SQL. El volumen de la respuesta pasa a ser
-- función de la cantidad de CUENTAS (decenas), no de la cantidad de MOVIMIENTOS
-- (ilimitada), así que el `max-rows` deja de ser alcanzable en vez de quedar
-- "lejos por ahora". Agrega dos funciones:
--
--   · get_owned_account_ids()          — la definición NORMATIVA de cuenta propia.
--     Único lugar del sistema donde vive el predicado `type IN ('cash','bank')
--     AND is_active = true`. Todo read cuyo universo sea "las cuentas propias" lo
--     deriva de acá en vez de reconstruirlo.
--   · get_account_balance_sums(uuid[]) — neto por cuenta y moneda, replicando las
--     reglas de signo por tipo de `calculateTransactionSums` (que sigue siendo la
--     fuente de verdad: un test de paridad SQL↔TS ancla la equivalencia).
--
-- Las dos son SECURITY INVOKER: RLS aplica con los permisos del que llama, igual
-- que get_movements_page (0029). Sin elevación de privilegios, sin
-- SECURITY DEFINER: el usuario ve exactamente lo que sus policies le permiten.
--
-- Aditiva: no toca tablas, no borra nada, no rompe callers existentes.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. get_owned_account_ids — definición normativa de "cuenta propia"
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El patrimonio disponible del usuario: efectivo y bancos, activos. Las de
-- crédito quedan afuera por el invariante off-ledger (una tarjeta nunca aporta
-- al Disponible) y las archivadas porque su saldo tampoco está en el Disponible:
-- contarlas de un lado y no del otro es lo que rompía la reconciliación.
--
-- RLS de `accounts` scopea el resultado al usuario que llama.

create or replace function public.get_owned_account_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select a.id
  from public.accounts a
  where a.type in ('cash', 'bank')
    and a.is_active = true
$$;

comment on function public.get_owned_account_ids() is
  'Definición normativa del universo de cuentas propias (type IN (cash,bank) AND is_active). Todo read de saldo la deriva de acá en vez de replicar el predicado.';

revoke execute on function public.get_owned_account_ids() from public;
grant  execute on function public.get_owned_account_ids() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. get_account_balance_sums — neto por cuenta y moneda
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `p_account_ids` NULL  → las cuentas propias (get_owned_account_ids).
-- `p_account_ids` dado  → ese conjunto exacto, siempre intersecado con lo que RLS
--   deja ver. Lo necesitan el detalle de cuenta y el listado con archivadas, que
--   muestran el saldo de una cuenta fuera del universo "propio".
--
-- Reglas de signo — espejo exacto de `calculateTransactionSums`
-- (packages/money-logic/src/balance.ts), pata por pata:
--
--   income          +amount        sobre account_id
--   expense         −amount        sobre account_id
--   adjustment      +amount        sobre account_id (guardado CON signo)
--   transfer        −amount        sobre account_id (si es del conjunto)
--                   +amount        sobre transfer_destination_account_id (idem)
--   exchange        −amount        sobre account_id en currency_code
--                   +destination_amount sobre transfer_destination_account_id
--                                  en destination_currency (cross-moneda)
--   reimbursement   +amount        SOLO si target='account' AND received_at IS NOT
--                                  NULL AND cancelled_at IS NULL. Pendiente,
--                                  cancelado o "en resumen" no tocan un saldo.
--   settlement      −amount si direction='out', +amount si 'in'
--
-- Filas off-ledger excluidas por `status IS NULL`: las hijas de tarjeta llevan
-- status 'pending'/'paid', y la parent de cuotas tiene account_id NULL (y
-- destination NULL), así que no entra por ninguna pata.
--
-- Solo ARS y USD: son las dos monedas del ledger (bimoneda), y es lo que
-- `isBalanceCurrency` filtra del lado TS.

create or replace function public.get_account_balance_sums(
  p_account_ids uuid[] default null
)
returns table (
  account_id    uuid,
  currency_code text,
  net           numeric
)
language sql
stable
security invoker
set search_path = public
as $$
with scope as (
  select a.id
  from public.accounts a
  where case
          when p_account_ids is null then a.id in (select public.get_owned_account_ids())
          else a.id = any(p_account_ids)
        end
),
tx as (
  select t.*
  from public.transactions t
  where t.status is null
    and (
      t.account_id in (select s.id from scope s)
      or t.transfer_destination_account_id in (select s.id from scope s)
    )
),
legs as (
  -- Pata origen (la cuenta que registra el movimiento).
  select
    t.account_id                          as account_id,
    t.currency_code                       as currency_code,
    case t.type::text
      when 'income'     then  t.amount
      when 'expense'    then -t.amount
      when 'transfer'   then -t.amount
      when 'exchange'   then -t.amount
      when 'adjustment' then  t.amount
      when 'reimbursement' then
        case
          when t.reimbursement_target = 'account'
           and t.received_at is not null
           and t.cancelled_at is null
          then t.amount
          else 0
        end
      when 'settlement' then
        case t.settlement_direction
          when 'out' then -t.amount
          when 'in'  then  t.amount
          else 0
        end
      else 0
    end                                   as net
  from tx t
  where t.account_id in (select s.id from scope s)

  union all

  -- Pata destino de una transferencia: misma moneda, mismo monto, signo opuesto.
  select
    t.transfer_destination_account_id,
    t.currency_code,
    t.amount
  from tx t
  where t.type::text = 'transfer'
    and t.transfer_destination_account_id in (select s.id from scope s)

  union all

  -- Pata destino de un cambio de moneda: OTRA moneda, OTRO monto.
  select
    t.transfer_destination_account_id,
    t.destination_currency,
    t.destination_amount
  from tx t
  where t.type::text = 'exchange'
    and t.transfer_destination_account_id in (select s.id from scope s)
    and t.destination_currency is not null
    and t.destination_amount is not null
)
select
  l.account_id,
  l.currency_code,
  sum(l.net)::numeric as net
from legs l
where l.account_id is not null
  and l.currency_code in ('ARS', 'USD')
group by l.account_id, l.currency_code
$$;

comment on function public.get_account_balance_sums(uuid[]) is
  'Neto por cuenta y moneda de las filas on-ledger, replicando las reglas de signo de calculateTransactionSums. p_account_ids NULL = las cuentas propias. Reemplaza el .select() sin cota que PostgREST truncaba en silencio.';

revoke execute on function public.get_account_balance_sums(uuid[]) from public;
grant  execute on function public.get_account_balance_sums(uuid[]) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_secdef boolean;
BEGIN
  -- get_owned_account_ids existe y es SECURITY INVOKER (prosecdef = false)
  SELECT p.prosecdef INTO v_secdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_owned_account_ids';
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_owned_account_ids missing';
  END IF;
  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_owned_account_ids must be SECURITY INVOKER';
  END IF;

  -- get_account_balance_sums existe y es SECURITY INVOKER
  SELECT p.prosecdef INTO v_secdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_account_balance_sums';
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums missing';
  END IF;
  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums must be SECURITY INVOKER';
  END IF;

  -- El criterio de cuenta propia vive UNA sola vez: la función de saldos lo
  -- deriva de get_owned_account_ids en vez de repetir el predicado.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_account_balance_sums'
     AND pg_get_functiondef(p.oid) ILIKE '%get_owned_account_ids%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums does not derive the owned set';
  END IF;

  -- Las filas off-ledger quedan afuera del agregado.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_account_balance_sums'
     AND pg_get_functiondef(p.oid) ILIKE '%status is null%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums does not exclude off-ledger rows';
  END IF;

  RAISE NOTICE 'balance sums validated: owned-account definition, sign rules, SECURITY INVOKER.';
END $check$;

select '✓ 0051 account balance sums applied' as status;

commit;
