-- Recurrencias — integridad de la regla frente a su etiqueta, su cursor y su semilla.
--
-- Run AFTER 0052_balance_temporal_cut.sql.
--
-- Tres defectos de integridad que el código venía produciendo en silencio:
--
--   ETIQUETA MENTIROSA  `frequency` es solo el rótulo de presentación; el cronograma
--     real lo gobiernan `interval_count` + `interval_unit`. Nada obligaba a que
--     coincidieran, y existe una regla con frequency='weekly' e interval_unit='month':
--     la UI dice "Semanal" y el motor corre mensual.
--
--   CURSOR HUÉRFANO   `created_from_transaction_id` era ON DELETE SET NULL, así que
--     borrar el movimiento semilla dejaba la regla viva y sin vínculo. Cuando la
--     semilla borrada tenía fecha FUTURA, la regla queda inservible: su
--     `last_generated_date` afirma haber cubierto una ocurrencia cuyo movimiento ya
--     no existe, y no vuelve a generar hasta `last_generated_date + intervalo`,
--     perdiendo ese período entero.
--
--   BORRADO SILENCIOSO  nada impedía llegar a ese estado desde ningún cliente.
--
-- Esta migración:
--
--   1  Normaliza `frequency` a partir del intervalo real. NO cambia cuándo dispara
--      ninguna regla — el motor ya obedecía el intervalo; solo deja de mentir el
--      rótulo. Lo inverso (derivar el intervalo del preset) sí cambiaría el
--      comportamiento y está descartado.
--   2  Agrega el CHECK que impide que un preset vuelva a desincronizarse. Va DESPUÉS
--      del paso 1 a propósito: hoy hay una fila que lo viola y al revés fallaría.
--   3  Repara SOLO la clase huérfana inservible (cursor = start_date, en el futuro,
--      sin semilla). Las huérfanas benignas y las de fecha pasada NO se tocan: ahí
--      poner NULL haría que el generador proponga re-crear un movimiento que el
--      usuario borró a propósito — peor que el bug.
--   4  Pasa el FK a ON DELETE RESTRICT, para que la garantía viva en la base y no en
--      que cada frontend se acuerde. Mismo patrón que period_payments.transaction_id
--      (0010) y los FK de categorías.
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor, then
-- regenerate types. The whole migration runs in one transaction.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · La etiqueta de frecuencia se deriva del intervalo real
-- ═══════════════════════════════════════════════════════════════════════════

update public.recurrences
   set frequency = case
         when interval_count = 1 and interval_unit = 'week'  then 'weekly'
         when interval_count = 2 and interval_unit = 'week'  then 'biweekly'
         when interval_count = 1 and interval_unit = 'month' then 'monthly'
         when interval_count = 1 and interval_unit = 'year'  then 'annual'
         else 'custom'
       end
 where frequency <> 'custom'
   and not (
         (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
      or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
      or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
      or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
   );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Coherencia preset ↔ intervalo, enforced para todo cliente
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.recurrences
  add constraint chk_recurrences_frequency_matches_interval check (
    frequency = 'custom'
    or (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
    or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
    or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
    or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Reparación acotada del cursor huérfano futuro
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Predicado, condición por condición:
--   created_from_transaction_id IS NULL   la semilla ya no existe
--   last_generated_date IS NOT NULL       la regla nació de un movimiento (una regla
--                                         directa nace con el cursor en NULL)
--   last_generated_date = start_date      el cursor nunca avanzó: la única ocurrencia
--                                         que declara cubierta es la de la semilla
--   last_generated_date > hoy_AR          esa ocurrencia todavía no pasó ⇒ no hay
--                                         nada real cubriéndola y todavía se puede
--                                         generar. En fechas pasadas NO se repara.
--
-- `current_date` a secas está prohibido: Supabase corre en UTC y adelantaría el día
-- hasta 3 horas. La fecha financiera es siempre America/Argentina/Buenos_Aires.

update public.recurrences
   set last_generated_date = null
 where status = 'active'
   and created_from_transaction_id is null
   and last_generated_date is not null
   and last_generated_date = start_date
   and last_generated_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · La base rechaza borrar un movimiento que sembró una regla
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El nombre del constraint lo puso Postgres al crearlo inline en 0011, así que se
-- resuelve por catálogo en vez de hardcodearlo.
--
-- RESTRICT bloquea la cascada del DELETE, NO un UPDATE deliberado: el flujo de
-- "conservar la regla, desvincular" sigue pudiendo poner la columna en NULL a mano
-- antes de borrar el movimiento.

do $$
declare
  v_constraint_name text;
  v_column_attnum   smallint;
begin
  select att.attnum into v_column_attnum
    from pg_attribute att
    where att.attrelid = 'public.recurrences'::regclass
      and att.attname = 'created_from_transaction_id'
      and not att.attisdropped;

  select con.conname into v_constraint_name
    from pg_constraint con
    where con.conrelid = 'public.recurrences'::regclass
      and con.contype = 'f'
      and con.conkey = array[v_column_attnum];

  if v_constraint_name is not null then
    execute format('alter table public.recurrences drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.recurrences
  add constraint recurrences_created_from_transaction_id_fkey
  foreign key (created_from_transaction_id)
  references public.transactions(id)
  on delete restrict;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · Verificación
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_desync   integer;
  v_deltype  "char";
begin
  select count(*) into v_desync
    from public.recurrences
   where frequency <> 'custom'
     and not (
           (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
        or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
        or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
        or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
     );
  if v_desync > 0 then
    raise exception 'recurrences: % filas con frequency incoherente tras normalizar', v_desync;
  end if;

  select con.confdeltype into v_deltype
    from pg_constraint con
   where con.conrelid = 'public.recurrences'::regclass
     and con.conname = 'recurrences_created_from_transaction_id_fkey';
  if v_deltype is distinct from 'r' then
    raise exception 'recurrences: created_from_transaction_id no quedó en ON DELETE RESTRICT (confdeltype=%)', v_deltype;
  end if;
end $$;

commit;
