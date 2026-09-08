-- ════════════════════════════════════════════════════════════════════════════
-- Auditoría: ¿hay reglas cuyo cursor NO cae sobre su propio cronograma?
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/fix-recurrence-backlog/  ·  tareas 1.10b y 1.7
--
-- POR QUÉ
--
-- El generador de hoy calcula la próxima ocurrencia como `addInterval(cursor)`
-- — reanuda la cadencia DESDE el cursor. El caminante nuevo la calcula anclada
-- en `start_date` — la cadencia es del calendario de la regla. Las dos coinciden
-- mientras el cursor caiga sobre ese calendario; cuando no cae, divergen.
--
-- Esta consulta dice si eso pasa en la base real. Es SOLO LECTURA y no devuelve
-- importes ni descripciones.
--
--   0 filas fuera de cronograma  ⇒ el anclaje en `start_date` preserva el
--                                  comportamiento actual y el esquema alcanza.
--   ≥1 fila                      ⇒ la versión asumida necesita persistir su
--                                  FASE (una fecha de inicio de secuencia,
--                                  además del `anchor_date` del clamping), para
--                                  conservar la próxima ocurrencia que hoy
--                                  produce `addInterval(cursor, …)`.
--                                  NO normalizar en silencio.
--
-- TAMBIÉN DECIDE LA TAREA 1.7 (el tope `max_occurrences`). El tope se cuenta
-- como el ORDINAL de la próxima fecha sobre el cronograma, y una fecha fuera del
-- cronograma no tiene ordinal; mientras eso no se resuelva, esas reglas
-- conservan el conteo de filas que usan hoy. La columna que lo responde es
-- `con_tope_sin_ordinal`: reglas CON TOPE cuya próxima fecha, calculada como la
-- calcula el generador de hoy, NO pertenece al cronograma.
--
--   0  ⇒ ninguna regla con tope depende del conteo de filas: el ordinal queda
--         como número único y el fallback se puede retirar del generador.
--   ≥1 ⇒ hay que persistir la fase de esas reglas antes de unificar, o dejar
--         escrita una compatibilidad explícita para ellas.
--
-- NO SE FILTRA POR UNIDAD, a propósito. `anchorDate` restaura el DÍA DEL MES,
-- no la fase de meses ni de años, así que el desfase no es exclusivo de día y
-- semana. Medido: la única combinación que no puede desfasarse es **mes con
-- `interval_count = 1`**, porque todos los meses están en su cronograma. Con
-- `count = 2` (inicio 01/01, cursor 10/02 ⇒ próxima 01/04, cronograma 01/01,
-- 01/03, 01/05…) o con cualquier regla anual cuyo cursor cayó en otro mes
-- (inicio 01/01, cursor 10/06 ⇒ próxima 01/06/2027, cronograma cada 01/01),
-- la próxima fecha queda fuera del cronograma igual.
--
-- CÓMO CORRERLA: pegar en el SQL Editor de Supabase. Devuelve dos resultados:
-- primero el resumen, después el detalle.
-- ════════════════════════════════════════════════════════════════════════════

with reglas as (
  select r.id, r.status, r.start_date, r.interval_count, r.interval_unit,
         r.max_occurrences,
         r.last_generated_date as cursor,
         -- Comportamiento ACTUAL: addInterval(cursor, unit, count) con el
         -- clamping anclado en start_date. Se calcula acá, una sola vez, para
         -- poder preguntar más abajo si esta fecha pertenece al cronograma.
         case r.interval_unit
           when 'day'  then r.last_generated_date + r.interval_count
           when 'week' then r.last_generated_date + (r.interval_count * 7)
           else (
             date_trunc('month',
               r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                           || ' month')::interval)
             + (least(
                  extract(day from r.start_date),
                  extract(day from date_trunc('month',
                    r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                                || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as proxima_actual
    from public.recurrences r
   where r.status <> 'deleted'
     and r.last_generated_date is not null
),
-- ¿Cuántos intervalos hay entre start_date y el cursor? Estimación entera; se
-- corrige abajo probando n-1..n+3, porque el clamping de fin de mes puede
-- desplazar la ocurrencia un paso, y la ventana tiene que alcanzar además a
-- `proxima_actual`, que está un intervalo más adelante que el cursor.
estimado as (
  select g.*,
         case g.interval_unit
           when 'day'   then floor((g.cursor - g.start_date)::numeric / g.interval_count)
           when 'week'  then floor((g.cursor - g.start_date)::numeric / (g.interval_count * 7))
           when 'month' then floor((((extract(year from g.cursor) - extract(year from g.start_date)) * 12
                                   + (extract(month from g.cursor) - extract(month from g.start_date))))::numeric
                                   / g.interval_count)
           when 'year'  then floor((extract(year from g.cursor) - extract(year from g.start_date))::numeric
                                   / g.interval_count)
         end::int as n0
    from reglas g
),
-- La ocurrencia n-ésima del cronograma, contando start_date como n = 0.
-- Reproduce el clamping de fin de mes anclado en start_date.
candidatas as (
  select e.*, n,
         case e.interval_unit
           when 'day'  then e.start_date + (n * e.interval_count)
           when 'week' then e.start_date + (n * e.interval_count * 7)
           else (
             date_trunc('month',
               e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                               || ' month')::interval)
             + (least(
                  extract(day from e.start_date),
                  extract(day from date_trunc('month',
                    e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                                    || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as fecha
    from estimado e
    -- Alrededor de GREATEST(n0, 0): `updateRecurrence` permite mover
    -- `start_date` sin ajustar el cursor, así que `last_generated_date` puede
    -- quedar ANTES del inicio. Con `n0` negativo, anclar en `n0` dejaba todas
    -- las candidatas fuera y la regla desaparecía hasta del total.
    cross join lateral (values (greatest(e.n0, 0) - 1), (greatest(e.n0, 0)),
                               (greatest(e.n0, 0) + 1), (greatest(e.n0, 0) + 2),
                               (greatest(e.n0, 0) + 3)) as v(n)
   where n >= 0
),
analisis as (
  select c.id, c.status, c.start_date, c.interval_count, c.interval_unit,
         c.max_occurrences, c.cursor, c.proxima_actual,
         bool_or(c.fecha = c.cursor)                    as cursor_en_cronograma,
         -- ¿La próxima fecha de HOY es una ocurrencia del cronograma? Si no lo
         -- es, no tiene ordinal, y el tope de esa regla no se puede leer del
         -- calendario. Esta es la pregunta de 1.7.
         bool_or(c.fecha = c.proxima_actual)            as proxima_actual_en_cronograma,
         min(c.fecha) filter (where c.fecha > c.cursor) as proxima_calendario_nuevo
    from candidatas c
   group by c.id, c.status, c.start_date, c.interval_count, c.interval_unit,
            c.max_occurrences, c.cursor, c.proxima_actual
)
select
  count(*)                                                     as reglas_totales,
  count(*) filter (where not cursor_en_cronograma)             as fuera_de_cronograma,
  count(*) filter (where proxima_actual
                      is distinct from proxima_calendario_nuevo) as con_proxima_distinta,
  -- LA COLUMNA DE 1.7. Sin filtro de unidad: cualquier unidad puede desfasarse.
  count(*) filter (where max_occurrences is not null
                     and not proxima_actual_en_cronograma)      as con_tope_sin_ordinal
from analisis;

-- ── Detalle, solo las que divergen ──────────────────────────────────────────
with reglas as (
  select r.id, r.status, r.start_date, r.interval_count, r.interval_unit,
         r.max_occurrences,
         r.last_generated_date as cursor,
         case r.interval_unit
           when 'day'  then r.last_generated_date + r.interval_count
           when 'week' then r.last_generated_date + (r.interval_count * 7)
           else (
             date_trunc('month',
               r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                           || ' month')::interval)
             + (least(
                  extract(day from r.start_date),
                  extract(day from date_trunc('month',
                    r.last_generated_date + ((r.interval_count * case r.interval_unit when 'year' then 12 else 1 end)
                                || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as proxima_actual
    from public.recurrences r
   where r.status <> 'deleted'
     and r.last_generated_date is not null
),
estimado as (
  select g.*,
         case g.interval_unit
           when 'day'   then floor((g.cursor - g.start_date)::numeric / g.interval_count)
           when 'week'  then floor((g.cursor - g.start_date)::numeric / (g.interval_count * 7))
           when 'month' then floor((((extract(year from g.cursor) - extract(year from g.start_date)) * 12
                                   + (extract(month from g.cursor) - extract(month from g.start_date))))::numeric
                                   / g.interval_count)
           when 'year'  then floor((extract(year from g.cursor) - extract(year from g.start_date))::numeric
                                   / g.interval_count)
         end::int as n0
    from reglas g
),
candidatas as (
  select e.*, n,
         case e.interval_unit
           when 'day'  then e.start_date + (n * e.interval_count)
           when 'week' then e.start_date + (n * e.interval_count * 7)
           else (
             date_trunc('month',
               e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                               || ' month')::interval)
             + (least(
                  extract(day from e.start_date),
                  extract(day from date_trunc('month',
                    e.start_date + ((n * e.interval_count * case e.interval_unit when 'year' then 12 else 1 end)
                                    || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as fecha
    from estimado e
    cross join lateral (values (greatest(e.n0, 0) - 1), (greatest(e.n0, 0)),
                               (greatest(e.n0, 0) + 1), (greatest(e.n0, 0) + 2),
                               (greatest(e.n0, 0) + 3)) as v(n)
   where n >= 0
),
analisis as (
  select c.id, c.status, c.start_date, c.interval_count, c.interval_unit,
         c.max_occurrences, c.cursor, c.proxima_actual,
         bool_or(c.fecha = c.cursor)                    as cursor_en_cronograma,
         bool_or(c.fecha = c.proxima_actual)            as proxima_actual_en_cronograma,
         min(c.fecha) filter (where c.fecha > c.cursor) as proxima_calendario_nuevo
    from candidatas c
   group by c.id, c.status, c.start_date, c.interval_count, c.interval_unit,
            c.max_occurrences, c.cursor, c.proxima_actual
)
select
  a.id                                as recurrence_id,
  a.status,
  a.start_date,
  a.interval_count,
  a.interval_unit,
  a.max_occurrences,
  a.cursor                            as last_generated_date,
  a.cursor_en_cronograma,
  a.proxima_actual_en_cronograma,
  a.proxima_actual                    as proxima_hoy,
  a.proxima_calendario_nuevo          as proxima_nueva,
  (a.proxima_calendario_nuevo - a.proxima_actual) as diferencia_dias,
  exists (
    select 1 from public.recurrence_instances i
     where i.recurrence_id = a.id and i.status = 'pending'
  )                                   as tiene_pendiente
from analisis a
where not a.cursor_en_cronograma
   or not a.proxima_actual_en_cronograma
   or a.proxima_actual is distinct from a.proxima_calendario_nuevo
order by abs(coalesce(a.proxima_calendario_nuevo - a.proxima_actual, 0)) desc, a.id;
