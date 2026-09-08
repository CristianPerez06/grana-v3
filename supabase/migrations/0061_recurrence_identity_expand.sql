-- Recurrencias — expansión del modelo de identidad de ocurrencia.
--
-- Run AFTER 0060_available_sums_initial_balance.sql.
--
-- Change: openspec/changes/fix-recurrence-backlog/
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ESTA MIGRACIÓN NO CAMBIA NINGÚN COMPORTAMIENTO.
--
-- Es la mitad "expansión" de un par expansión/activación (design.md, decisión
-- 17). Agrega columnas y tablas, hace el backfill e instala un trigger de
-- compatibilidad — pero deja vivo el índice `recurrence_instances_one_pending_
-- per_rule`, así que la app sigue viendo exactamente una ocurrencia pendiente
-- por regla, igual que hoy.
--
-- El backlog se habilita en 00XY_recurrence_backlog_activate.sql, DESPUÉS de
-- desplegar web y nativo con el modelo nuevo. El orden importa: sacar el índice
-- antes del despliegue dejaría a la base acumulando atraso mientras la app
-- sigue mostrando una sola ocurrencia — invisible, y peor que el bug actual.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Qué agrega, y por qué cada cosa:
--
--   due_date            La identidad de la ocurrencia. Hoy `scheduled_date` hace
--                       de identidad y de fecha del movimiento a la vez, y al
--                       confirmar se PISA con la fecha que el usuario elige
--                       (mutations.ts), así que la ocurrencia pierde su
--                       vencimiento original. Con backlog eso además impide
--                       identificarla.
--
--   resolution_kind     Cómo se resolvió: `created` (la recurrencia creó el
--   linked_conversion   movimiento) o `linked` (el usuario vinculó uno suyo).
--                       Deshacer hace cosas distintas en cada caso: eliminar vs
--                       conservar. `linked_conversion` marca si al vincular se
--                       convirtió un movimiento personal en compartido, para
--                       poder revertir esa conversión.
--
--   reconstruct_from    Hasta dónde hacia atrás puede reconstruir el generador.
--                       Política conservadora (decisión 21): NO reconstruir
--                       nada anterior al último punto conocido, porque no hay
--                       historial de ediciones de cronograma ni de pausas y
--                       suponerlo fabrica atraso que quizá nunca existió.
--
--   schedule_versions   El cronograma a lo largo del tiempo. Un cambio de
--                       frecuencia rige desde una fecha y no reinterpreta el
--                       pasado; sin esto, el generador leería el calendario
--                       viejo como huecos.
--
--   pauses              Los intervalos de pausa. Un vencimiento que cae durante
--                       una pausa no existe y no se recupera al reanudar; sin
--                       el intervalo persistido, el período pausado también se
--                       lee como huecos.
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor,
-- then regenerate types. The whole migration runs in one transaction.

begin;

-- El "hoy" de referencia. `current_date` a secas está PROHIBIDO: Supabase corre
-- en UTC y la app cierra el día en horario argentino.
create temporary table _migration_today on commit drop as
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · due_date — la identidad de la ocurrencia
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El punto de partida es `scheduled_date`, pero NO es igual de confiable según
-- el estado, y decir "se deriva del cronograma" a secas sería falso:
--
--   pending   EXACTO. Nada lo pisó: el generador lo escribió y nadie más.
--   skipped   EXACTO. `skipRecurrenceInstance` solo toca `status` y
--             `resolved_at` — el vencimiento sobrevive intacto.
--   confirmed SOSPECHOSO. `confirmRecurrenceInstance` escribe
--             `scheduled_date = payload.date ?? instance.scheduled_date`, así
--             que si el usuario cambió la fecha al confirmar, lo que hoy hay
--             guardado es la FECHA DE PAGO, no el vencimiento.
--
-- Para las confirmadas no hay un campo que delate la sobrescritura: confirmar
-- pone la misma fecha en la instancia y en la transacción, así que compararlas
-- no dice nada. Lo que SÍ se puede comprobar es si la fecha cae sobre el
-- cronograma de la regla: si no cae, fue pisada, y el vencimiento original es
-- irrecuperable — no quedó registrado en ningún lado.
--
-- Política: se conserva la fecha como aproximación histórica y se MARCA como
-- tal (`due_date_is_approximate`). No se aborta —esos datos son legítimamente
-- irrecuperables y abortar dejaría la migración bloqueada para siempre— y no se
-- presenta como un vencimiento exacto en ninguna pantalla.

alter table public.recurrence_instances
  add column due_date              DATE,
  add column due_date_is_approximate BOOLEAN NOT NULL DEFAULT false;

-- ¿Cae `d` sobre el cronograma que arranca en `start_date` cada
-- `interval_count` `interval_unit`? Reproduce el clamping de fin de mes del
-- caminante (31-ene + 1 mes ⇒ 28/29-feb, y el día original vuelve después).
create or replace function public.recurrence_date_on_schedule(
  p_start          DATE,
  p_interval_count INT,
  p_interval_unit  TEXT,
  p_date           DATE
) returns BOOLEAN
language sql immutable
as $$
  select case p_interval_unit
    when 'day'  then (p_date - p_start) % p_interval_count = 0
    when 'week' then (p_date - p_start) % (p_interval_count * 7) = 0
    when 'month' then
      ( ((extract(year from p_date) - extract(year from p_start)) * 12
         + (extract(month from p_date) - extract(month from p_start)))::int
        % p_interval_count = 0 )
      and extract(day from p_date) = least(
            extract(day from p_start),
            extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))
          )
    when 'year' then
      ( (extract(year from p_date) - extract(year from p_start))::int
        % p_interval_count = 0 )
      and extract(month from p_date) = extract(month from p_start)
      and extract(day from p_date) = least(
            extract(day from p_start),
            extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))
          )
    else false
  end
$$;

update public.recurrence_instances i
   set due_date = i.scheduled_date,
       due_date_is_approximate = (
         i.status = 'confirmed'
         and not public.recurrence_date_on_schedule(
               r.start_date, r.interval_count, r.interval_unit, i.scheduled_date)
       )
  from public.recurrences r
 where r.id = i.recurrence_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Política de colisiones: abortar con informe, nunca adivinar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dos instancias de la misma regla pueden haber quedado con el mismo
-- `scheduled_date` si una se confirmó con la fecha de otra. Resolver cuál
-- corresponde a qué vencimiento es caso por caso y ninguna regla automática lo
-- acierta; un `due_date` mal asignado es un movimiento atribuido al mes
-- equivocado, y se descubre meses después. Abortar es barato.

do $$
declare
  colision record;
  informe  text := '';
  total    int  := 0;
begin
  for colision in
    select recurrence_id, due_date, count(*) as n,
           string_agg(id::text || ' (' || status || ')', ', ' order by created_at) as instancias
      from public.recurrence_instances
     group by recurrence_id, due_date
    having count(*) > 1
  loop
    total := total + 1;
    informe := informe || format(
      E'\n  regla %s · vencimiento %s · %s instancias: %s',
      colision.recurrence_id, colision.due_date, colision.n, colision.instancias
    );
  end loop;

  if total > 0 then
    raise exception E'Backfill de due_date abortado: % vencimiento(s) con más de una instancia.%\n\nResolver a mano cuál instancia corresponde a cada vencimiento, y volver a correr.',
      total, informe;
  end if;
end $$;

alter table public.recurrence_instances
  alter column due_date set not null;

create unique index recurrence_instances_one_per_rule_due_date
  on public.recurrence_instances (recurrence_id, due_date);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · Cómo se resolvió la ocurrencia
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `skipped` lleva `resolution_kind = NULL`: omitir resuelve sin movimiento, así
-- que no hay nada que deshacer ni forma de deshacerlo.
--
-- Las constraints van EN ESTA MIGRACIÓN, después del trigger del paso 7. Una
-- versión anterior las postergaba a la activación por miedo a que un cliente
-- viejo las violara al confirmar — pero el trigger completa `resolution_kind`
-- antes de que la constraint se evalúe (BEFORE trigger → CHECK), así que la
-- incompatibilidad no existe. Postergarlas solo dejaría la base sin proteger
-- durante toda la transición.

alter table public.recurrence_instances
  add column resolution_kind   TEXT    NULL,
  add column linked_conversion BOOLEAN NOT NULL DEFAULT false;

-- Hasta hoy la única forma de resolver con movimiento era creándolo.
update public.recurrence_instances
   set resolution_kind = 'created'
 where status = 'confirmed';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · reconstruct_from — el piso de la reconstrucción
-- ═══════════════════════════════════════════════════════════════════════════
--
-- El generador nunca materializa antes de GREATEST(reconstruct_from, horizonte).
--
--   activas   `last_generated_date` es, por definición, "hasta acá ya está
--             cubierto". Reconstruir antes propondría de nuevo ocurrencias que
--             la regla ya dio por resueltas.
--   pausadas  la fecha de la migración. No sabemos desde cuándo están pausadas,
--             y cualquier fecha anterior haría aparecer como atraso los períodos
--             de la pausa al reanudarlas — lo que la decisión 16 prohíbe.
--
-- Contrato, y conviene ser exacto porque una versión anterior de este comentario
-- lo decía al revés: `reconstruct_from` es el ÚLTIMO PUNTO CONOCIDO, y las
-- ocurrencias POSTERIORES a él, dentro del horizonte, SÍ se reconstruyen —
-- descontando las instancias que ya existan.
--
-- Eso ES el arreglo del #96, y tiene que serlo. En el caso del ticket el cursor
-- quedó clavado en junio con una pendiente sin resolver que no lo avanzó; al
-- reconstruir desde ahí, la de junio ya existe y se deduplica, pero julio,
-- agosto y septiembre aparecen. Si esto no reconstruyera hacia atrás, el bug
-- seguiría vivo.
--
-- Lo que NO se reconstruye es lo anterior al cursor: eso la regla ya lo dio por
-- cubierto. Y en las pausadas no se reconstruye nada previo a la migración,
-- porque no sabemos desde cuándo están pausadas.

alter table public.recurrences
  add column reconstruct_from DATE;

update public.recurrences r
   set reconstruct_from = case
         when r.status = 'paused' then (select d from _migration_today)
         else coalesce(r.last_generated_date, r.start_date)
       end;

alter table public.recurrences
  alter column reconstruct_from set not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · recurrence_schedule_versions — el cronograma a lo largo del tiempo
-- ═══════════════════════════════════════════════════════════════════════════

-- La FK compuesta de abajo necesita esta clave candidata. `id` ya es PK; esto
-- solo declara que (id, user_id) también identifica una fila, para que las
-- tablas hijas puedan exigir que la regla y el dueño coincidan.
alter table public.recurrences
  add constraint recurrences_id_user_unique UNIQUE (id, user_id);

create table public.recurrence_schedule_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id  UUID        NOT NULL,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Desde cuándo rige ESTA versión. Para la que crea la migración es
  -- `reconstruct_from`, NO `start_date`: no sabemos qué cronograma corrió antes
  -- del último punto conocido, y afirmar que el actual rigió desde el principio
  -- haría que el caminante produzca fechas que la regla nunca produjo.
  effective_from DATE        NOT NULL,
  interval_count INT         NOT NULL,
  interval_unit  TEXT        NOT NULL,
  -- Ancla del CLAMPING de fin de mes, no una afirmación sobre cuándo empezó el
  -- cronograma: es lo que hace que una regla del 31 vuelva al 31 después de
  -- febrero. Se conserva en `start_date` porque es exactamente lo que hace hoy
  -- el generador (`addInterval(cursor, unit, count, { anchorDate: start_date })`),
  -- así que la versión asumida reproduce el comportamiento actual sin inventar.
  anchor_date    DATE        NOT NULL,
  -- true ⇒ la creó esta migración. Significa: no sabemos qué cronograma rigió
  -- antes de `effective_from`. Las versiones que cree el usuario al editar no
  -- llevan la marca.
  is_assumed     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_schedule_versions_interval_unit
    CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  CONSTRAINT chk_schedule_versions_interval_count_positive
    CHECK (interval_count > 0),

  -- Con dos FK independientes (regla por un lado, usuario por otro) y un RLS que
  -- solo mira `user_id = auth.uid()`, la base aceptaría una fila con MI usuario y
  -- la recurrencia de OTRO. La FK compuesta lo hace imposible, y no depende de
  -- que la política RLS se acuerde de comprobarlo.
  CONSTRAINT recurrence_schedule_versions_recurrence_fk
    FOREIGN KEY (recurrence_id, user_id)
    REFERENCES public.recurrences(id, user_id) ON DELETE CASCADE
);

create unique index recurrence_schedule_versions_one_per_date
  on public.recurrence_schedule_versions (recurrence_id, effective_from);

create index idx_recurrence_schedule_versions_lookup
  on public.recurrence_schedule_versions (recurrence_id, effective_from desc);

-- `effective_from = reconstruct_from` (el último punto conocido), no
-- `start_date`. Si la regla fue editada alguna vez —y no hay historial de
-- ediciones para saberlo— esta versión NO hace ninguna afirmación sobre lo
-- anterior. El caminante nunca mira antes de acá.
insert into public.recurrence_schedule_versions
  (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
select r.id, r.user_id, r.reconstruct_from, r.interval_count, r.interval_unit, r.start_date, true
  from public.recurrences r;

alter table public.recurrence_schedule_versions enable row level security;

create policy "users select own recurrence_schedule_versions"
  on public.recurrence_schedule_versions for SELECT
  using (user_id = auth.uid());

create policy "users insert own recurrence_schedule_versions"
  on public.recurrence_schedule_versions for INSERT
  with check (user_id = auth.uid());

create policy "users update own recurrence_schedule_versions"
  on public.recurrence_schedule_versions for UPDATE
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own recurrence_schedule_versions"
  on public.recurrence_schedule_versions for DELETE
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · recurrence_pauses — los intervalos de pausa
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `recurrences.status = 'paused'` dice "ahora está pausada"; el intervalo dice
-- "estuvo pausada de acá a acá", que es lo que el generador necesita para no
-- leer el período como huecos al reanudar.

create table public.recurrence_pauses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id UUID        NOT NULL,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paused_from   DATE        NOT NULL,
  resumed_at    DATE        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_recurrence_pauses_order
    CHECK (resumed_at IS NULL OR resumed_at >= paused_from),

  -- Misma razón que en schedule_versions: la regla y el dueño tienen que ser
  -- la misma persona, enforced por la base y no por la política RLS.
  CONSTRAINT recurrence_pauses_recurrence_fk
    FOREIGN KEY (recurrence_id, user_id)
    REFERENCES public.recurrences(id, user_id) ON DELETE CASCADE
);

-- A lo sumo una pausa abierta por regla: no se puede pausar algo ya pausado.
create unique index recurrence_pauses_one_open_per_rule
  on public.recurrence_pauses (recurrence_id)
  where resumed_at IS NULL;

create index idx_recurrence_pauses_lookup
  on public.recurrence_pauses (recurrence_id, paused_from);

-- Las reglas hoy pausadas estrenan su intervalo en la fecha de la migración,
-- coherente con su `reconstruct_from` del paso 4.
insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
select r.id, r.user_id, (select d from _migration_today)
  from public.recurrences r
 where r.status = 'paused';

alter table public.recurrence_pauses enable row level security;

create policy "users select own recurrence_pauses"
  on public.recurrence_pauses for SELECT
  using (user_id = auth.uid());

create policy "users insert own recurrence_pauses"
  on public.recurrence_pauses for INSERT
  with check (user_id = auth.uid());

create policy "users update own recurrence_pauses"
  on public.recurrence_pauses for UPDATE
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own recurrence_pauses"
  on public.recurrence_pauses for DELETE
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Trigger de compatibilidad con clientes nativos viejos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Una app instalada NO se actualiza porque apliquemos una migración. Los
-- clientes viejos escriben `scheduled_date` y no saben de `due_date` ni de
-- `resolution_kind`, así que sus escrituras producirían filas inválidas en el
-- modelo nuevo. El trigger las completa sin que el cliente sepa nada.
--
-- Se retira en la migración C, junto con `scheduled_date`.

create or replace function public.recurrence_instance_compat()
returns trigger
language plpgsql
as $$
begin
  -- Cliente viejo: escribió scheduled_date y no due_date.
  if NEW.due_date is null then
    NEW.due_date := NEW.scheduled_date;
  end if;

  -- Cliente viejo confirmando: hasta la migración C, confirmar siempre creaba
  -- el movimiento. Vincular no existe en esas versiones.
  if NEW.status = 'confirmed' and NEW.resolution_kind is null then
    NEW.resolution_kind := 'created';
  end if;

  return NEW;
end $$;

create trigger trg_recurrence_instance_compat
  before insert or update on public.recurrence_instances
  for each row
  execute function public.recurrence_instance_compat();

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · Constraints de resolución
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Van DESPUÉS del trigger a propósito. Un cliente viejo que confirme no escribe
-- `resolution_kind`, pero el trigger lo completa antes de que la constraint se
-- evalúe (BEFORE trigger → CHECK), así que no hay incompatibilidad que
-- justifique postergarlas a la activación: hacerlo solo dejaría la base sin
-- proteger durante toda la transición.

alter table public.recurrence_instances
  add constraint chk_recurrence_instances_resolution_kind check (
    (status = 'confirmed' and resolution_kind in ('created', 'linked'))
    or (status in ('pending', 'skipped') and resolution_kind is null)
  ),
  add constraint chk_recurrence_instances_linked_conversion check (
    linked_conversion = false or resolution_kind = 'linked'
  );

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Lo que NO hace esta migración, a propósito
-- ═══════════════════════════════════════════════════════════════════════════
--
--   · NO elimina `recurrence_instances_one_pending_per_rule`  → activación
--   · NO toca `scheduled_date` ni `last_generated_date`       → migración C
--
-- Las constraints de `resolution_kind` SÍ entran acá (paso 8): el trigger de
-- compatibilidad las satisface para los clientes viejos.
--
-- Después de aplicar: regenerar los tipos de Supabase.
