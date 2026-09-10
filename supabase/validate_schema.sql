-- =============================================================================
-- validate_schema.sql
-- Validaciones completas del schema de grana-v3.
-- Ejecutar desde el SQL Editor de Supabase (dashboard → SQL Editor).
-- Usa RAISE EXCEPTION en cualquier falla: si el script termina sin error,
-- todo está OK. Al final se muestra una tabla resumen con los resultados.
-- =============================================================================

begin;   -- todo corre en una sola transacción; ROLLBACK automático si algo falla


-- =============================================================================
-- 8.1A — ESTRUCTURA DE TABLAS
-- =============================================================================

do $$
declare
  missing text;
begin

  -- currencies
  for missing in
    select col from unnest(array['code','name','symbol','is_active']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'currencies'
        and column_name = col
    )
  loop
    raise exception 'currencies.% es missing', missing;
  end loop;

  -- institutions
  for missing in
    select col from unnest(array['id','name','slug','brand_color','icon_type','country','is_active']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'institutions'
        and column_name = col
    )
  loop
    raise exception 'institutions.% es missing', missing;
  end loop;

  -- card_networks
  for missing in
    select col from unnest(array['id','name','slug','brand_color','display_order','is_active']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'card_networks'
        and column_name = col
    )
  loop
    raise exception 'card_networks.% es missing', missing;
  end loop;

  -- categories
  for missing in
    select col from unnest(array['id','user_id','name','canonical_name','icon','color','type','is_active','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'categories'
        and column_name = col
    )
  loop
    raise exception 'categories.% es missing', missing;
  end loop;

  -- subcategories
  for missing in
    select col from unnest(array['id','category_id','user_id','name','canonical_name','is_active','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subcategories'
        and column_name = col
    )
  loop
    raise exception 'subcategories.% es missing', missing;
  end loop;

  raise notice '✓ 8.1A — estructura de tablas OK (currencies, institutions, card_networks, categories, subcategories)';
end $$;


-- =============================================================================
-- 8.1B — CONSTRAINTS: CHECK en categories.type
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints cc
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = cc.constraint_name
    where ccu.table_schema = 'public'
      and ccu.table_name = 'categories'
      and ccu.column_name = 'type'
      and cc.check_clause like '%income%'
      and cc.check_clause like '%expense%'
  ) then
    raise exception 'categories.type no tiene CHECK constraint con income/expense/both';
  end if;

  raise notice '✓ 8.1B — CHECK constraint en categories.type OK';
end $$;


-- =============================================================================
-- 8.1C — UNIQUE INDEXES en categories
-- =============================================================================

do $$
begin
  -- UNIQUE parcial para sistema (WHERE user_id IS NULL)
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename  = 'categories'
      and indexname  = 'categories_system_canonical_name_unique'
  ) then
    raise exception 'Falta index categories_system_canonical_name_unique';
  end if;

  -- UNIQUE por usuario (WHERE user_id IS NOT NULL)
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename  = 'categories'
      and indexname  = 'categories_user_canonical_name_unique'
  ) then
    raise exception 'Falta index categories_user_canonical_name_unique';
  end if;

  -- UNIQUE (category_id, canonical_name) en subcategories
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename  = 'subcategories'
      and indexdef like '%category_id%canonical_name%'
  ) then
    raise exception 'Falta UNIQUE (category_id, canonical_name) en subcategories';
  end if;

  raise notice '✓ 8.1C — UNIQUE indexes OK';
end $$;


-- =============================================================================
-- 8.1D — SEED DATA: conteos
-- =============================================================================

do $$
declare
  n int;
begin
  -- currencies: ARS, USD, EUR
  select count(*) into n from currencies;
  if n < 3 then raise exception 'currencies: esperaba >= 3 filas, encontré %', n; end if;
  if not exists (select 1 from currencies where code = 'ARS') then
    raise exception 'currencies: falta ARS';
  end if;
  if not exists (select 1 from currencies where code = 'USD') then
    raise exception 'currencies: falta USD';
  end if;
  if not exists (select 1 from currencies where code = 'EUR') then
    raise exception 'currencies: falta EUR';
  end if;

  -- institutions: al menos 23
  select count(*) into n from institutions;
  if n < 23 then raise exception 'institutions: esperaba >= 23 filas, encontré %', n; end if;
  if not exists (select 1 from institutions where slug = 'santander') then
    raise exception 'institutions: falta santander';
  end if;
  if not exists (select 1 from institutions where slug = 'mercado-pago') then
    raise exception 'institutions: falta mercado-pago';
  end if;

  -- card_networks: exactamente 7
  select count(*) into n from card_networks;
  if n <> 7 then raise exception 'card_networks: esperaba 7 filas, encontré %', n; end if;
  if not exists (select 1 from card_networks where slug = 'visa') then
    raise exception 'card_networks: falta visa';
  end if;
  if not exists (select 1 from card_networks where slug = 'mastercard') then
    raise exception 'card_networks: falta mastercard';
  end if;
  if not exists (select 1 from card_networks where slug = 'amex') then
    raise exception 'card_networks: falta amex';
  end if;

  -- categories: exactamente 20 del sistema
  -- (17 de la 0006 + Cuidado personal de la 0028 + Financiero-ingresos de la 0036
  --  + Viajes / Escapadas de la 0054)
  select count(*) into n from categories where user_id is null;
  if n <> 20 then raise exception 'categories sistema: esperaba 20, encontré %', n; end if;

  -- categorías de gastos: 14
  select count(*) into n from categories where user_id is null and type = 'expense';
  if n <> 14 then raise exception 'categories expense: esperaba 14, encontré %', n; end if;

  -- categorías de ingresos: 6
  select count(*) into n from categories where user_id is null and type = 'income';
  if n <> 6 then raise exception 'categories income: esperaba 6, encontré %', n; end if;

  -- subcategories: exactamente 79 del sistema
  -- (71 tras la 0028 + intereses-ganados de la 0036 + 2 de la 0040 + 5 de la 0054)
  select count(*) into n from subcategories where user_id is null;
  if n <> 79 then raise exception 'subcategories sistema: esperaba 79, encontré %', n; end if;

  raise notice '✓ 8.1D — seed data OK (3 currencies, >= 23 institutions, 7 card_networks, 20 categories, 79 subcategories)';
end $$;


-- =============================================================================
-- 8.1E — SEED DATA: canonical_names clave
-- =============================================================================

do $$
declare
  slug text;
begin
  for slug in select unnest(array[
    'comida','transporte','salud','educacion','entretenimiento',
    'ropa-y-calzado','hogar','servicios','cuidado-personal','tecnologia',
    'impuestos','financiero','otros-gastos','sueldo','freelance',
    'inversiones','otros-ingresos','reintegros-cashback',
    -- 0036 y 0054: faltaban en la lista, así que 8.1E validaba 18 de 20
    'financiero-ingresos','viajes-escapadas'
  ])
  loop
    if not exists (
      select 1 from categories
      where canonical_name = slug and user_id is null
    ) then
      raise exception 'Falta categoría sistema con canonical_name = ''%''', slug;
    end if;
  end loop;

  for slug in select unnest(array[
    'supermercado','restaurante','pedidosya','rappi','cafeteria',
    'kiosco-almacen','verduleria','carniceria',
    'nafta','uber-cabify','transporte-publico','estacionamiento',
    'peajes','service-mecanico','seguro-auto','vtv','patente',
    'farmacia','medico','obra-social','prepaga',
    'cuota-colegio','universidad','cursos','utiles-libros',
    'netflix-streaming','cine','salidas','juegos',
    'luz','gas','internet','celular','agua','cable-tv',
    'ropa','calzado','accesorios',
    'alquiler','limpieza','muebles','reparaciones','expensas',
    'peluqueria','gimnasio','cosmetica-higiene','skin-care',
    'dispositivos','apps-y-suscripciones','gadgets',
    'impuesto-de-sellos','monotributo','tasas-municipales',
    'comision-compra-usd','constitucion-plazo-fijo',
    'intereses-cuenta-remunerada','comisiones-bancarias','compra-dolar-mep',
    'regalos','donaciones',
    'salario','aguinaldo','bono',
    'honorarios','proyectos',
    'plazo-fijo','dividendos','alquileres-cobrados','dolar-mep',
    'venta','regalo-recibido',
    -- 0036 / 0040 / 0054: faltaban en la lista, así que 8.1E validaba 71 de 79
    'intereses-ganados','cuota-prestamo','seguro-hogar',
    'juntadas','viaje-transporte','viaje-hospedaje','viaje-comida','viaje-excursiones'
  ])
  loop
    if not exists (
      select 1 from subcategories
      where canonical_name = slug and user_id is null
    ) then
      raise exception 'Falta subcategoría sistema con canonical_name = ''%''', slug;
    end if;
  end loop;

  raise notice '✓ 8.1E — canonical_names de sistema OK (20 categories, 79 subcategories)';
end $$;


-- =============================================================================
-- 8.1F — INTEGRIDAD REFERENCIAL: subcategories → categories
-- =============================================================================

do $$
declare
  n int;
begin
  select count(*) into n
  from subcategories s
  where not exists (select 1 from categories c where c.id = s.category_id);

  if n > 0 then
    raise exception 'subcategories: % filas con category_id inválido', n;
  end if;

  -- comida tiene exactamente 8 subcategorías
  select count(*) into n
  from subcategories s
  join categories c on c.id = s.category_id
  where c.canonical_name = 'comida' and c.user_id is null and s.user_id is null;

  if n <> 8 then
    raise exception 'comida debería tener 8 subcategorías del sistema, tiene %', n;
  end if;

  raise notice '✓ 8.1F — integridad referencial subcategories → categories OK';
end $$;


-- =============================================================================
-- 8.1G — INVARIANTE: FK de category_id/subcategory_id son ON DELETE RESTRICT
-- (migración 0026). Protege la clasificación histórica: no se puede borrar una
-- categoría/subcategoría en uso. Deben existir exactamente los 6 FK esperados.
-- =============================================================================

do $$
declare
  v_missing text;
begin
  -- Validar triple por triple (tabla, columna, tabla_referenciada) en lugar de
  -- contar == 6, para que "uno falta y otro sobra" no pase el check.
  select string_agg(format('%s.%s->%s', e.tbl, e.col, e.ref), ', ') into v_missing
    from (values
      ('transactions', 'category_id', 'categories'),
      ('transactions', 'subcategory_id', 'subcategories'),
      ('recurrences', 'category_id', 'categories'),
      ('recurrences', 'subcategory_id', 'subcategories'),
      ('recurrence_instances', 'category_id', 'categories'),
      ('recurrence_instances', 'subcategory_id', 'subcategories')
    ) as e(tbl, col, ref)
   where not exists (
     select 1
       from pg_constraint con
       join pg_class rel on rel.oid = con.conrelid
       join pg_class refc on refc.oid = con.confrelid
       join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      where con.contype = 'f'
        and con.confdeltype = 'r' -- 'r' = RESTRICT
        and rel.relnamespace = 'public'::regnamespace
        and rel.relname = e.tbl
        and att.attname = e.col
        and refc.relname = e.ref
        and array_length(con.conkey, 1) = 1
   );

  if v_missing is not null then
    raise exception 'FK category/subcategory ON DELETE RESTRICT faltantes o incorrectos: %', v_missing;
  end if;

  raise notice '✓ 8.1G — los 6 FK category_id/subcategory_id existen y son ON DELETE RESTRICT';
end $$;


-- =============================================================================
-- 8.1H — INVARIANTE: integridad de las reglas recurrentes (migración 0053).
--   (a) created_from_transaction_id es ON DELETE RESTRICT: borrar el movimiento
--       semilla no puede dejar la regla huérfana en silencio, desde ningún
--       cliente. Antes era SET NULL y por eso existieron reglas huérfanas.
--   (b) La etiqueta `frequency` no puede contradecir el cronograma real
--       (interval_count + interval_unit), que es lo que obedece el generador.
-- =============================================================================

do $$
declare
  v_deltype "char";
  v_desync  integer;
begin
  select con.confdeltype into v_deltype
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
   where con.contype = 'f'
     and con.conrelid = 'public.recurrences'::regclass
     and att.attname = 'created_from_transaction_id'
     and array_length(con.conkey, 1) = 1;

  if v_deltype is null then
    raise exception 'FK recurrences.created_from_transaction_id -> transactions no existe';
  end if;
  if v_deltype <> 'r' then
    raise exception 'FK recurrences.created_from_transaction_id debe ser ON DELETE RESTRICT (confdeltype=%)', v_deltype;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.recurrences'::regclass
       and contype = 'c'
       and conname = 'chk_recurrences_frequency_matches_interval'
  ) then
    raise exception 'CHECK chk_recurrences_frequency_matches_interval no existe en recurrences';
  end if;

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
    raise exception 'recurrences: % filas con frequency incoherente con su intervalo', v_desync;
  end if;

  raise notice '✓ 8.1H — recurrences: FK semilla RESTRICT + coherencia frequency/intervalo';
end $$;


-- =============================================================================
-- 8.1I — INVARIANTE: el catálogo del sistema está activo
-- =============================================================================
-- 8.1D y 8.1E validan que las categorías y subcategorías del sistema EXISTAN,
-- no que estén activas. Pero el catálogo que consume la app filtra
-- `is_active = true` en los dos niveles (apps/web/lib/categories/queries.ts), así
-- que una fila de sistema archivada existe en la base, pasa 8.1D/8.1E y aun así
-- es invisible al clasificar un movimiento. Eso ya pasó: `verduleria` estuvo
-- archivada mientras este script daba verde, hasta la migración 0056.
--
-- Ningún usuario puede archivar filas de sistema: `archiveSubcategory` filtra
-- `user_id = auth.uid()` y la política RLS de update exige lo mismo (ver 8.2B).
-- Por eso una fila de sistema archivada es siempre intervención manual, y solo
-- se acepta la que una migración retiró a propósito.
--
-- Retiros deliberados (allowlist):
--   • `reintegros-cashback` — categoría retirada por la 0018, cuando los
--     reintegros pasaron a ser un tipo de movimiento en vez de una categoría.
--     La 0018 tiene su propio self-check que falla si la encuentra ACTIVA; acá
--     se valida la otra mitad, así las dos se sostienen entre sí.
--
-- Agregar una fila a la allowlist SHALL venir con la migración que la retira.

do $$
declare
  v_offenders text;
begin
  select string_agg(canonical_name, ', ' order by canonical_name)
    into v_offenders
    from categories
   where user_id is null
     and is_active = false
     and canonical_name <> all (array['reintegros-cashback']);

  if v_offenders is not null then
    raise exception 'Categoría(s) de sistema archivada(s) sin retiro deliberado: % — o se reactivan con una migración (ver 0056), o se suman a la allowlist de 8.1I junto con la migración que las retira', v_offenders;
  end if;

  -- Hoy ninguna subcategoría del sistema está retirada a propósito: la
  -- allowlist es vacía a propósito. Si alguna migración retira una, se agrega
  -- acá con su número, igual que `reintegros-cashback` arriba.
  select string_agg(canonical_name, ', ' order by canonical_name)
    into v_offenders
    from subcategories
   where user_id is null
     and is_active = false;

  if v_offenders is not null then
    raise exception 'Subcategoría(s) de sistema archivada(s): % — ninguna está retirada a propósito; reactivar con una migración (ver 0056)', v_offenders;
  end if;

  -- La contracara del allowlist: `reintegros-cashback` tiene que SEGUIR
  -- retirada. Reactivarla devolvería al selector una categoría que el modelo de
  -- reintegros ya no usa, y volvería a habilitar el doble conteo que la 0018
  -- cerró.
  if exists (
    select 1
      from categories
     where canonical_name = 'reintegros-cashback'
       and user_id is null
       and is_active
  ) then
    raise exception 'reintegros-cashback está activa: la 0018 la retiró a propósito (los reintegros son un tipo de movimiento, no una categoría)';
  end if;

  raise notice '✓ 8.1I — catálogo de sistema activo (sin archivadas fuera de la allowlist; reintegros-cashback sigue retirada)';
end $$;


-- =============================================================================
-- 8.1J — INVARIANT: the recurrence occurrence-identity model (migrations 0064-0066).
--
-- Comments in English per AGENTS.md; the rest of this file predates that rule.
--
-- This file validates the FINAL state of the schema, so the checks below demand
-- the whole change: the new model installed (0064/0065) AND the activation
-- applied (0066). While `recurrence_instances_one_pending_per_rule` exists, a
-- rule can still hold only one unresolved occurrence — which is #96, untouched.
--
-- The INTERMEDIATE window — expansion applied, activation not yet — is a real
-- and legitimate state, but it is not this file's subject: validating both here
-- would mean accepting the unfixed schema as correct. It has its own file,
-- `validate_schema_transition.sql`, meant to be run during that window only.
-- =============================================================================

-- ┌── SHARED BLOCK · expansion inventory (0064 + 0065) ─────────────────────┐
-- │ BYTE-IDENTICAL in `validate_schema.sql` and                             │
-- │ `validate_schema_transition.sql`. SQL applied by hand has no include, so │
-- │ the copies are kept identical on purpose and a test compares them.       │
-- │                                                                          │
-- │ It is shared because the transition window needs exactly the same depth  │
-- │ as the final state: objects checked by NAME alone let a trigger on       │
-- │ another table, a disabled one, or a table missing half its columns pass  │
-- │ as installed — and the window is when the QA that decides the activation │
-- │ happens. What differs between the two files is the PHASE, and only that: │
-- │ it lives outside this block in each of them.                             │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
declare
  missing   text;
  v_secdef  boolean;
  v_offend  int;
begin

  -- (1) New columns on the existing table, plus the rule's reconstruction floor.
  for missing in
    select col from unnest(array['due_date','due_date_is_unknown','resolution_kind','linked_conversion']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_instances'
        and column_name = col
    )
  loop
    raise exception 'recurrence_instances.% is missing (migration 0064)', missing;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recurrences'
       and column_name = 'reconstruct_from' and is_nullable = 'NO'
  ) then
    raise exception 'recurrences.reconstruct_from is missing or nullable (migration 0064)';
  end if;

  -- NOT NULL *with* a default, on purpose. Without one, `supabase gen types`
  -- marks the column REQUIRED on Insert and every client has to send a value the
  -- database owns — old clients included, which cannot. `infinity` fails closed:
  -- if the trigger were dropped, the generator materializes nothing instead of
  -- rebuilding a rule's whole history as backlog.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recurrences'
       and column_name = 'reconstruct_from' and column_default like '%infinity%'
  ) then
    raise exception 'recurrences.reconstruct_from lost its default: generated types would require it on Insert, and without it the value stops failing closed if the guard is dropped';
  end if;

  -- And the placeholder never survives: the trigger computes the column on every
  -- insert, so no row may hold it.
  select count(*) into v_offend
    from public.recurrences where reconstruct_from = 'infinity'::date;
  if v_offend > 0 then
    raise exception 'recurrences: % rows hold reconstruct_from = infinity — the guard that derives the column did not run', v_offend;
  end if;

  -- (2) The two new tables and their columns.
  for missing in
    select col from unnest(array['id','recurrence_id','user_id','effective_from','interval_count',
                                 'interval_unit','anchor_date','is_assumed','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_schedule_versions'
        and column_name = col
    )
  loop
    raise exception 'recurrence_schedule_versions.% is missing', missing;
  end loop;

  for missing in
    select col from unnest(array['id','recurrence_id','user_id','paused_from','resumed_at','created_at']) as col
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recurrence_pauses'
        and column_name = col
    )
  loop
    raise exception 'recurrence_pauses.% is missing', missing;
  end loop;

  -- (3) Indexes. The identity index is PARTIAL on purpose: a historical
  --     confirmed row holds `due_date IS NULL`, and an unknown identity must not
  --     reserve the slot of a known one.
  for missing in
    select ix from unnest(array['recurrence_instances_one_per_rule_due_date',
                                'recurrence_schedule_versions_one_per_date',
                                'idx_recurrence_schedule_versions_lookup',
                                'recurrence_pauses_one_open_per_rule',
                                'idx_recurrence_pauses_lookup']) as ix
    where not exists (
      select 1 from pg_indexes where schemaname = 'public' and indexname = ix
    )
  loop
    raise exception 'index % does not exist (migration 0064)', missing;
  end loop;

  -- Whether that index actually protects anything — and whether the due-date
  -- CHECK does — is asserted by the SHARED CONTRACT block right after this one.
  -- It used to be `indexdef like '%WHERE (due_date IS NOT NULL)%'`, which a
  -- predicate of `due_date is not null and status = 'confirmed'` satisfies while
  -- covering no unresolved occurrence at all.

  -- (5) Constraints.
  for missing in
    select cn from unnest(array['chk_recurrence_instances_due_date_unknown',
                                'chk_recurrence_instances_unresolved_has_due_date',
                                'chk_recurrence_instances_resolution_kind',
                                'chk_recurrence_instances_linked_conversion']) as cn
    where not exists (
      select 1 from pg_constraint
       where conrelid = 'public.recurrence_instances'::regclass and conname = cn
    )
  loop
    raise exception 'CHECK % does not exist on recurrence_instances', missing;
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.recurrences'::regclass
       and conname = 'recurrences_id_user_unique' and contype = 'u'
  ) then
    raise exception 'recurrences_id_user_unique does not exist: without that candidate key the composite FKs cannot be declared';
  end if;

  -- (6) COMPOSITE FKs. With two independent FKs (rule on one side, user on the
  --     other) and an RLS policy that only checks `user_id = auth.uid()`, the
  --     database would accept a row holding MY user and SOMEBODY ELSE'S rule.
  --
  --     Checked by the COLUMNS on both sides, not by "it has two of them": a
  --     constraint with the right name, the right arity and the wrong columns
  --     would pass a nominal check and protect nothing.
  for missing in
    select t.child from (values
      ('recurrence_schedule_versions', 'recurrence_schedule_versions_recurrence_fk'),
      ('recurrence_pauses',            'recurrence_pauses_recurrence_fk')
    ) as t(child, cname)
    where not exists (
      select 1
        from pg_constraint con
       where con.conrelid = ('public.' || t.child)::regclass
         and con.conname  = t.cname
         and con.contype  = 'f'
         and con.confrelid = 'public.recurrences'::regclass
         and con.confdeltype = 'c'  -- ON DELETE CASCADE
         -- Local columns, in order: (recurrence_id, user_id).
         and (select array_agg(a.attname::text order by k.ord)
                from unnest(con.conkey) with ordinality as k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = con.conrelid and a.attnum = k.attnum)
             = array['recurrence_id', 'user_id']
         -- Referenced columns, in order: (id, user_id).
         and (select array_agg(a.attname::text order by k.ord)
                from unnest(con.confkey) with ordinality as k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = con.confrelid and a.attnum = k.attnum)
             = array['id', 'user_id']
    )
  loop
    raise exception 'the FK from % to recurrences is not (recurrence_id, user_id) -> (id, user_id) ON DELETE CASCADE: a user could attach their user_id to somebody else''s rule', missing;
  end loop;

  -- (7) Triggers, checked by TABLE, FUNCTION, EVENTS, TIMING and LEVEL — not by
  --     name. A trigger called `trg_recurrence_reconstruct_from_guard` that only
  --     fires on INSERT is the exact hole this section exists to catch:
  --     `reconstruct_from` is the floor of what the generator reconstructs,
  --     `recurrences` has had a user UPDATE policy since 0011, and the generated
  --     types expose the column in `Update`. Moving that floor backwards
  --     fabricates months of backlog; moving it forwards hides occurrences the
  --     user is owed.
  --
  --     Timing and level are part of the contract, not decoration. The same guard
  --     moved to AFTER would still fire on both events and still pass an
  --     events-only check, while silently doing nothing: `NEW` is not writable
  --     after the row is in, so it could no longer DERIVE `reconstruct_from` on
  --     insert. A STATEMENT-level trigger has no `NEW`/`OLD` at all.
  --
  --     `tgenabled` is checked for the same reason, and it is the sharpest of the
  --     lot: `ALTER TABLE … DISABLE TRIGGER` leaves the name, the table, the
  --     function and every bit exactly as they are, and reopens the hole
  --     completely. 0064 itself documents that a later migration MAY disable the
  --     guard around a deliberate write — so the thing this file has to catch is
  --     someone forgetting to switch it back on. 'O' fires for origin and local
  --     writes, 'A' always; 'D' is disabled and 'R' only on a replica, and
  --     neither protects the writes the app actually makes.
  --
  --     And the function is matched by SCHEMA too: a same-named function outside
  --     `public` would otherwise pass.
  --
  --     `pg_trigger.tgtype` bits: 1 ROW, 2 BEFORE, 4 INSERT, 8 DELETE, 16 UPDATE.
  for missing in
    select t.tg from (values
      -- name                                     table                   function                               ins   upd   del    before
      ('trg_recurrence_instance_compat',          'recurrence_instances', 'recurrence_instance_compat',          true, true, false, true),
      ('trg_recurrence_reconstruct_from_guard',   'recurrences',          'recurrence_reconstruct_from_guard',   true, true, false, true),
      ('trg_recurrence_sync_schedule_and_pauses', 'recurrences',          'recurrence_sync_schedule_and_pauses', true, true, false, false)
    ) as t(tg, tbl, fn, want_insert, want_update, want_delete, want_before)
    where not exists (
      select 1
        from pg_trigger tr
        join pg_proc pr on pr.oid = tr.tgfoid
       where tr.tgname = t.tg
         and not tr.tgisinternal
         and tr.tgrelid = ('public.' || t.tbl)::regclass
         and pr.proname = t.fn
         and pr.pronamespace = 'public'::regnamespace
         and tr.tgenabled in ('O', 'A')                -- enabled for normal writes
         and ((tr.tgtype & 4)  <> 0) = t.want_insert   -- INSERT
         and ((tr.tgtype & 16) <> 0) = t.want_update   -- UPDATE
         and ((tr.tgtype & 8)  <> 0) = t.want_delete   -- DELETE
         and ((tr.tgtype & 2)  <> 0) = t.want_before   -- BEFORE, else AFTER
         and  (tr.tgtype & 1)  <> 0                    -- FOR EACH ROW
    )
  loop
    raise exception 'trigger % is missing, DISABLED, sits on another table or on a same-named function outside public, or no longer fires with the events, timing and level it must — BEFORE ROW for the two that write NEW, AFTER ROW for the history sync (migration 0064)', missing;
  end loop;

  -- (8) THE DATABASE IS THE SOLE OWNER of the new history. The two writer
  --     functions are SECURITY DEFINER with a locked search_path, because the
  --     tables are read-only for `authenticated` — that is what turns "the
  --     database owns it" from a convention into a guarantee.
  for missing in
    select fn from unnest(array['recurrence_sync_schedule_and_pauses',
                                'recurrence_reconstruct_from_guard']) as fn
  loop
    select p.prosecdef into v_secdef
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = missing;
    if v_secdef is null then
      raise exception 'function public.% does not exist (migration 0064)', missing;
    end if;
    if not v_secdef then
      raise exception 'public.% must be SECURITY DEFINER: the tables are read-only for authenticated', missing;
    end if;
    if not exists (
      select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = missing
         and array_to_string(p.proconfig, ',') like '%search_path=%'
    ) then
      raise exception 'public.% is SECURITY DEFINER without a locked search_path', missing;
    end if;
  end loop;

  -- (9) And no write policies on either table: with them, "the database is the
  --     sole owner" would be a convention any client could sidestep.
  for missing in
    select p.tablename || '.' || p.policyname
      from pg_policies p
     where p.schemaname = 'public'
       and p.tablename in ('recurrence_schedule_versions', 'recurrence_pauses')
       and p.cmd <> 'SELECT'
  loop
    raise exception 'write policy % on the history: the triggers maintain it, not the client', missing;
  end loop;

  -- (10) Data invariants the constraints alone do not state.
  select count(*) into v_offend
    from public.recurrence_instances
   where (due_date is null) <> due_date_is_unknown;
  if v_offend > 0 then
    raise exception 'recurrence_instances: % rows where due_date_is_unknown disagrees with due_date', v_offend;
  end if;

  select count(*) into v_offend
    from public.recurrences r
   where not exists (
     select 1 from public.recurrence_schedule_versions v where v.recurrence_id = r.id
   );
  if v_offend > 0 then
    raise exception 'recurrences: % rules with no schedule version — the walker would not know which calendar applied', v_offend;
  end if;

  -- (10b) An UNRESOLVED occurrence always has an exact vencimiento. The column is
  -- nullable only for rows resolved before the distinction existed; a `pending`
  -- one with no `due_date` would have no identity at all, and every surface that
  -- reads the vencimiento (ordering, overdue, the confirm form's default date)
  -- narrows the type on this invariant.
  --
  -- `chk_recurrence_instances_unresolved_has_due_date` (checked above) is what
  -- ENFORCES it going forward. This stays because the two answer different
  -- questions: the constraint stops new violations, this one finds any that a
  -- restored dump or a pre-0064 deployment left behind.
  select count(*) into v_offend
    from public.recurrence_instances
   where status = 'pending' and due_date is null;
  if v_offend > 0 then
    raise exception 'recurrence_instances: % pending rows with no due_date — an unresolved occurrence has no identity without one', v_offend;
  end if;

  -- (11) The atomic repair for a deleted seed (migration 0065). Its whole point
  -- is that the unlink, the floor release and the DELETE happen together; if the
  -- function is missing the client has no way to do that, and every partial
  -- outcome either duplicates a gasto or loses an occurrence.
  --
  -- Checked BY SIGNATURE, not by name. A function that merely answers to the name
  -- is not the one the client calls: PostgREST resolves an RPC by its named
  -- arguments, so a same-named function with a different parameter would leave the
  -- repair silently unperformed while this check reported everything fine.
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'delete_movement_unlinking_seed'
       -- The exact argument list PostgREST resolves the call against.
       and pg_get_function_identity_arguments(p.oid) = 'p_transaction_id uuid'
       and p.prorettype = 'void'::regtype
       -- SECURITY INVOKER: it must run as the user, so RLS decides what it may
       -- touch. As DEFINER it would silently grant reach nobody reviewed.
       and p.prosecdef = false
       -- Locked search_path: the body names unqualified relations, so a mutable
       -- path would let a caller's schema decide which tables it writes to.
       and array_to_string(p.proconfig, ',') like '%search_path=%'
  ) then
    raise exception 'public.delete_movement_unlinking_seed(p_transaction_id uuid) is missing, or is not a void SECURITY INVOKER function with a locked search_path (migration 0065)';
  end if;

  -- And `authenticated` has to be able to call it: without the grant the repair
  -- fails for every real client while the function sits there looking correct.
  if not has_function_privilege(
       'authenticated',
       'public.delete_movement_unlinking_seed(uuid)',
       'EXECUTE'
     ) then
    raise exception 'authenticated cannot execute public.delete_movement_unlinking_seed (migration 0065)';
  end if;

end $$;
-- └── END SHARED BLOCK · expansion inventory ───────────────────────────────┘

-- ── 8.1J · phase: the activation is applied ────────────────────────────────
do $$
begin
  -- (4) THE ACTIVATION IS APPLIED. The single-pending index has to be gone: it
  -- is the constraint that turns an unreviewed occurrence into a permanent stop,
  -- and while it stands the fix is not in production however much of the new
  -- model is.
  --
  -- Two earlier versions of this check were wrong in opposite directions. The
  -- first demanded the index still EXIST, and said in its own message that it
  -- would go stale after the activation — it did. The second accepted either
  -- state and only reported which one, which reads as "both are fine" and lets
  -- an unapplied activation pass final validation. During the window between
  -- the two migrations, run `validate_schema_transition.sql` instead.
  if exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'recurrence_instances_one_pending_per_rule'
  ) then
    raise exception 'recurrence_instances_one_pending_per_rule still exists: the activation (0066) was not applied and #96 is still live. If the expansion is deployed and the activation is deliberately pending, run validate_schema_transition.sql for that window';
  end if;

  raise notice '✓ 8.1J — occurrence identity (0064): columns, tables, indexes, composite FKs, triggers and sole ownership OK; the atomic seed repair (0065) is in place; the backlog is ACTIVATED (0066), so a rule may owe several unresolved occurrences';
end $$;

-- ┌── SHARED CONTRACT · occurrence identity ─────────────────────────────────┐
-- │ BYTE-IDENTICAL in three files: migration 0066, validate_schema.sql and   │
-- │ validate_schema_transition.sql. SQL applied by hand has no include, so   │
-- │ the copies are kept identical on purpose and a test compares them; edit  │
-- │ one and that test tells you which others to bring along.                 │
-- │                                                                          │
-- │ It checks the two guards that the activation is about to lean on, and it │
-- │ does so by comparing them against a CANONICAL definition built and       │
-- │ rendered by this same Postgres.                                          │
-- │                                                                          │
-- │ Three weaker approaches were tried and each let something through:       │
-- │   · by NAME — an index in another schema, on another table, non-unique   │
-- │     or invalid answers to the same name and protects nothing;            │
-- │   · by SUBSTRING — `due_date is not null and status = 'confirmed'`       │
-- │     contains every right word and covers no unresolved occurrence;       │
-- │   · by SAMPLE — probing one date and one uuid passes a predicate reading │
-- │     `due_date >= date '2026-01-01'`, which abandons everything older.    │
-- │     A sample cannot prove a rule that has to hold universally.           │
-- │                                                                          │
-- │ Comparing rendered text exactly is what proves it, and building the      │
-- │ canonical side HERE is what makes that safe: both sides come out of the  │
-- │ same server's deparser, so no Postgres version renders one differently   │
-- │ from the other. The temporary table is `like` the real one, so column    │
-- │ names and types — and therefore any cast the deparser prints — match.    │
-- │                                                                          │
-- │ The price is that an equivalent REWRITE is rejected (`not (due_date is   │
-- │ null)` is the same rule, spelled differently). That is a false red, not  │
-- │ a false green: it stops a deploy instead of blessing an unprotected      │
-- │ table, and the fix is to re-create the object in the canonical form.     │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
declare
  v_predicate  text;
  v_canonical  text;
  v_columns    text[];
  v_check_def  text;
  v_check_canon text;
  v_status     text;
  v_due        date;
  v_accepted   boolean;
begin
  -- A copy of the real table: same columns, same types, no constraints and no
  -- indexes. Everything below is built and probed on THIS, so no production row
  -- is read or written.
  -- `including defaults` matters: without it the copy keeps every NOT NULL and
  -- loses the defaults that satisfy them, so an insert fails on `id` instead of
  -- on the rule under test.
  create temp table identity_probe (
    like public.recurrence_instances including defaults
  ) on commit drop;

  -- ── 1 · The identity index ──────────────────────────────────────────────
  -- Structure first: right schema, right table, unique, valid, ready, and the
  -- two columns that make an occurrence.
  select array(
           select a.attname
             from unnest(i.indkey) with ordinality as k(attnum, ord)
             join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
            order by k.ord
         ),
         pg_get_expr(i.indpred, i.indrelid)
    into v_columns, v_predicate
    from pg_index i
    join pg_class     ix on ix.oid = i.indexrelid
    join pg_class     tb on tb.oid = i.indrelid
    join pg_namespace ns on ns.oid = ix.relnamespace
   where ns.nspname = 'public'
     and ix.relname = 'recurrence_instances_one_per_rule_due_date'
     and tb.relname = 'recurrence_instances'
     and i.indisunique
     and i.indisvalid
     and i.indisready;

  if v_columns is null then
    raise exception 'occurrence identity: public.recurrence_instances_one_per_rule_due_date is missing, or is not a valid UNIQUE index on public.recurrence_instances (0064)';
  end if;

  if v_columns <> array['recurrence_id', 'due_date']::text[] then
    raise exception 'occurrence identity: the index covers (%), not (recurrence_id, due_date) — it would not stop a duplicated occurrence', array_to_string(v_columns, ', ');
  end if;

  -- Partial on purpose: a historical `confirmed` row holds `due_date NULL` and
  -- competes for no identity. A full index would let one unknown row block a
  -- real occurrence, which is the trap 0064 was built to avoid.
  if v_predicate is null then
    raise exception 'occurrence identity: the index is not partial — a row with an unknown due_date would compete for an identity it does not have';
  end if;

  -- The canonical predicate, deparsed by this server from the definition 0064
  -- ships. Anything else — narrower, wider, or merely different — is refused.
  -- There is no probe here because no set of probes would do: a predicate is a
  -- rule over every row that could ever exist, and any finite sample of dates
  -- and uuids passes `due_date >= date '2026-01-01'` while abandoning every
  -- occurrence older than that.
  create unique index identity_probe_canonical
      on identity_probe (recurrence_id, due_date)
   where due_date is not null;

  select pg_get_expr(i.indpred, i.indrelid)
    into v_canonical
    from pg_index i
   where i.indexrelid = 'identity_probe_canonical'::regclass;

  if v_predicate is distinct from v_canonical then
    raise exception 'occurrence identity: the index predicate is %, not % — it does not cover the same occurrences. If it is an equivalent rewrite, re-create the index in the canonical form', v_predicate, v_canonical;
  end if;

  -- ── 2 · The due-date CHECK ──────────────────────────────────────────────
  -- It has to exist AND be validated: one added `NOT VALID` enforces new rows
  -- while leaving everything already stored unexamined, which is exactly the
  -- data this is about.
  select pg_get_constraintdef(oid)
    into v_check_def
    from pg_constraint
   where conrelid = 'public.recurrence_instances'::regclass
     and conname  = 'chk_recurrence_instances_unresolved_has_due_date'
     and contype  = 'c'
     and convalidated;

  if v_check_def is null then
    raise exception 'unresolved due date: chk_recurrence_instances_unresolved_has_due_date is missing or NOT VALID (0064) — a pending row with no due_date would have no identity';
  end if;

  -- The REAL rule, copied onto the probe table and then exercised over its whole
  -- domain. `chk_recurrence_instances_status` (0011) limits `status` to three
  -- values and `due_date` is either known or not, so the six rows below are
  -- every case there is — an exhaustive truth table, not an example.
  --
  -- Both halves matter. A CHECK that refuses too much passes any test that only
  -- looks at what it rejects: `check (status = 'confirmed')` turns away a
  -- pending row with no vencimiento, and every legitimate pending occurrence
  -- along with it.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.recurrence_instances'::regclass
       and conname  = 'chk_recurrence_instances_status'
       and contype  = 'c'
       and convalidated
  ) then
    raise exception 'unresolved due date: chk_recurrence_instances_status is missing (0011) — status is unbounded, so the cases below would not be exhaustive';
  end if;

  execute format('alter table identity_probe add %s', v_check_def);

  for v_status, v_due, v_accepted in
    select * from (values
      -- An unresolved occurrence with no vencimiento has no identity: refused.
      ('pending',   null::date,        false),
      ('skipped',   null::date,        false),
      -- A historical confirmed row: 0064 leaves its due_date null on purpose.
      ('confirmed', null::date,        true),
      -- And everything WITH a vencimiento is legitimate, however old or far off.
      -- Two distant dates, because one would pass a rule bounded by a range.
      ('pending',   date '1999-01-01', true),
      ('skipped',   date '2099-12-31', true),
      ('confirmed', date '2026-06-23', true)
    ) as cases(status, due_date, accepted)
  loop
    begin
      insert into identity_probe (recurrence_id, user_id, scheduled_date, due_date, status)
      values (gen_random_uuid(), gen_random_uuid(),
              coalesce(v_due, date '2026-06-23'), v_due, v_status);
      if not v_accepted then
        raise exception 'unresolved due date: the CHECK accepts a % row with due_date % and must not (%)', v_status, coalesce(v_due::text, 'null'), v_check_def;
      end if;
    exception
      when check_violation then
        if v_accepted then
          raise exception 'unresolved due date: the CHECK rejects a % row with due_date %, which is a legitimate occurrence (%)', v_status, coalesce(v_due::text, 'null'), v_check_def;
        end if;
    end;
  end loop;

  -- And then the same exact-text argument as the index, on a clean copy: the
  -- truth table above covers every case the current schema allows, and the
  -- comparison is what keeps that claim true if a fourth status is ever added.
  create temp table canonical_probe (
    like public.recurrence_instances including defaults
  ) on commit drop;

  alter table canonical_probe
    add constraint chk_canonical check (status = 'confirmed' or due_date is not null);

  select pg_get_constraintdef(oid)
    into v_check_canon
    from pg_constraint
   where conrelid = 'canonical_probe'::regclass
     and conname  = 'chk_canonical';

  if v_check_def is distinct from v_check_canon then
    raise exception 'unresolved due date: the CHECK is %, not % — its rule is not the one its name claims. If it is an equivalent rewrite, re-create it in the canonical form', v_check_def, v_check_canon;
  end if;
end $$;
-- └── END SHARED CONTRACT ───────────────────────────────────────────────────┘


-- =============================================================================
-- 8.2 — RLS: políticas en todas las tablas
-- =============================================================================

do $$
declare
  t text;
  n int;
begin
  -- Verificar que RLS está habilitado en cada tabla
  for t in select unnest(array['currencies','institutions','card_networks','categories','subcategories'])
  loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relname = t and c.relrowsecurity = true
    ) then
      raise exception 'RLS no está habilitado en public.%', t;
    end if;
  end loop;

  -- currencies: al menos 1 política SELECT
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'currencies' and cmd = 'SELECT';
  if n < 1 then raise exception 'currencies: falta política SELECT'; end if;

  -- institutions: al menos 1 política SELECT
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'institutions' and cmd = 'SELECT';
  if n < 1 then raise exception 'institutions: falta política SELECT'; end if;

  -- card_networks: al menos 1 política SELECT
  select count(*) into n from pg_policies
  where schemaname = 'public' and tablename = 'card_networks' and cmd = 'SELECT';
  if n < 1 then raise exception 'card_networks: falta política SELECT'; end if;

  -- categories: debe tener SELECT, INSERT, UPDATE, DELETE
  for t in select unnest(array['SELECT','INSERT','UPDATE','DELETE'])
  loop
    select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'categories' and cmd = t;
    if n < 1 then raise exception 'categories: falta política %', t; end if;
  end loop;

  -- subcategories: debe tener SELECT, INSERT, UPDATE, DELETE
  for t in select unnest(array['SELECT','INSERT','UPDATE','DELETE'])
  loop
    select count(*) into n from pg_policies
    where schemaname = 'public' and tablename = 'subcategories' and cmd = t;
    if n < 1 then raise exception 'subcategories: falta política %', t; end if;
  end loop;

  raise notice '✓ 8.2 — RLS habilitado y políticas presentes en todas las tablas';
end $$;


-- =============================================================================
-- 8.2B — RLS COMPORTAMIENTO: categorías del sistema no modificables
-- Simula un usuario autenticado con set_config y verifica que UPDATE/DELETE
-- a categorías de sistema falla silenciosamente (0 rows afectadas por RLS).
-- =============================================================================

do $$
declare
  fake_uid  text := '00000000-0000-0000-0000-000000000099';
  cat_id    uuid;
  rows_up   int;
  rows_del  int;
begin
  -- Obtenemos el id de una categoría de sistema
  select id into cat_id from categories where user_id is null limit 1;
  if cat_id is null then
    raise exception 'No hay categorías de sistema para probar RLS';
  end if;

  -- Simulamos jwt claims de un usuario autenticado
  perform set_config('request.jwt.claims',
    json_build_object('sub', fake_uid, 'role', 'authenticated')::text, true);

  -- Intentamos UPDATE sobre categoría del sistema desde el rol authenticated
  set local role authenticated;

  update categories set name = 'HACK' where id = cat_id and user_id is null;
  get diagnostics rows_up = row_count;

  delete from categories where id = cat_id and user_id is null;
  get diagnostics rows_del = row_count;

  -- Volvemos al rol superuser
  reset role;

  if rows_up > 0 then
    raise exception 'RLS FALLA: UPDATE afectó % fila(s) en categoría de sistema', rows_up;
  end if;
  if rows_del > 0 then
    raise exception 'RLS FALLA: DELETE afectó % fila(s) en categoría de sistema', rows_del;
  end if;

  raise notice '✓ 8.2B — RLS bloquea UPDATE/DELETE en categorías de sistema (0 filas afectadas)';
end $$;


-- =============================================================================
-- 8.2C — COBERTURA RLS: invariante sobre TODA tabla de public (migración 0055)
--
-- A diferencia de 8.2, que enumera cinco tablas por nombre, esta sección deriva
-- el universo de pg_class. Es deliberado: una aserción que enumera solo cubre lo
-- que alguien se acordó de agregar, y el riesgo real es la tabla 21 — la que se
-- cree en el dashboard sin RLS y sin que nadie vuelva a leer este archivo.
--
-- Acá las migraciones se aplican a mano desde el SQL Editor, sin CLI ni pipeline,
-- así que esta es la única defensa automatizada contra una tabla mal configurada.
--
-- Ver openspec/changes/harden-supabase-anon-boundary/.
-- =============================================================================

do $$
declare
  faltante text;
  n int;
begin
  -- (1) Toda tabla de public tiene RLS habilitado.
  for faltante in
    select c.relname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity = false
     order by c.relname
  loop
    raise exception 'COBERTURA RLS: public.% no tiene RLS habilitado', faltante;
  end loop;

  -- (2) Toda tabla con RLS tiene al menos una policy. RLS habilitado y cero
  --     policies deniega todo, que es seguro pero casi siempre es un olvido:
  --     la tabla queda ilegible incluso para su dueño.
  for faltante in
    select c.relname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity = true
       and not exists (
         select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
       )
     order by c.relname
  loop
    raise exception 'COBERTURA RLS: public.% tiene RLS pero cero policies', faltante;
  end loop;

  -- (3) El rol anon no conserva privilegios sobre ninguna tabla de public.
  --     Es la red que hace que (1) deje de ser un punto único de falla: aunque
  --     alguien cree una tabla sin RLS, sin GRANT no es legible sin sesión.
  for faltante in
    select c.relname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and (has_table_privilege('anon', c.oid, 'SELECT')
         or has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE'))
     order by c.relname
  loop
    raise exception 'COBERTURA RLS: anon conserva privilegios sobre public.%', faltante;
  end loop;

  -- (4) anon tampoco ejecuta ninguna función de public. Ojo: `revoke from public`
  --     NO alcanza — el default privilege de Supabase le otorga EXECUTE a anon
  --     DIRECTAMENTE sobre cada función nueva, así que hay que revocarle a anon.
  --     Se excluyen las funciones de trigger: PostgREST las expone en /rpc/ igual,
  --     pero devuelven `trigger` y Postgres rechaza invocarlas fuera de un trigger,
  --     así que su EXECUTE heredado de PUBLIC no habilita nada.
  for faltante in
    select p.proname
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')
     order by p.proname
  loop
    raise exception 'COBERTURA RLS: anon conserva EXECUTE sobre public.%', faltante;
  end loop;

  -- (5) Y los default privileges no se lo van a devolver en el próximo objeto,
  --     ni para tablas ni para funciones. Se mira solo el rol que crea los objetos
  --     de la app (current_user): los defaults de un rol aplican únicamente a lo
  --     que ESE rol crea, así que un rol interno de Supabase no expone nada nuestro.
  select count(*) into n
    from pg_default_acl d
    join pg_namespace ns on ns.oid = d.defaclnamespace
    join pg_roles     rol on rol.oid = d.defaclrole
   where ns.nspname = 'public'
     and d.defaclobjtype in ('r', 'f')
     and rol.rolname = current_user
     and array_to_string(d.defaclacl, ',') like '%anon=%';
  if n > 0 then
    raise exception 'COBERTURA RLS: el default de % en public sigue otorgando a anon', current_user;
  end if;

  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r';

  raise notice '✓ 8.2C — cobertura RLS OK en las % tablas de public; anon sin privilegios', n;
end $$;


-- =============================================================================
-- 8.3 — CRUD DE CATEGORÍAS PROPIAS
-- Inserta una categoría de usuario, la actualiza y la archiva, verifica
-- que todo funciona, y limpia los datos de prueba.
-- =============================================================================

do $$
declare
  fake_uid   uuid    := '00000000-0000-0000-0000-000000000099';
  test_cat   uuid;
  test_sub   uuid;
  cat_name   text;
  sub_active boolean;
begin
  -- Aseguramos que auth.users tenga la fila del usuario de prueba
  -- (necesario por la FK en categories.user_id → auth.users)
  -- Usamos INSERT OR IGNORE via ON CONFLICT
  insert into auth.users (id, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
  values (
    fake_uid,
    'test-validate@example.com',
    'placeholder',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    'authenticated'
  )
  on conflict (id) do nothing;

  -- CREATE: insertar categoría propia
  insert into categories (user_id, name, canonical_name, type)
  values (fake_uid, 'Mascotas Test', 'mascotas-test', 'expense')
  returning id into test_cat;

  if test_cat is null then
    raise exception 'CRUD: no se pudo insertar categoría propia';
  end if;

  -- UPDATE: actualizar nombre
  update categories set name = 'Mascotas Actualizado'
  where id = test_cat and user_id = fake_uid;

  select name into cat_name from categories where id = test_cat;
  if cat_name <> 'Mascotas Actualizado' then
    raise exception 'CRUD: UPDATE no funcionó, name = %', cat_name;
  end if;

  -- canonical_name NO debe cambiar con el UPDATE de name
  if not exists (
    select 1 from categories where id = test_cat and canonical_name = 'mascotas-test'
  ) then
    raise exception 'CRUD: canonical_name fue modificado por el UPDATE (no debería)';
  end if;

  -- CREATE subcategoría propia
  insert into subcategories (category_id, user_id, name, canonical_name)
  values (test_cat, fake_uid, 'Veterinario', 'veterinario')
  returning id into test_sub;

  if test_sub is null then
    raise exception 'CRUD: no se pudo insertar subcategoría propia';
  end if;

  -- ARCHIVE: is_active = false
  update categories set is_active = false where id = test_cat and user_id = fake_uid;

  if exists (select 1 from categories where id = test_cat and is_active = true) then
    raise exception 'CRUD: archivado falló, is_active sigue en true';
  end if;

  -- DELETE categoría propia (primero el child, luego el parent)
  delete from subcategories where id = test_sub and user_id = fake_uid;
  delete from categories    where id = test_cat and user_id = fake_uid;

  if exists (select 1 from categories where id = test_cat) then
    raise exception 'CRUD: DELETE de categoría propia no funcionó';
  end if;

  -- Limpieza del usuario de prueba
  delete from auth.users where id = fake_uid;

  raise notice '✓ 8.3 — CRUD de categorías propias OK (insert, update, archive, delete subcategoría, delete categoría)';
end $$;


-- =============================================================================
-- RESUMEN FINAL
-- Si llegás acá, todos los DO-blocks pasaron sin RAISE EXCEPTION.
-- =============================================================================

select
  '✓ validate_schema.sql completado sin errores' as resultado,
  (select count(*)::int from currencies)                            as currencies,
  (select count(*)::int from institutions)                          as institutions,
  (select count(*)::int from card_networks)                         as card_networks,
  (select count(*)::int from categories where user_id is null)      as system_categories,
  (select count(*)::int from subcategories where user_id is null)   as system_subcategories,
  (select count(*)::int from pg_policies where schemaname = 'public'
     and tablename in ('currencies','institutions','card_networks','categories','subcategories')
  )                                                                  as total_rls_policies;


rollback;   -- deshace el usuario de prueba y cualquier otro cambio de test
