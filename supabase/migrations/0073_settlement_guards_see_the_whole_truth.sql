-- Las guardas de liquidación ven la verdad completa, no la del que las dispara.
--
-- Correr DESPUÉS de 0072_recurrence_link_movement.sql.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- El defecto, encontrado en QA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Un gasto compartido del 5/10, una liquidación **registrada por el otro
-- miembro** el 6/10, y desvincular el gasto funcionó. La guarda no se disparó.
--
-- Las dos guardas (0043/0048, con criterio de vigencia desde 0072) preguntan si
-- existe una liquidación vigente del hogar **fechada en o después** del gasto.
-- La fecha de una liquidación NO está en la fila `settlement`: está en el
-- movimiento del pagador (`payer_movement_id`), y ese movimiento es personal
-- (`is_shared = false`), así que RLS se lo muestra sólo a su dueño. La fila
-- `settlement` sí la ven los dos miembros; su fecha, no.
--
-- Las guardas corren como el que dispara el UPDATE o el DELETE — `SECURITY
-- INVOKER`, que es el default de una función de trigger. Entonces el `join` a
-- `transactions` no encontraba nada, el `exists` daba falso, y la protección
-- desaparecía **exactamente en el caso que más importa**: cuando la liquidación
-- la registró la otra persona. Sólo protegía contra uno mismo.
--
-- Los tests en PGlite no lo vieron porque corrían como dueño de las tablas, sin
-- RLS. El harness ahora modela roles y políticas: el caso cruzado falla sin esta
-- migración y pasa con ella.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Qué hace esta migración
-- ═══════════════════════════════════════════════════════════════════════════
--
--   1  `settlements_covering(hogar, moneda, desde)` — UNA definición de «qué
--      liquidaciones vigentes cubren esta fecha», `SECURITY DEFINER`, sin
--      EXECUTE para nadie: sólo la alcanzan las funciones de abajo, que corren
--      como dueño. No es una puerta nueva.
--   2  Las dos guardas la consumen y pasan a `SECURITY DEFINER` ellas también.
--      Son funciones de trigger: fuera de un trigger Postgres las rechaza, así
--      que elevarlas no agrega superficie llamable. Leen, no escriben.
--   3  `settlements_blocking_movement(movimiento)` — la misma verdad para el
--      MENSAJE. Sin ella la app veía cero liquidaciones bloqueantes y caía al
--      consejo genérico «revertí la liquidación», que sobre una pendiente ajena
--      es doblemente falso: ni se revierte, ni puede hacerlo quien lo lee.
--      Deriva hogar, moneda y fecha del movimiento y sólo contesta a quien ya
--      puede ver ese movimiento.
--
-- No cambia qué bloquea ni cómo se calcula la deuda: cambia quién puede verlo.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · Qué liquidaciones cubren una fecha, en un solo lugar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El predicado es el de 0072, palabra por palabra, más el `join` que necesita la
-- fecha. Lo único nuevo es que corre con los permisos del dueño de las tablas,
-- para que la respuesta no dependa de quién pregunta.

create or replace function public.settlements_covering(
  p_household_id  uuid,
  p_currency_code text,
  p_from          date
)
returns setof public.settlement
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.*
    from public.settlement s
    join public.transactions pm on pm.id = s.payer_movement_id
   where s.household_id = p_household_id
     and s.currency_code = p_currency_code
     and pm.date >= p_from
     and public.settlement_is_live(s);
$$;

-- Nadie la llama directo: tomaría un hogar arbitrario por parámetro y sería una
-- ventana a las liquidaciones de cualquiera. Las tres funciones que la usan
-- corren como dueño y no necesitan el grant.
revoke all on function public.settlements_covering(uuid, text, date)
  from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Las dos guardas, con la verdad completa
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Los triggers (0043/0048) NO se recrean: apuntan a estas funciones por nombre
-- y toman la definición nueva, igual que hizo 0072 sobre las de 0049.

create or replace function public.trg_fn_block_shared_delete_with_settlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $trg$
begin
  -- Sólo las filas que cargan deuda (splits) pueden reescribir historia
  -- liquidada. Exime al padre de cuotas y a las patas de liquidación, y usa la
  -- fecha de cada fila.
  if OLD.is_shared
     and OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1 from public.settlements_covering(
         OLD.household_id, OLD.currency_code, coalesce(OLD.due_date, OLD.date)
       )
     ) then
    raise exception
      'cannot delete shared movement % covered by a later settlement in household %',
      OLD.id, OLD.household_id
      using errcode = 'GRN01';
  end if;
  return OLD;
end;
$trg$;

create or replace function public.trg_fn_block_unshare_with_settlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $trg$
begin
  if OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1 from public.settlements_covering(
         OLD.household_id, OLD.currency_code, coalesce(OLD.due_date, OLD.date)
       )
     ) then
    raise exception
      'cannot unshare movement % covered by a later settlement in household %',
      OLD.id, OLD.household_id
      using errcode = 'GRN01';
  end if;
  return NEW;
end;
$trg$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · La misma verdad para el mensaje
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Devuelve las liquidaciones vigentes que cubren al movimiento, con lo justo
-- para elegir el consejo: el estado decide entre revertir y cancelar, y quién la
-- registró decide si eso lo puede hacer el que lee el mensaje.
--
-- Contesta sólo a quien ya ve el movimiento: su dueño, o el otro miembro del
-- hogar cuando el movimiento es compartido (la misma frontera que RLS).

create or replace function public.settlements_blocking_movement(p_transaction_id uuid)
returns table (id uuid, status text, payer_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
-- Las columnas de salida se llaman como las de `settlement`, y adentro del
-- cuerpo eso es ambiguo. Que gane la columna: es lo que se está devolviendo.
#variable_conflict use_column
declare
  v_tx public.transactions;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found or v_tx.household_id is null then
    return;
  end if;

  if v_tx.user_id is distinct from auth.uid()
     and not (v_tx.is_shared and public.is_household_member(v_tx.household_id)) then
    return;
  end if;

  return query
    select s.id, s.status, s.payer_id
      from public.settlements_covering(
        v_tx.household_id, v_tx.currency_code, coalesce(v_tx.due_date, v_tx.date)
      ) s;
end;
$fn$;

revoke all on function public.settlements_blocking_movement(uuid) from public, anon;
grant execute on function public.settlements_blocking_movement(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_secdef boolean;
  v_acl    boolean;
BEGIN
  -- Las tres funciones existen y son SECURITY DEFINER
  FOR v_secdef IN
    SELECT p.prosecdef
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('settlements_covering',
                         'settlements_blocking_movement',
                         'trg_fn_block_shared_delete_with_settlement',
                         'trg_fn_block_unshare_with_settlement')
  LOOP
    IF v_secdef IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'SELF-CHECK FAILED: alguna guarda quedó SECURITY INVOKER';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('settlements_covering',
                           'settlements_blocking_movement',
                           'trg_fn_block_shared_delete_with_settlement',
                           'trg_fn_block_unshare_with_settlement')) <> 4 THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: falta alguna de las cuatro funciones';
  END IF;

  -- settlements_covering no es llamable por la app
  SELECT has_function_privilege('authenticated', 'public.settlements_covering(uuid, text, date)', 'execute')
    INTO v_acl;
  IF v_acl THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: settlements_covering no debe ser llamable por authenticated';
  END IF;

  SELECT has_function_privilege('authenticated', 'public.settlements_blocking_movement(uuid)', 'execute')
    INTO v_acl;
  IF NOT v_acl THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: settlements_blocking_movement debe ser llamable por authenticated';
  END IF;

  RAISE NOTICE 'guardas de liquidación: cobertura única, permisos elevados, mensaje con la misma verdad.';
END $check$;

select '✓ 0073 settlement guards see the whole truth' as status;

commit;
