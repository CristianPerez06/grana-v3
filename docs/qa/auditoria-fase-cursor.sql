-- ════════════════════════════════════════════════════════════════════════════
-- Auditoría: ¿hay reglas cuyo cursor NO cae sobre su propio cronograma?
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/fix-recurrence-backlog/  ·  tarea 1.10b
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
-- cronograma no tiene ordinal. Mientras eso no se resuelva, esas reglas
-- conservan el conteo de filas que usan hoy. La columna que lo responde es
-- `con_tope_dia_semana`:
--
--   0  ⇒ ninguna regla con tope puede desfasarse, el ordinal es el único
--         número y el conteo de filas se puede retirar del generador.
--   ≥1 ⇒ hay que persistir la fase de esas reglas antes de unificar, o dejar
--         escrita una compatibilidad explícita para ellas.
--
-- CÓMO CORRERLA: pegar en el SQL Editor de Supabase. Devuelve dos resultados:
-- primero el resumen, después el detalle.
-- ════════════════════════════════════════════════════════════════════════════

with reglas as (
  select r.id, r.status, r.start_date, r.interval_count, r.interval_unit,
         r.max_occurrences,
         r.last_generated_date as cursor
    from public.recurrences r
   where r.status <> 'deleted'
     and r.last_generated_date is not null
),
-- ¿Cuántos intervalos hay entre start_date y el cursor? Estimación entera; se
-- corrige abajo probando n-1..n+2, porque el clamping de fin de mes puede
-- desplazar la ocurrencia un paso.
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
                               (greatest(e.n0, 0) + 1), (greatest(e.n0, 0) + 2)) as v(n)
   where n >= 0
),
analisis as (
  select c.id, c.status, c.start_date, c.interval_count, c.interval_unit, c.max_occurrences, c.cursor,
         bool_or(c.fecha = c.cursor)                     as cursor_en_cronograma,
         min(c.fecha) filter (where c.fecha > c.cursor)   as proxima_calendario_nuevo
    from candidatas c
   group by c.id, c.status, c.start_date, c.interval_count, c.interval_unit, c.max_occurrences, c.cursor
),
comparacion as (
  select a.*,
         -- Comportamiento ACTUAL: addInterval(cursor, unit, count) con el
         -- clamping anclado en start_date.
         case a.interval_unit
           when 'day'  then a.cursor + a.interval_count
           when 'week' then a.cursor + (a.interval_count * 7)
           else (
             date_trunc('month',
               a.cursor + ((a.interval_count * case a.interval_unit when 'year' then 12 else 1 end)
                           || ' month')::interval)
             + (least(
                  extract(day from a.start_date),
                  extract(day from date_trunc('month',
                    a.cursor + ((a.interval_count * case a.interval_unit when 'year' then 12 else 1 end)
                                || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as proxima_comportamiento_actual
    from analisis a
)
select
  count(*)                                        as reglas_totales,
  count(*) filter (where not cursor_en_cronograma) as fuera_de_cronograma,
  count(*) filter (where proxima_comportamiento_actual
                      is distinct from proxima_calendario_nuevo) as con_proxima_distinta,
  -- Para la tarea 1.7: solo una regla CON TOPE y de unidad día/semana puede
  -- quedar desfasada. Las mensuales y anuales reanclan el día en `start_date`
  -- en cada paso, así que su próxima fecha siempre vuelve al cronograma.
  count(*) filter (where not cursor_en_cronograma
                     and max_occurrences is not null)            as con_tope_y_fuera,
  count(*) filter (where not cursor_en_cronograma
                     and max_occurrences is not null
                     and interval_unit in ('day', 'week'))       as con_tope_dia_semana
from comparacion;

-- ── Detalle, solo las que divergen ──────────────────────────────────────────
with reglas as (
  select r.id, r.status, r.start_date, r.interval_count, r.interval_unit,
         r.max_occurrences,
         r.last_generated_date as cursor
    from public.recurrences r
   where r.status <> 'deleted' and r.last_generated_date is not null
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
    -- Alrededor de GREATEST(n0, 0): `updateRecurrence` permite mover
    -- `start_date` sin ajustar el cursor, así que `last_generated_date` puede
    -- quedar ANTES del inicio. Con `n0` negativo, anclar en `n0` dejaba todas
    -- las candidatas fuera y la regla desaparecía hasta del total.
    cross join lateral (values (greatest(e.n0, 0) - 1), (greatest(e.n0, 0)),
                               (greatest(e.n0, 0) + 1), (greatest(e.n0, 0) + 2)) as v(n)
   where n >= 0
),
analisis as (
  select c.id, c.status, c.start_date, c.interval_count, c.interval_unit, c.max_occurrences, c.cursor,
         bool_or(c.fecha = c.cursor)                    as cursor_en_cronograma,
         min(c.fecha) filter (where c.fecha > c.cursor)  as proxima_calendario_nuevo
    from candidatas c
   group by c.id, c.status, c.start_date, c.interval_count, c.interval_unit, c.max_occurrences, c.cursor
),
comparacion as (
  select a.*,
         case a.interval_unit
           when 'day'  then a.cursor + a.interval_count
           when 'week' then a.cursor + (a.interval_count * 7)
           else (
             date_trunc('month',
               a.cursor + ((a.interval_count * case a.interval_unit when 'year' then 12 else 1 end)
                           || ' month')::interval)
             + (least(
                  extract(day from a.start_date),
                  extract(day from date_trunc('month',
                    a.cursor + ((a.interval_count * case a.interval_unit when 'year' then 12 else 1 end)
                                || ' month')::interval) + interval '1 month - 1 day')
                ) - 1) * interval '1 day'
           )::date
         end as proxima_comportamiento_actual
    from analisis a
)
select
  c.id                                as recurrence_id,
  c.status,
  c.start_date,
  c.interval_count,
  c.interval_unit,
  c.max_occurrences,
  c.cursor                            as last_generated_date,
  c.cursor_en_cronograma,
  c.proxima_comportamiento_actual     as proxima_hoy,
  c.proxima_calendario_nuevo          as proxima_nueva,
  (c.proxima_calendario_nuevo - c.proxima_comportamiento_actual) as diferencia_dias,
  exists (
    select 1 from public.recurrence_instances i
     where i.recurrence_id = c.id and i.status = 'pending'
  )                                   as tiene_pendiente
from comparacion c
where not c.cursor_en_cronograma
   or c.proxima_comportamiento_actual is distinct from c.proxima_calendario_nuevo
order by abs(coalesce(c.proxima_calendario_nuevo - c.proxima_comportamiento_actual, 0)) desc, c.id;
