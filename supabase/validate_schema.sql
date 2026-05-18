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

  -- categories: exactamente 17 del sistema
  select count(*) into n from categories where user_id is null;
  if n <> 17 then raise exception 'categories sistema: esperaba 17, encontré %', n; end if;

  -- categorías de gastos: 12
  select count(*) into n from categories where user_id is null and type = 'expense';
  if n <> 12 then raise exception 'categories expense: esperaba 12, encontré %', n; end if;

  -- categorías de ingresos: 5
  select count(*) into n from categories where user_id is null and type = 'income';
  if n <> 5 then raise exception 'categories income: esperaba 5, encontré %', n; end if;

  -- subcategories: exactamente 31 del sistema
  select count(*) into n from subcategories where user_id is null;
  if n <> 31 then raise exception 'subcategories sistema: esperaba 31, encontré %', n; end if;

  raise notice '✓ 8.1D — seed data OK (3 currencies, >= 23 institutions, 7 card_networks, 17 categories, 31 subcategories)';
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
    'ropa-y-calzado','hogar','servicios','tecnologia','impuestos',
    'financiero','otros-gastos','sueldo','freelance','inversiones',
    'otros-ingresos','reintegros-cashback'
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
    'nafta','uber-cabify','transporte-publico','estacionamiento',
    'farmacia','medico','obra-social',
    'netflix-streaming','cine','salidas','juegos',
    'luz','gas','internet','celular',
    'ropa','calzado','accesorios',
    'alquiler','limpieza','muebles','reparaciones',
    'impuesto-de-sellos','comision-compra-usd',
    'constitucion-plazo-fijo','intereses-cuenta-remunerada'
  ])
  loop
    if not exists (
      select 1 from subcategories
      where canonical_name = slug and user_id is null
    ) then
      raise exception 'Falta subcategoría sistema con canonical_name = ''%''', slug;
    end if;
  end loop;

  raise notice '✓ 8.1E — canonical_names de sistema OK (17 categories, 31 subcategories)';
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

  -- comida tiene exactamente 5 subcategorías
  select count(*) into n
  from subcategories s
  join categories c on c.id = s.category_id
  where c.canonical_name = 'comida' and c.user_id is null and s.user_id is null;

  if n <> 5 then
    raise exception 'comida debería tener 5 subcategorías del sistema, tiene %', n;
  end if;

  raise notice '✓ 8.1F — integridad referencial subcategories → categories OK';
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
