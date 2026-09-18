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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · settlement_is_live — qué liquidación protege algo, en un solo lugar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Las dos guardas de 0049 preguntan lo mismo y hasta ahora no preguntaban NADA
-- sobre el estado de la liquidación: cero referencias a `s.status`. Eso dejaba
-- bloqueando dos filas que no protegen ningún saldo, y convertía en falso el
-- único consejo que las guardas obligan a dar.
--
-- `reverse_settlement` (0044) CONSERVA la original marcada `reversed` y ADEMÁS
-- inserta un contraasiento cuya pata de pagador está fechada **el día de la
-- reversión**. Con el predicado viejo, entonces, revertir no destrababa nada y
-- encima agregaba un bloqueo más nuevo que cualquier gasto del pasado: al usuario
-- se le pedía hacer algo irreversible que lo dejaba igual de trabado, o peor.
--
-- Qué sigue siendo vigente, y por qué:
--
--   completed        Saldó deuda. Protege.
--   pending_receipt  La plata YA SALIÓ de la cuenta del pagador (0023/0043); que
--                    el receptor no haya asignado la suya no la vuelve inofensiva.
--   reversed SIN su contraasiento  Estado a medio escribir. Se protege por
--                    conservador: no se puede afirmar que sumó cero.
--
-- Qué deja de serlo:
--
--   reversed CON su contraasiento  «Correctamente revertida». El par suma cero.
--   contra                         Es el neteo, no un saldo. Y su fecha es la de
--                                  la reversión, así que dejarlo adentro bloquea
--                                  todo el pasado para siempre.
--
-- ESTO NO CAMBIA CÓMO SE CALCULA LA DEUDA. El original revertido y su contra
-- siguen contando los dos y siguen cancelándose entre sí (0044). Lo único que
-- cambia es qué considera la guarda que hay para proteger. Confundir las dos
-- cosas —«si no bloquea, que tampoco cuente»— rompe el neteo.
--
-- Vive en una función y no copiada en cada guarda para que las dos no puedan
-- contestar distinto: el requirement del spec las define juntas.

create or replace function public.settlement_is_live(s public.settlement)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select s.status in ('completed', 'pending_receipt')
      or (
        s.status = 'reversed'
        and not exists (
          select 1
            from public.settlement c
           where c.reverses_settlement_id = s.id
             and c.status = 'contra'
        )
      );
$$;

revoke all on function public.settlement_is_live(public.settlement) from public, anon;
grant execute on function public.settlement_is_live(public.settlement) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Las dos guardas de 0049, con el criterio de vigencia
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Copia literal de 0049 con UNA línea agregada en cada predicado. Los triggers
-- NO se recrean: apuntan a estas funciones por nombre y toman la definición
-- nueva, igual que hizo 0049 sobre los de 0043 y 0048.

create or replace function public.trg_fn_block_shared_delete_with_settlement()
returns trigger language plpgsql as $trg$
begin
  -- Only rows that carry debt (splits) can rewrite settled history. Exempts the
  -- installment parent and settlement legs, and keys each row by its own date.
  if OLD.is_shared
     and OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1
         from public.settlement s
         join public.transactions pm on pm.id = s.payer_movement_id
        where s.household_id = OLD.household_id
          and s.currency_code = OLD.currency_code
          and pm.date >= coalesce(OLD.due_date, OLD.date)
          and public.settlement_is_live(s)
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
returns trigger language plpgsql as $trg$
begin
  if OLD.household_id is not null
     and exists (select 1 from public.shared_expense_split where transaction_id = OLD.id)
     and exists (
       select 1
         from public.settlement s
         join public.transactions pm on pm.id = s.payer_movement_id
        where s.household_id = OLD.household_id
          and s.currency_code = OLD.currency_code
          and pm.date >= coalesce(OLD.due_date, OLD.date)
          and public.settlement_is_live(s)
     ) then
    raise exception
      'cannot unshare movement % covered by a later settlement in household %',
      OLD.id, OLD.household_id
      using errcode = 'GRN01';
  end if;
  return NEW;
end;
$trg$;

-- `recurrence_positions_spent_batch` (0070) llama a ésta y NO se toca: hay una
-- sola definición de qué cuenta `max_occurrences`, y el batch es otra forma de
-- preguntarla, no otra forma de calcularla.

revoke all on function public.recurrence_positions_spent(uuid, date) from public, anon;
grant execute on function public.recurrence_positions_spent(uuid, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · La ventana de candidatos, y si un reparto es compatible
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La ventana va DEL VENCIMIENTO ANTERIOR AL SIGUIENTE, derivada del calendario de
-- la regla. Un número fijo de días no sirve: quince dejan afuera el caso que
-- motiva todo esto —pagar el 3 lo que vence el 23— y serían absurdos en una regla
-- semanal.
--
-- Que dos vencimientos consecutivos vean ventanas superpuestas está ACEPTADO: la
-- app no sabe a qué período correspondió un pago y el usuario sí. Un movimiento
-- ya vinculado sale de toda otra lista, así que la superposición no puede
-- resolver dos vencimientos con el mismo gasto.

create or replace function public.recurrence_step_interval(
  p_interval_unit  text,
  p_interval_count int
)
returns interval
language sql
immutable
as $$
  select case p_interval_unit
           when 'day'   then make_interval(days   => p_interval_count)
           when 'week'  then make_interval(weeks  => p_interval_count)
           when 'month' then make_interval(months => p_interval_count)
           when 'year'  then make_interval(years  => p_interval_count)
         end;
$$;

-- LA VENTANA Y LA PERTENENCIA SALEN DEL CALENDARIO REAL, no de `p_date ±
-- intervalo`. Esa aritmética ignora dos cosas que el calendario sí sabe: que la
-- regla pudo cambiar de frecuencia (el vencimiento anterior cae bajo OTRA versión
-- del cronograma) y que una pausa se come posiciones (el «anterior» está más
-- atrás de lo que dice el intervalo). Acá se enumeran las posiciones de cada
-- versión dentro de su propio tramo, se restan las pausas con la misma lectura
-- que 0071 —la pausa cubre los días DESPUÉS de `paused_from`— y se toman los
-- vecinos de ese conjunto.
--
-- `is_occurrence` dice si `p_date` es una posición REAL de la regla. Sin este
-- chequeo, vincular o registrar a cualquier fecha crearía una ocurrencia con
-- una identidad que el calendario nunca produce — y con el conteo nuevo, una
-- fecha fantasma resuelta gastaría una posición del límite.
--
-- La semilla no es vinculable: ya la cubre el movimiento que creó la regla.

create or replace function public.recurrence_calendar_around(
  p_id     uuid,
  p_date   date,
  p_before int default 1,
  p_after  int default 1
)
returns table (is_occurrence boolean, lo date, hi date)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule   public.recurrences;
  v_cover  public.recurrence_schedule_versions;
  v_step   interval;
  v_reach  date;
  v_before int := greatest(p_before, 1);
  v_after  int := greatest(p_after, 1);
begin
  select * into v_rule from public.recurrences where id = p_id;
  if not found then
    return;
  end if;

  -- La versión vigente en `p_date`; si ninguna empezó todavía, la primera.
  select * into v_cover
    from public.recurrence_schedule_versions v
   where v.recurrence_id = p_id and v.effective_from <= p_date
   order by v.effective_from desc
   limit 1;
  if not found then
    select * into v_cover
      from public.recurrence_schedule_versions v
     where v.recurrence_id = p_id
     order by v.effective_from
     limit 1;
  end if;
  if not found then
    return query select false, p_date, p_date;
    return;
  end if;

  v_step  := public.recurrence_step_interval(v_cover.interval_unit, v_cover.interval_count);
  -- Hasta dónde hace falta enumerar para tener `p_after` vecinos por delante.
  v_reach := (p_date + v_step * (v_after + 1))::date;

  return query
  with positions as (
    select (v.anchor_date + (public.recurrence_step_interval(v.interval_unit, v.interval_count) * n))::date as d,
           v.effective_from,
           v.effective_until
      from public.recurrence_schedule_versions v
      cross join lateral generate_series(
        0,
        -- Mismo acotamiento que recurrence_positions_spent: días hasta el
        -- alcance, divididos por el largo mínimo del paso, más margen.
        (case v.interval_unit
           when 'day'   then greatest(0, v_reach - v.anchor_date) / v.interval_count
           when 'week'  then greatest(0, v_reach - v.anchor_date) / (v.interval_count * 7)
           when 'month' then greatest(0, v_reach - v.anchor_date) / (v.interval_count * 28)
           when 'year'  then greatest(0, v_reach - v.anchor_date) / (v.interval_count * 365)
         end) + 2
      ) n
     where v.recurrence_id = p_id
  ), real as (
    select distinct p.d
      from positions p
     where p.d >= p.effective_from
       and (p.effective_until is null or p.d <= p.effective_until)
       and (v_rule.end_date is null or p.d <= v_rule.end_date)
       and (v_rule.seed_occurrence_date is null or p.d <> v_rule.seed_occurrence_date)
       and not exists (
         select 1 from public.recurrence_pauses ps
          where ps.recurrence_id = p_id
            and p.d > ps.paused_from
            and (ps.resumed_at is null or p.d < ps.resumed_at)
       )
  )
  select
    exists (select 1 from real r where r.d = p_date),
    coalesce(
      (select r.d from real r where r.d < p_date order by r.d desc offset v_before - 1 limit 1),
      -- Sin vencimiento anterior (es el PRIMERO de la regla): un paso hacia atrás
      -- por cada vecino pedido, igual que hacia adelante cuando no hay siguiente.
      -- No `start_date`: en una regla nueva coincide con el primer vencimiento, y
      -- la ventana no llegaría al pago del 3 de algo que vence el 23 — el caso
      -- que motiva todo esto.
      (p_date - v_step * v_before)::date
    ),
    coalesce(
      (select r.d from real r where r.d > p_date order by r.d asc offset v_after - 1 limit 1),
      -- Sin vencimiento siguiente (último de un plan con tope): un paso más.
      (p_date + v_step * v_after)::date
    );
end $$;

-- ¿SE PUEDE RESOLVER ESTE VENCIMIENTO? Una sola respuesta para los DOS caminos
-- —vincular (RPC) y registrar por anticipado (desde la app)— para que no puedan
-- contestar distinto. Devuelve NULL si se puede, o el código del motivo:
--
--   not_an_occurrence  no es una posición del calendario, está pausada, o es la
--                      semilla
--   beyond_limit       la regla ya gastó todas las posiciones de su tope antes
--                      de esta fecha
--   already_resolved   ya hay una ocurrencia resuelta con esa identidad
--
-- El tope se pregunta a `recurrence_positions_spent` —el conteo normativo— y no
-- a una copia: las posiciones gastadas ANTES de `p_date` son las que esa función
-- cuenta hasta el día anterior, menos las resueltas por anticipado que ella suma
-- y que acá no cuentan (están después). Si eso ya llega al tope, `p_date` sería
-- la posición de más. Se pregunta al día anterior y no a `p_date` a propósito:
-- la función satura en el tope, y preguntada en la fecha de la posición de más
-- devolvería el tope igual y la dejaría pasar.

create or replace function public.recurrence_admits_occurrence(
  p_id   uuid,
  p_date date
)
returns text
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule         public.recurrences;
  v_is_occ       boolean;
  v_spent_before int;
begin
  select * into v_rule from public.recurrences where id = p_id;
  if not found then
    return 'not_an_occurrence';
  end if;

  if exists (
    select 1 from public.recurrence_instances i
     where i.recurrence_id = p_id and i.due_date = p_date and i.status <> 'pending'
  ) then
    return 'already_resolved';
  end if;

  select a.is_occurrence into v_is_occ
    from public.recurrence_calendar_around(p_id, p_date, 0, 0) a;
  if not coalesce(v_is_occ, false) then
    return 'not_an_occurrence';
  end if;

  if v_rule.max_occurrences is not null then
    select public.recurrence_positions_spent(p_id, p_date - 1)
         - (select count(distinct i.due_date)::int
              from public.recurrence_instances i
             where i.recurrence_id = p_id
               and i.status in ('confirmed', 'skipped')
               and i.due_date is not null
               and i.due_date > p_date - 1
               and (v_rule.seed_occurrence_date is null or i.due_date <> v_rule.seed_occurrence_date))
      into v_spent_before;
    if coalesce(v_spent_before, 0) >= v_rule.max_occurrences then
      return 'beyond_limit';
    end if;
  end if;

  return null;
end $$;

-- Un reparto es compatible cuando es el MISMO hogar y los MISMOS porcentajes por
-- miembro. Se compara como conjunto, no como texto: el orden del jsonb no es
-- significativo y compararlo como string haría incompatible un reparto idéntico
-- escrito al revés.
create or replace function public.recurrence_split_matches(
  p_transaction_id uuid,
  p_default_split  jsonb
)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select not exists (
    (select (s.user_id)::text as u, s.percentage::numeric as p
       from public.shared_expense_split s
      where s.transaction_id = p_transaction_id
     except
     select d.value ->> 'user_id', (d.value ->> 'percentage')::numeric
       from jsonb_array_elements(coalesce(p_default_split, '[]'::jsonb)) d)
    union all
    (select d.value ->> 'user_id', (d.value ->> 'percentage')::numeric
       from jsonb_array_elements(coalesce(p_default_split, '[]'::jsonb)) d
     except
     select (s.user_id)::text, s.percentage::numeric
       from public.shared_expense_split s
      where s.transaction_id = p_transaction_id)
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · recurrence_link_candidates — qué movimientos se pueden ofrecer
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Es un RPC y no un `.select()` porque la lista necesita tres cosas que PostgREST
-- no da bien juntas: un NOT EXISTS («no vinculado a NINGUNA ocurrencia»), la
-- ventana derivada del calendario, y el orden por proximidad. Y porque un select
-- de filas de detalle queda recortado en silencio por `max-rows`: acá eso no
-- produce un número mal, produce UN CANDIDATO QUE NO APARECE — el usuario
-- concluye que su movimiento no está y lo carga de nuevo, que es exactamente el
-- duplicado que este change existe para evitar.
--
-- EL MONTO Y LA CUENTA ORDENAN, NO EXCLUYEN. Un alquiler que aumentó es el caso
-- en que el usuario más necesita encontrar su movimiento, y filtrar por importe
-- lo esconde justo ahí.

create or replace function public.recurrence_link_candidates(
  p_recurrence_id uuid,
  p_due_date      date,
  p_widen         boolean default false
)
returns table (
  id            uuid,
  date          date,
  amount        numeric,
  currency_code text,
  account_id    uuid,
  description   text,
  category_id   uuid,
  is_shared     boolean,
  needs_conversion boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with rule as (
    select * from public.recurrences
     where id = p_recurrence_id and user_id = auth.uid()
  ), win as (
    -- Del vencimiento ANTERIOR al SIGUIENTE, tomados del calendario real.
    -- Ampliar lleva tres vecinos para cada lado.
    select a.lo, a.hi, r.*
      from rule r
      cross join lateral public.recurrence_calendar_around(
        r.id, p_due_date,
        case when p_widen then 3 else 1 end,
        case when p_widen then 3 else 1 end
      ) a
  )
  select t.id, t.date, t.amount, t.currency_code, t.account_id, t.description,
         t.category_id, t.is_shared,
         (w.household_id is not null and not t.is_shared) as needs_conversion
    from public.transactions t
   cross join win w
   where t.user_id = auth.uid()
     -- Mismo tipo funcional y misma moneda: vincular un ingreso a una regla de
     -- gasto haría que el historial afirme algo falso.
     and t.type = w.movement_type
     and t.currency_code = w.currency_code
     -- La madre de cuotas no es un movimiento que alguien haya pagado.
     and coalesce(t.is_parent, false) = false
     -- Los tipos que no son movimientos del usuario en este sentido.
     and t.type not in ('settlement', 'reimbursement')
     and t.date >= w.lo::date
     and t.date <= w.hi::date
     -- NO VINCULADO A NINGUNA OCURRENCIA, de ninguna regla.
     and not exists (
       select 1 from public.recurrence_instances i
        where i.confirmed_transaction_id = t.id
     )
     -- Un movimiento ya compartido con otro hogar u otro reparto NO se ofrece
     -- (decisión 13 de fix-recurrence-backlog): pisarlo destruiría una deuda que
     -- el otro miembro ya ve, y deshacerlo exigiría restaurar un estado
     -- compartido arbitrario. Excluirlo cuesta un candidato menos en una lista.
     and (
       w.household_id is null
       or not t.is_shared
       or (
         t.household_id = w.household_id
         and public.recurrence_split_matches(t.id, w.default_split)
       )
     )
   order by
     -- Misma cuenta primero, después importe más parecido, después fecha más
     -- cercana al vencimiento.
     (t.account_id is distinct from w.account_id),
     abs(t.amount - w.amount),
     abs(t.date - p_due_date),
     t.id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · recurrence_link_movement — vincular, y convertir si corresponde
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Toma la REGLA y el VENCIMIENTO, no una fila de ocurrencia: el vencimiento puede
-- no estar materializado todavía (vincular desde el hub una fecha que aún no
-- llegó), y en los dos casos el resultado tiene que ser el mismo.
--
-- LA CONVERSIÓN Y LA VINCULACIÓN SON UNA SOLA OPERACIÓN. Un movimiento convertido
-- a compartido pero no vinculado deja la deuda del hogar movida por algo que el
-- usuario no aprobó. La atomicidad la da la transacción, no un rollback
-- compensatorio: la compensación también puede fallar, y el estado que deja es
-- precisamente el que esto prohíbe (decisión 22 de fix-recurrence-backlog).

create or replace function public.recurrence_link_movement(
  p_recurrence_id      uuid,
  p_due_date           date,
  p_transaction_id     uuid,
  p_confirm_conversion boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_rule       public.recurrences;
  v_tx         public.transactions;
  v_converted  boolean := false;
  v_instance   uuid;
  v_split      jsonb;
  v_reason     text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'GRN10';
  end if;

  select * into v_rule from public.recurrences
   where id = p_recurrence_id and user_id = v_uid for update;
  if not found then
    raise exception 'rule_not_found' using errcode = 'GRN10';
  end if;
  if v_rule.status = 'deleted' then
    raise exception 'rule_deleted' using errcode = 'GRN10';
  end if;

  select * into v_tx from public.transactions
   where id = p_transaction_id and user_id = v_uid for update;
  if not found then
    raise exception 'movement_not_found' using errcode = 'GRN10';
  end if;

  if v_tx.type <> v_rule.movement_type or v_tx.currency_code <> v_rule.currency_code then
    raise exception 'movement_incompatible' using errcode = 'GRN11';
  end if;

  -- Un movimiento resuelve UN vencimiento. Sin esto, el mismo gasto podría saldar
  -- dos meses y la regla parecería al día con la mitad de los pagos.
  if exists (select 1 from public.recurrence_instances i
              where i.confirmed_transaction_id = p_transaction_id) then
    raise exception 'movement_already_linked' using errcode = 'GRN12';
  end if;

  -- ── Compartido: las tres ramas de la decisión 13 ─────────────────────────
  if v_rule.household_id is not null then
    if v_tx.is_shared then
      if v_tx.household_id is distinct from v_rule.household_id
         or not public.recurrence_split_matches(v_tx.id, v_rule.default_split) then
        raise exception 'movement_shared_elsewhere' using errcode = 'GRN13';
      end if;
      -- Reparto compatible: se vincula sin tocar nada.
    else
      -- Personal: se convierte, pero SÓLO con confirmación explícita. Esto mueve
      -- la deuda del hogar, y nadie puede descubrirlo después de que pasó.
      if not p_confirm_conversion then
        raise exception 'conversion_not_confirmed' using errcode = 'GRN14';
      end if;

      update public.transactions
         set is_shared = true, household_id = v_rule.household_id
       where id = v_tx.id;

      for v_split in
        select value from jsonb_array_elements(v_rule.default_split)
      loop
        insert into public.shared_expense_split
          (transaction_id, household_id, user_id, percentage, amount_assigned)
        values (
          v_tx.id, v_rule.household_id, (v_split ->> 'user_id')::uuid,
          (v_split ->> 'percentage')::numeric,
          round(v_tx.amount * (v_split ->> 'percentage')::numeric / 100, 2)
        )
        on conflict (transaction_id, user_id) do update
          set percentage = excluded.percentage,
              amount_assigned = excluded.amount_assigned;
      end loop;

      -- El resto por diferencia, a la primera parte: la suma de los splits tiene
      -- que dar el total exacto o el invariante diferido rechaza el commit.
      update public.shared_expense_split s
         set amount_assigned = s.amount_assigned + (
               v_tx.amount - (select sum(x.amount_assigned)
                                from public.shared_expense_split x
                               where x.transaction_id = v_tx.id)
             )
       where s.transaction_id = v_tx.id
         and s.user_id = (select (value ->> 'user_id')::uuid
                            from jsonb_array_elements(v_rule.default_split)
                           limit 1);

      v_converted := true;
    end if;
  end if;

  -- ── La ocurrencia ────────────────────────────────────────────────────────
  --
  -- `resolution_kind = 'linked'` se escribe EXPLÍCITAMENTE: el trigger de
  -- compatibilidad de 0064 pone 'created' a toda confirmación que no lo declare,
  -- y esa distinción es la que decide qué hace deshacer.
  update public.recurrence_instances
     set status = 'confirmed',
         confirmed_transaction_id = p_transaction_id,
         resolution_kind = 'linked',
         linked_conversion = v_converted,
         resolved_at = now()
   where recurrence_id = p_recurrence_id
     and due_date = p_due_date
     and user_id = v_uid
     and status = 'pending'
   returning id into v_instance;

  if v_instance is null then
    -- VALIDAR EL VENCIMIENTO ANTES DE CREARLE UNA IDENTIDAD. Un `p_due_date` que
    -- el calendario no produce dejaría una ocurrencia fantasma, y con el conteo
    -- nuevo esa ocurrencia resuelta gastaría una posición del límite.
    v_reason := public.recurrence_admits_occurrence(p_recurrence_id, p_due_date);
    if v_reason is not null then
      raise exception '%', v_reason
        using errcode = case v_reason
                          when 'beyond_limit'     then 'GRN17'
                          when 'already_resolved' then 'GRN18'
                          else                         'GRN16'
                        end;
    end if;

    insert into public.recurrence_instances
      (recurrence_id, user_id, due_date, scheduled_date, status,
       confirmed_transaction_id, resolution_kind, linked_conversion, resolved_at,
       amount, account_id, transfer_destination_account_id, currency_code,
       category_id, subcategory_id, description, household_id, split)
    values
      (p_recurrence_id, v_uid, p_due_date, p_due_date, 'confirmed',
       p_transaction_id, 'linked', v_converted, now(),
       v_tx.amount, v_tx.account_id, v_rule.transfer_destination_account_id,
       v_tx.currency_code, v_tx.category_id, v_tx.subcategory_id, v_tx.description,
       v_rule.household_id, v_rule.default_split)
    returning id into v_instance;
  end if;

  return v_instance;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · recurrence_unlink_movement — desvincular, todo o nada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- NO ATRAPA `GRN01`. Si la guarda de liquidaciones rechaza devolver el gasto a
-- personal, la transacción entera falla y NADA cambia.
--
-- Soltar el vínculo igual y dejar el gasto compartido sería un deshacer parcial:
-- la vinculación equivocada convirtió un gasto personal en deuda para la otra
-- persona, y corregir sólo lo que el usuario ve conserva lo que le cuesta plata a
-- alguien más, sin que nadie vuelva a mirarlo. El usuario cree que deshizo y no
-- deshizo.
--
-- Es también la razón de que no haya un bloque EXCEPTION: `trg_no_splits_when_unshared`
-- (0048) es `deferrable initially deferred` y se evalúa recién en el COMMIT, así
-- que un EXCEPTION sólo alcanzaría a una de las dos guardas y simularía una
-- recuperación que no ocurrió.

create or replace function public.recurrence_unlink_movement(p_instance_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_instance public.recurrence_instances;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'GRN10';
  end if;

  select * into v_instance from public.recurrence_instances
   where id = p_instance_id and user_id = v_uid for update;
  if not found then
    raise exception 'instance_not_found' using errcode = 'GRN10';
  end if;

  -- Desvincular se ofrece SÓLO sobre lo que el usuario vinculó. Deshacer un pago
  -- que la recurrencia creó significa borrar ese movimiento, que es otra
  -- operación y tiene su propio alcance (#104).
  if v_instance.resolution_kind is distinct from 'linked' then
    raise exception 'not_linked' using errcode = 'GRN15';
  end if;

  -- Si vincular convirtió el movimiento, desvincular revierte la conversión. Si
  -- ya era compartido, no hubo conversión y no hay nada que revertir.
  if v_instance.linked_conversion then
    perform public.unshare_movement(v_instance.confirmed_transaction_id);
  end if;

  update public.recurrence_instances
     set status = 'pending',
         confirmed_transaction_id = null,
         resolution_kind = null,
         linked_conversion = false,
         resolved_at = null
   where id = p_instance_id;
end $$;

revoke all on function public.recurrence_step_interval(text, int) from public, anon;
revoke all on function public.recurrence_calendar_around(uuid, date, int, int) from public, anon;
revoke all on function public.recurrence_admits_occurrence(uuid, date) from public, anon;
revoke all on function public.recurrence_split_matches(uuid, jsonb) from public, anon;
revoke all on function public.recurrence_link_candidates(uuid, date, boolean) from public, anon;
revoke all on function public.recurrence_link_movement(uuid, date, uuid, boolean) from public, anon;
revoke all on function public.recurrence_unlink_movement(uuid) from public, anon;
grant execute on function public.recurrence_step_interval(text, int) to authenticated;
grant execute on function public.recurrence_calendar_around(uuid, date, int, int) to authenticated;
grant execute on function public.recurrence_admits_occurrence(uuid, date) to authenticated;
grant execute on function public.recurrence_split_matches(uuid, jsonb) to authenticated;
grant execute on function public.recurrence_link_candidates(uuid, date, boolean) to authenticated;
grant execute on function public.recurrence_link_movement(uuid, date, uuid, boolean) to authenticated;
grant execute on function public.recurrence_unlink_movement(uuid) to authenticated;


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

  -- Las funciones nuevas existen, con su firma exacta. Una firma distinta no
  -- rompe nada al aplicar y falla recién cuando el cliente la llama.
  if to_regprocedure('public.settlement_is_live(public.settlement)') is null then
    raise exception '0072: settlement_is_live falta';
  end if;
  if to_regprocedure('public.recurrence_link_candidates(uuid, date, boolean)') is null then
    raise exception '0072: recurrence_link_candidates falta';
  end if;
  if to_regprocedure('public.recurrence_link_movement(uuid, date, uuid, boolean)') is null then
    raise exception '0072: recurrence_link_movement falta';
  end if;
  if to_regprocedure('public.recurrence_unlink_movement(uuid)') is null then
    raise exception '0072: recurrence_unlink_movement falta';
  end if;
  if to_regprocedure('public.recurrence_calendar_around(uuid, date, int, int)') is null then
    raise exception '0072: recurrence_calendar_around falta';
  end if;
  if to_regprocedure('public.recurrence_admits_occurrence(uuid, date)') is null then
    raise exception '0072: recurrence_admits_occurrence falta';
  end if;

  -- Vincular valida el vencimiento antes de crearle una identidad. Sin esto una
  -- fecha que el calendario no produce queda como ocurrencia fantasma.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_movement(uuid, date, uuid, boolean)'::regprocedure)
       not like '%recurrence_admits_occurrence%' then
    raise exception '0072: recurrence_link_movement no valida el vencimiento';
  end if;
  -- Y la ventana de candidatos sale del calendario real, no de una aritmetica.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_candidates(uuid, date, boolean)'::regprocedure)
       not like '%recurrence_calendar_around%' then
    raise exception '0072: recurrence_link_candidates no toma la ventana del calendario';
  end if;

  -- Las dos guardas comparten el criterio de vigencia. Corregir una sola deja el
  -- sistema contestando distinto a dos preguntas que el spec define juntas.
  if (select prosrc from pg_proc
       where oid = 'public.trg_fn_block_unshare_with_settlement()'::regprocedure)
       not like '%settlement_is_live%' then
    raise exception '0072: la guarda de descompartir no usa el criterio de vigencia';
  end if;
  if (select prosrc from pg_proc
       where oid = 'public.trg_fn_block_shared_delete_with_settlement()'::regprocedure)
       not like '%settlement_is_live%' then
    raise exception '0072: la guarda de borrado no usa el criterio de vigencia';
  end if;

  -- Vincular tiene que escribir 'linked' EXPLÍCITAMENTE: el trigger de
  -- compatibilidad de 0064 pone 'created' a toda confirmación que no lo declare,
  -- y esa distinción es la que decide si deshacer borra un movimiento del usuario.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_link_movement(uuid, date, uuid, boolean)'::regprocedure)
       not like '%''linked''%' then
    raise exception '0072: recurrence_link_movement no marca la resolucion como vinculada';
  end if;

  -- Y desvincular NO puede atrapar GRN01: hacerlo convierte «las dos cosas o
  -- ninguna» en un deshacer parcial que conserva la deuda.
  if (select prosrc from pg_proc
       where oid = 'public.recurrence_unlink_movement(uuid)'::regprocedure)
       like '%exception%when%GRN01%' then
    raise exception '0072: desvincular atrapa GRN01 y dejaria el gasto compartido';
  end if;
end $selfcheck$;

commit;
