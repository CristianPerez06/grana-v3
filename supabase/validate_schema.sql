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
