-- Recurrencias — registrar un pago antes del vencimiento, vincular un movimiento
-- ya cargado y desvincular.
--
-- Run AFTER 0071_pause_looks_forward.sql.
--
-- Change: openspec/changes/recurrence-link-movement/
--
-- Supabase es online-only: se aplica pegando este archivo en el SQL Editor del
-- dashboard y después se regeneran los tipos. Corre en una sola transacción.
--
-- NO ES DESTRUCTIVA: reemplaza funciones por su versión corregida y agrega
-- funciones nuevas. No borra filas, no cambia tipos, no elimina columnas.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · recurrence_positions_spent — la unión
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Copia de **0071** con UN agregado, marcado abajo. El resto del cuerpo queda
-- palabra por palabra.
--
-- SE COPIA DE 0071, NO DE 0068, y la diferencia no es cosmética: 0068 resta la
-- pausa desde su propio día de apertura (`d >= ps.paused_from`) y 0071 lo
-- corrigió a `d > ps.paused_from`, porque una regla pausada el día en que vencía
-- perdía esa posición y un plan de tres generaba una cuarta cuota. Copiar la
-- versión vieja revierte ese arreglo en silencio. El self-check de 0071 lo
-- detecta —así se detectó al escribir esta migración—, y se vuelve a verificar
-- al final de ésta para que el próximo que la reemplace no repita el camino.

create or replace function public.recurrence_positions_spent(
  p_id    uuid,
  p_today date
)
returns int
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule     public.recurrences;
  v_version  record;
  v_next     date;
  v_to       date;
  v_step     interval;
  v_produced int := 0;
  v_count    int;
  v_span     int;
  v_seed     date;
  v_upfront  boolean := false;
  v_prefix   boolean;
  v_ahead    int;
begin
  select * into v_rule from public.recurrences where id = p_id;
  if not found then
    return 0;
  end if;

  -- THE SEED IS A SPENT POSITION, always. The movement is in the ledger from the
  -- day the rule is created, dated ahead or not, and no version of the schedule
  -- need produce it for that to be true. Correcting a reference date is exactly
  -- the case where none does — the seed's own date falls in the gap the
  -- correction opens — and without this a three-cuota rule hands out three more
  -- on top of the movement the user already has.
  v_seed := v_rule.seed_occurrence_date;

  for v_version in
    select v.*,
           lead(v.effective_from) over (order by v.effective_from) as next_from,
           row_number() over (order by v.effective_from)           as ord
      from public.recurrence_schedule_versions v
     where v.recurrence_id = p_id
     order by v.effective_from
  loop
    exit when v_rule.max_occurrences is not null and v_produced >= v_rule.max_occurrences;

    v_step := case v_version.interval_unit
                when 'day'   then make_interval(days   => v_version.interval_count)
                when 'week'  then make_interval(weeks  => v_version.interval_count)
                when 'month' then make_interval(months => v_version.interval_count)
                when 'year'  then make_interval(years  => v_version.interval_count)
              end;
    if v_step is null then
      raise exception 'unknown schedule: % every %', v_version.interval_unit, v_version.interval_count
        using errcode = 'check_violation';
    end if;

    -- The earliest of the three ends.
    v_to := p_today;
    if v_version.effective_until is not null and v_version.effective_until < v_to then
      v_to := v_version.effective_until;
    end if;
    v_next := v_version.next_from;
    if v_next is not null and (v_next - 1) < v_to then
      v_to := v_next - 1;
    end if;

    -- How many steps could possibly fit, so the series is bounded by the rule's
    -- own life instead of a guessed constant.
    v_span := greatest(0, (v_to - v_version.anchor_date)) + 1;
    v_span := case v_version.interval_unit
                when 'day'   then v_span / v_version.interval_count
                when 'week'  then v_span / (v_version.interval_count * 7)
                when 'month' then v_span / (v_version.interval_count * 28)
                when 'year'  then v_span / (v_version.interval_count * 365)
              end + 2;

    -- The positions already spent before this version took effect. Only for the
    -- first one: later versions start where the previous stopped counting.
    if v_version.ord = 1 then
      select count(*) into v_produced
        from generate_series(0, v_span) n
       where (v_version.anchor_date + (v_step * n))::date < v_version.effective_from
         and (v_rule.end_date is null
              or (v_version.anchor_date + (v_step * n))::date <= v_rule.end_date);

      -- Counted there already, or counted here — once either way.
      select v_seed is not null and exists (
        select 1 from generate_series(0, v_span) n
         where (v_version.anchor_date + (v_step * n))::date = v_seed
           and (v_version.anchor_date + (v_step * n))::date < v_version.effective_from
      ) into v_prefix;
      v_upfront := v_seed is not null and not v_prefix;
      if v_upfront then
        v_produced := v_produced + 1;
      end if;
    end if;

    continue when v_version.effective_from > v_to;

    select count(*) into v_count
      from generate_series(0, v_span) n
      cross join lateral (select (v_version.anchor_date + (v_step * n))::date as d) x
     where d >= v_version.effective_from
       and d <= v_to
       and (v_rule.end_date is null or d <= v_rule.end_date)
       and not (v_upfront and d = v_seed)
       and not exists (
         select 1 from public.recurrence_pauses ps
          where ps.recurrence_id = p_id
            -- ── THE ONE CHANGE 0071 MAKES ───────────────────────────────
            -- `>` and not `>=`: the day a pause was opened still belongs to the
            -- calendar. An occurrence that fell that day was produced BEFORE the
            -- user paused — the instance row proves it — and a pause must not
            -- take away a position the rule already spent.
            and d > ps.paused_from
            and (ps.resumed_at is null or d < ps.resumed_at)
       );

    v_produced := v_produced + v_count;
  end loop;

  -- No versions at all: the loop never ran, and the seed is still spent.
  if not exists (
    select 1 from public.recurrence_schedule_versions where recurrence_id = p_id
  ) then
    v_produced := case when v_seed is null then 0 else 1 end;
  end if;

  -- ═════════════════════════════════════════════════════════════════════════
  -- UNA POSICIÓN SE GASTA AL LLEGAR SU FECHA **O** AL RESOLVERSE ANTES.
  -- ═════════════════════════════════════════════════════════════════════════
  --
  -- Todo lo contado arriba está fechado hasta `p_today` (cada versión corta en
  -- `v_to`, que nunca pasa de ahí). Lo que falta son los vencimientos ya
  -- resueltos cuya fecha TODAVÍA NO LLEGÓ: registrar el pago del 23 el día 3 los
  -- produce, y sin ellos la regla muestra «0 de 3» con uno de los tres pagado.
  --
  -- LOS DOS CONJUNTOS SON DISJUNTOS POR CONSTRUCCIÓN —uno termina en `p_today` y
  -- el otro empieza estrictamente después—, y por eso la unión se puede sumar.
  -- Es también la razón de que el caminante no se toque: extenderlo más allá de
  -- hoy haría que la generación empezara a materializar ocurrencias futuras.
  --
  --   distinct   dos filas no pueden compartir `due_date` (índice único parcial
  --              de 0064), pero el conteo no depende de ese índice para ser
  --              correcto.
  --   <> v_seed  la semilla ya se contó arriba por sí misma; sumarla acá contaría
  --              el mismo compromiso dos veces.
  --   status     'confirmed' y 'skipped' son las dos formas de estar resuelta.
  --              'pending' no gasta nada: devolver una ocurrencia a revisión
  --              antes de su fecha libera la posición, y eso es correcto.
  select count(distinct i.due_date) into v_ahead
    from public.recurrence_instances i
   where i.recurrence_id = p_id
     and i.status in ('confirmed', 'skipped')
     and i.due_date is not null
     and i.due_date > p_today
     and (v_seed is null or i.due_date <> v_seed);

  v_produced := v_produced + coalesce(v_ahead, 0);

  if v_rule.max_occurrences is not null and v_produced > v_rule.max_occurrences then
    v_produced := v_rule.max_occurrences;
  end if;
  return v_produced;
end $$;

-- `recurrence_positions_spent_batch` (0070) llama a ésta y NO se toca: hay una
-- sola definición de qué cuenta `max_occurrences`, y el batch es otra forma de
-- preguntarla, no otra forma de calcularla.

revoke all on function public.recurrence_positions_spent(uuid, date) from public, anon;
grant execute on function public.recurrence_positions_spent(uuid, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check — antes del COMMIT
-- ═══════════════════════════════════════════════════════════════════════════

do $selfcheck$
declare
  v_body text;
begin
  if to_regprocedure('public.recurrence_positions_spent(uuid, date)') is null then
    raise exception '0072: recurrence_positions_spent falta';
  end if;

  select lower(regexp_replace(regexp_replace(prosrc, '--[^\n]*', ' ', 'g'), '\s+', ' ', 'g'))
    into v_body
    from pg_proc
   where oid = 'public.recurrence_positions_spent(uuid, date)'::regprocedure;

  -- El contrato de 0071, revalidado acá: esta migración reescribe esa misma
  -- función y copiar la versión de 0068 lo revierte sin que nada más lo note.
  if v_body like '%d >= ps.paused_from%' then
    raise exception '0072: se copió la version de 0068 — la pausa vuelve a comerse su dia de apertura y un plan de tres genera una cuarta cuota';
  end if;
  if v_body not like '%d > ps.paused_from%' then
    raise exception '0072: la funcion dejo de acotar las pausas por paused_from';
  end if;

  -- Y el agregado propio: sin esto la migración es un no-op silencioso.
  if v_body not like '%due_date > p_today%' then
    raise exception '0072: la funcion no cuenta los vencimientos resueltos por anticipado';
  end if;
end $selfcheck$;

commit;
