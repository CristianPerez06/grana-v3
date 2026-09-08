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
-- Se deriva de `scheduled_date`. Para las instancias PENDIENTES es exacto: nada
-- las pisó todavía. Para las CONFIRMADAS cuyo `scheduled_date` fue sobrescrito
-- con la fecha de pago, el vencimiento original NO es recuperable — no quedó
-- registrado en ningún lado. Se acepta la aproximación: afecta al historial, no
-- a montos ni a saldos.

alter table public.recurrence_instances
  add column due_date DATE;

update public.recurrence_instances
   set due_date = scheduled_date;

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
-- SIN constraint todavía, a propósito: un cliente nativo viejo que confirme una
-- instancia no escribe `resolution_kind`, y la violaría. Las constraints entran
-- en la migración de activación, cuando el trigger del paso 7 ya no hace falta.
--
-- `skipped` lleva `resolution_kind = NULL`: omitir resuelve sin movimiento, así
-- que no hay nada que deshacer.

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
-- Consecuencia buscada: ninguna regla existente estrena backlog retroactivo. El
-- atraso se acumula desde acá hacia adelante.

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

create table public.recurrence_schedule_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_id  UUID        NOT NULL REFERENCES public.recurrences(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_from DATE        NOT NULL,
  interval_count INT         NOT NULL,
  interval_unit  TEXT        NOT NULL,
  anchor_date    DATE        NOT NULL,
  -- true ⇒ la creó esta migración asumiendo que el cronograma actual rigió
  -- siempre. NO sabemos qué rigió antes de `reconstruct_from`. Las versiones
  -- que cree el usuario al editar no llevan la marca.
  is_assumed     BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_schedule_versions_interval_unit
    CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  CONSTRAINT chk_schedule_versions_interval_count_positive
    CHECK (interval_count > 0)
);

create unique index recurrence_schedule_versions_one_per_date
  on public.recurrence_schedule_versions (recurrence_id, effective_from);

create index idx_recurrence_schedule_versions_lookup
  on public.recurrence_schedule_versions (recurrence_id, effective_from desc);

insert into public.recurrence_schedule_versions
  (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
select r.id, r.user_id, r.start_date, r.interval_count, r.interval_unit, r.start_date, true
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
  recurrence_id UUID        NOT NULL REFERENCES public.recurrences(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paused_from   DATE        NOT NULL,
  resumed_at    DATE        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_recurrence_pauses_order
    CHECK (resumed_at IS NULL OR resumed_at >= paused_from)
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

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Lo que NO hace esta migración, a propósito
-- ═══════════════════════════════════════════════════════════════════════════
--
--   · NO elimina `recurrence_instances_one_pending_per_rule`  → activación
--   · NO agrega las constraints de `resolution_kind`          → activación
--   · NO toca `scheduled_date` ni `last_generated_date`       → migración C
--
-- Después de aplicar: regenerar los tipos de Supabase.
