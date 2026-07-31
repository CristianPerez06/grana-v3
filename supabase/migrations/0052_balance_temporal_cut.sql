-- Corte temporal del saldo — las transacciones futuras no cuentan hasta su fecha.
--
-- Run AFTER 0051_account_balance_sums.sql.
--
-- `get_account_balance_sums` (0051) sumaba toda fila on-ledger sin mirar `date`,
-- así que un gasto cargado con fecha posterior a hoy (o el movimiento semilla de
-- una recurrencia futura) descontaba el Disponible de inmediato. El saldo actual
-- pasa a considerar solo transacciones con `date <= hoy`, donde "hoy" es la
-- fecha financiera del proyecto: la fecha calendario en
-- `America/Argentina/Buenos_Aires` (el mismo "hoy" que `getTodayAR()` en TS).
-- NUNCA `current_date` a secas: el servidor de Supabase corre en UTC y
-- adelantaría el corte hasta 3 horas.
--
-- La función gana un parámetro `p_today date default null`:
--   · NULL   → el corte se computa en SQL con el timezone financiero explícito.
--   · dado   → ese día exacto. Los callers TS pasan `formatDateISO(getTodayAR())`
--     para que el "hoy" del saldo sea idéntico al del resto de la UI, y los tests
--     de paridad lo fijan para ser determinísticos.
--
-- Postgres trata `(uuid[])` y `(uuid[], date)` como funciones DISTINTAS: un
-- `create or replace` con la firma nueva dejaría dos overloads y las llamadas
-- con argumentos nombrados (PostgREST rpc) serían ambiguas. Por eso el drop
-- explícito de la firma vieja antes del create — misma transacción, sin ventana
-- sin función.
--
-- Todo lo demás es idéntico a 0051: SECURITY INVOKER, universo propio derivado
-- de `get_owned_account_ids`, off-ledger excluido por `status is null`, reglas
-- de signo espejo de `calculateTransactionSums` (el test de paridad SQL↔TS ancla
-- la equivalencia, ahora incluyendo el corte temporal).

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. get_account_balance_sums — neto por cuenta y moneda, con corte a hoy
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.get_account_balance_sums(uuid[]);

create function public.get_account_balance_sums(
  p_account_ids uuid[] default null,
  p_today       date   default null
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
    -- Corte temporal: una fila futura existe pero no aporta al saldo hasta que
    -- su fecha llegue. El "hoy" default usa el timezone financiero AR explícito.
    and t.date <= coalesce(
      p_today,
      (now() at time zone 'America/Argentina/Buenos_Aires')::date
    )
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

comment on function public.get_account_balance_sums(uuid[], date) is
  'Neto por cuenta y moneda de las filas on-ledger con date <= hoy (timezone financiero AR, o p_today si se pasa), replicando las reglas de signo de calculateTransactionSums. p_account_ids NULL = las cuentas propias.';

revoke execute on function public.get_account_balance_sums(uuid[], date) from public;
grant  execute on function public.get_account_balance_sums(uuid[], date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_secdef boolean;
  v_def    text;
BEGIN
  -- La firma vieja (uuid[]) ya no existe: sin overloads ambiguos para PostgREST.
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_account_balance_sums'
     AND pg_get_function_identity_arguments(p.oid) = 'p_account_ids uuid[]';
  IF FOUND THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: old single-arg overload still exists';
  END IF;

  -- La firma nueva existe y es SECURITY INVOKER.
  SELECT p.prosecdef, pg_get_functiondef(p.oid) INTO v_secdef, v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_account_balance_sums';
  IF v_secdef IS NULL THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums missing';
  END IF;
  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: get_account_balance_sums must be SECURITY INVOKER';
  END IF;

  -- El corte temporal está y usa el timezone financiero explícito + p_today.
  IF v_def NOT ILIKE '%America/Argentina/Buenos_Aires%' THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: temporal cut must use the AR financial timezone';
  END IF;
  IF v_def NOT ILIKE '%p_today%' THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: p_today parameter missing from definition';
  END IF;

  -- Invariantes de 0051 que deben sobrevivir el replace:
  IF v_def NOT ILIKE '%get_owned_account_ids%' THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: does not derive the owned set';
  END IF;
  IF v_def NOT ILIKE '%status is null%' THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: does not exclude off-ledger rows';
  END IF;

  RAISE NOTICE 'balance temporal cut validated: p_today + AR timezone, single signature, 0051 invariants intact.';
END $check$;

select '✓ 0052 balance temporal cut applied' as status;

commit;
