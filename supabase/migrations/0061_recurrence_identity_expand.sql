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
-- Para las confirmadas NO hay forma de demostrar cuál era el vencimiento.
-- Una versión anterior de esta migración intentaba deducirlo comprobando si la
-- fecha "cae sobre el cronograma", y ese razonamiento es INVÁLIDO: caer en el
-- cronograma es necesario, no suficiente. Una cuota que vencía el 10 de agosto
-- y se confirmó tarde, el 10 de septiembre, cae perfecto en un cronograma
-- mensual del día 10 — y pertenece a otra ocurrencia. La comprobación sirve
-- para sospechar de algunas fechas, nunca para probar que las demás son
-- exactas. Y si la frecuencia fue editada, comparar contra el cronograma ACTUAL
-- tampoco dice qué calendario regía cuando se creó la instancia.
--
-- Y una fecha incierta NO PUEDE OCUPAR UNA IDENTIDAD. Una versión anterior de
-- esta migración guardaba la fecha dudosa igual, marcada como aproximada, y eso
-- reproduce el #96 por otro camino:
--
--   1. El vencimiento de agosto era el 10/08.
--   2. Se confirmó tarde, el 10/09; el código viejo dejó scheduled_date=10/09.
--   3. La migración copiaba eso a due_date=10/09 (marcado, pero presente).
--   4. El cursor real seguía en 10/08.
--   5. El generador intenta crear el vencimiento VERDADERO del 10/09…
--   6. …y el índice único lo rechaza: la fila dudosa ya ocupa esa identidad.
--
--   ⇒ septiembre desaparece. Exactamente el bloqueo que este change elimina.
--
-- Política: lo desconocido se declara desconocido, no se aproxima.
--
--   pending / skipped         due_date EXACTO.
--   confirmed pre-migración   due_date NULL + due_date_is_unknown = true.
--                             `scheduled_date` conserva el único dato legado
--                             disponible, sin pretender que sea un vencimiento.
--   confirmed post-migración  exactas por construcción: desde el despliegue
--                             `due_date` ya no se pisa.
--
-- El índice de identidad aplica solo donde `due_date IS NOT NULL`, y el
-- generador deduplica únicamente contra vencimientos exactos. Si algún día el
-- usuario corrige el histórico a mano, se completa `due_date` y la fila deja de
-- ser desconocida.

alter table public.recurrence_instances
  add column due_date             DATE,
  add column due_date_is_unknown  BOOLEAN NOT NULL DEFAULT false;

update public.recurrence_instances
   set due_date            = case when status = 'confirmed' then null else scheduled_date end,
       due_date_is_unknown = (status = 'confirmed');

-- Lo desconocido y lo ausente son la misma cosa, y no pueden divergir.
alter table public.recurrence_instances
  add constraint chk_recurrence_instances_due_date_unknown check (
    (due_date is null) = due_date_is_unknown
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · Política de colisiones: abortar con informe, nunca adivinar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Solo entre vencimientos EXACTOS: las confirmadas históricas tienen
-- `due_date NULL` y no compiten por ninguna identidad. Una confirmada dudosa que
-- "coincidía" con un vencimiento exacto no es motivo para abortar — justamente
-- pueden ser dos ocurrencias distintas, y esa era la trampa de la versión
-- anterior.
--
-- Lo que sí puede pasar es que dos pendientes/omitidas de la misma regla tengan
-- el mismo `scheduled_date`. Resolver cuál corresponde a qué vencimiento es caso
-- por caso y ninguna regla automática lo acierta; un `due_date` mal asignado es
-- un movimiento atribuido al mes equivocado, y se descubre meses después.
-- Abortar es barato.

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
     where due_date is not null
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

-- `due_date` NO es NOT NULL: las confirmadas históricas lo tienen nulo a
-- propósito. El índice es PARCIAL por la misma razón — una identidad
-- desconocida no puede reservar el lugar de una conocida.
create unique index recurrence_instances_one_per_rule_due_date
  on public.recurrence_instances (recurrence_id, due_date)
  where due_date is not null;

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

-- `start_date - 1` cuando no hay cursor, y NO `start_date`: el contrato genera
-- ocurrencias ESTRICTAMENTE POSTERIORES a `reconstruct_from`, y el motor actual
-- dice que sin cursor la primera ocurrencia cae EN `start_date`
-- (`decideRecurrenceInstance`, packages/money-logic/src/recurrences.ts). Con
-- `start_date` a secas, una regla creada directamente y todavía nunca
-- materializada perdería su primera ocurrencia.
update public.recurrences r
   set reconstruct_from = case
         when r.status = 'paused'               then (select d from _migration_today)
         when r.last_generated_date is not null then r.last_generated_date
         else r.start_date - 1
       end;

alter table public.recurrences
  alter column reconstruct_from set not null;

-- Sin esto la expansión ROMPE el alta de recurrencias: la columna es NOT NULL,
-- una DEFAULT no puede referirse a otra columna de la misma fila, y ni el código
-- actual ni los clientes instalados la escriben. La expansión tiene que preservar
-- el comportamiento, así que el valor se deriva con el MISMO criterio del
-- backfill de arriba.
create or replace function public.recurrence_reconstruct_from_default()
returns trigger
language plpgsql
as $$
begin
  if NEW.reconstruct_from is null then
    NEW.reconstruct_from := case
      when NEW.status = 'paused'               then (now() at time zone 'America/Argentina/Buenos_Aires')::date
      when NEW.last_generated_date is not null then NEW.last_generated_date
      -- Sin cursor la primera ocurrencia cae EN start_date, y el contrato genera
      -- estrictamente después del piso.
      else NEW.start_date - 1
    end;
  end if;
  return NEW;
end $$;

create trigger trg_recurrence_reconstruct_from_default
  before insert on public.recurrences
  for each row
  execute function public.recurrence_reconstruct_from_default();

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
-- `effective_from` es `reconstruct_from`, salvo en la regla sin cursor, donde es
-- `start_date`: ahí `reconstruct_from` vale `start_date - 1`, que es un piso de
-- generación y no una fecha en la que el cronograma haya regido.
insert into public.recurrence_schedule_versions
  (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
select r.id, r.user_id,
       case when r.status <> 'paused' and r.last_generated_date is null
            then r.start_date else r.reconstruct_from end,
       r.interval_count, r.interval_unit, r.start_date, true
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
  -- Cliente viejo insertando una ocurrencia nueva: escribió `scheduled_date` y
  -- no `due_date`. Ahí el dato SÍ es exacto (lo produjo el generador), así que
  -- se deriva. Solo en INSERT: en un UPDATE la fila ya tiene su `due_date`, y
  -- una confirmación vieja pisa `scheduled_date` con la fecha de pago —
  -- derivarlo ahí sería fabricar la identidad equivocada.
  if TG_OP = 'INSERT' and NEW.due_date is null then
    NEW.due_date := NEW.scheduled_date;
    NEW.due_date_is_unknown := false;
  end if;

  -- Cliente viejo confirmando: hasta la migración C, confirmar siempre creaba
  -- el movimiento. Vincular no existe en esas versiones.
  if NEW.status = 'confirmed' and NEW.resolution_kind is null then
    NEW.resolution_kind := 'created';
  end if;

  -- ── Inmutabilidad de la identidad ────────────────────────────────────────
  --
  -- El CHECK de coherencia valida el ESTADO FINAL de la fila, no la TRANSICIÓN,
  -- así que por sí solo deja pasar dos escrituras que rompen el contrato:
  --
  --   update … set due_date = '2026-09-11' where due_date = '2026-09-10';
  --   update … set due_date = null, due_date_is_unknown = true;
  --
  -- La primera mueve una identidad ya establecida; la segunda la borra, y con
  -- ella la protección del índice parcial — la misma ocurrencia podría volver a
  -- materializarse. Las transiciones permitidas son solo estas:
  --
  --   exacta      → la misma, sin cambios.
  --   desconocida → sigue desconocida.
  --   desconocida → exacta, una sola vez (el usuario corrige el histórico).
  --   exacta      → otra fecha, o desconocida  ⇒  RECHAZADO.
  if TG_OP = 'UPDATE' and OLD.due_date is not null
     and (NEW.due_date is distinct from OLD.due_date) then
    raise exception
      'due_date es inmutable: la ocurrencia % ya tiene la identidad %, y se intentó %.',
      OLD.id, OLD.due_date,
      case when NEW.due_date is null then 'borrarla'
           else 'moverla a ' || NEW.due_date end
      using errcode = '23514';
  end if;

  -- La marca se deriva, nunca se declara: así una corrección de histórico que
  -- complete `due_date` no falla por olvidarse de bajar el flag.
  NEW.due_date_is_unknown := (NEW.due_date is null);

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
-- ⚠️  AVISO PARA LA MIGRACIÓN C
--
-- El trigger `trg_recurrence_instance_compat` NO se puede eliminar entero al
-- retirar `scheduled_date`. Su nombre engaña: además de la compatibilidad
-- temporal con clientes viejos, contiene una regla PERMANENTE de negocio — la
-- inmutabilidad de `due_date`. Borrarlo completo reabriría el agujero de poder
-- mover o borrar una identidad exacta por UPDATE, que es justamente el bloqueo
-- que este change elimina.
--
-- Al retirar `scheduled_date`, hacer UNA de estas dos:
--   a) quitar solo las ramas de compatibilidad (la derivación de `due_date` en
--      INSERT y el relleno de `resolution_kind`), conservando el guard; o
--   b) reemplazarlo por un trigger de guard permanente, con un nombre que diga
--      lo que hace.
--
-- Las constraints de `resolution_kind` SÍ entran acá (paso 8): el trigger de
-- compatibilidad las satisface para los clientes viejos.
--
-- Después de aplicar: regenerar los tipos de Supabase.
