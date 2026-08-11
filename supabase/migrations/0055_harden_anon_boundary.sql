-- Frontera de acceso a datos — el rol `anon` deja de tener privilegios sobre `public`,
-- y el allowlist de columnas de `profiles` baja de la capa de queries a la base.
--
-- Run AFTER 0054_seed_juntadas_and_viajes.sql.
--
-- NOTA DE NUMERACIÓN: esta migración se aplicó en Supabase como `0054` mientras la
-- 0054_seed_juntadas_and_viajes todavía no estaba en `main`. Al rebasar se renumeró
-- a 0055 para no colisionar. El SQL aplicado es el mismo — no hay que volver a
-- correrla; Supabase no registra el nombre del archivo.
--
-- Ver openspec/changes/harden-supabase-anon-boundary/.
--
-- CONTEXTO — esto NO es respuesta a incidente. La auditoría del 7-ago-2026 verificó
-- en las dos direcciones que hoy no hay nada explotable: ninguna migración menciona
-- `anon`, las tres policies `using (true)` (currencies, institutions, card_networks)
-- están acotadas `to authenticated`, no existe la service_role key en el código, hay
-- cero API routes y cero uso de Storage; y la sonda PostgREST sin sesión contra el
-- proyecto devolvió `200 []` en las 20 tablas, `401` en el INSERT anónimo, y policy
-- counts que reconcilian exactamente con la historia de migraciones (drift cero).
--
-- Lo que esta migración arregla es que esa garantía es EMERGENTE: se sostiene porque
-- ~58 policies dereferencian `auth.uid()` una por una, no porque exista una regla que
-- lo diga. Una sola tabla futura sin `ENABLE ROW LEVEL SECURITY` la rompe entera.
--
--   A · PROFILES         La policy "members read co-member profiles" (0024) otorga
--     SELECT sobre la FILA ENTERA del conviviente — email, financial_timezone,
--     onboarding_completed_at — cuando el comentario de su propia migración declara
--     que la intención era `full_name`. Hoy el allowlist vive en el query layer
--     (packages/shared/src/queries.ts:63 y :392). RLS no tiene granularidad de
--     columna, así que la policy otorga las columnas que la tabla TENGA EN CADA
--     MOMENTO: el día que se agregue un `phone`, se filtra solo. Se reemplaza por un
--     RPC SECURITY DEFINER con allowlist explícito.
--
--   B · GRANTS A ANON    Supabase otorga ALL sobre las tablas de `public` a `anon` en
--     su bootstrap, y nada en este repo lo revoca (no hay un solo REVOKE ... FROM anon
--     en supabase/migrations/). RLS es el único punto de falla. Tras esta migración,
--     una tabla sin policy tampoco es legible: no hay GRANT que lo permita.
--
--   C · EXECUTE          Seis funciones quedaron con el `EXECUTE TO PUBLIC` default de
--     PostgreSQL, o sea invocables por `anon`. Todas se autoguardan hoy (raise
--     'not_authenticated', o auth.uid() null que evalúa falso), pero el repo ya tiene
--     el patrón correcto en 0048/0050/0051/0052 — estas quedaron afuera por olvido.
--
-- EFECTO OBSERVABLE ESPERADO: la sonda anónima pasa de `200 []` a `401`/permission
-- denied. NO es una regresión — es la diferencia entre "te dejo entrar y no hay nada"
-- y "no te dejo entrar". El GRANT se evalúa antes que RLS. Efecto lateral bienvenido:
-- `200 []` confirma que la tabla existe; `401` no confirma nada.
--
-- El rol `authenticated` NO se toca en ningún bloque.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- A · profiles — el allowlist de columnas baja a la base
-- ═══════════════════════════════════════════════════════════════════════════

-- La policy de 0024 se va entera. El nombre del conviviente pasa a servirse por RPC.
drop policy if exists "members read co-member profiles" on public.profiles;

-- shares_household_with existía SOLO para esa policy (verificado: sus 4 ocurrencias en
-- el repo están todas dentro de 0024). Sin la policy es código muerto, y además es un
-- oráculo booleano ejecutable por anon. Se elimina en vez de revocarse.
-- Ojo: is_household_member es distinta y se queda — la usan 22 policies vivas.
drop function if exists public.shares_household_with(uuid);

-- Lectura de los profiles del hogar del invocante, acotada a (id, full_name).
--
-- Sin parámetros a propósito: el conjunto lo determina la base a partir de auth.uid(),
-- así no hay ids de entrada en los que confiar ni que re-validar. Incluye al propio
-- invocante, porque getHousehold necesita los profiles de TODOS los miembros y así el
-- call site no tiene que unir dos fuentes.
--
-- SECURITY DEFINER para poder leer las filas de los convivientes, que las policies de
-- `profiles` (auth.uid() = id) ya no alcanzan. El allowlist de columnas es la firma de
-- retorno: no hay forma de pedirle una columna que no declara.
create or replace function public.get_household_member_profiles()
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
    from public.profiles p
   where p.id in (
     select other.user_id
       from public.household_member self
       join public.household_member other
         on other.household_id = self.household_id
      where self.user_id = auth.uid()
   )
$$;

comment on function public.get_household_member_profiles() is
  'Profiles de los miembros del hogar del invocante (incluido él mismo), acotados a (id, full_name). Reemplaza la policy "members read co-member profiles" de 0024, que otorgaba la fila entera — email incluido. El allowlist vive en la firma de retorno, no en el select del cliente.';

revoke execute on function public.get_household_member_profiles() from public;
grant  execute on function public.get_household_member_profiles() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- B · El rol `anon` pierde los privilegios de tabla sobre `public`
-- ═══════════════════════════════════════════════════════════════════════════

-- Tablas existentes.
revoke all on all tables in schema public from anon;

-- Tablas futuras. `ALTER DEFAULT PRIVILEGES` sin FOR ROLE aplica SOLO a current_user,
-- y Supabase registra defaults bajo más de un rol (típicamente `postgres` y
-- `supabase_admin`), así que la versión sin FOR ROLE deja filas vivas en pg_default_acl.
-- Se enumeran los roles reales en vez de asumir cuál es.
--
-- Los defaults de un rol solo aplican a las tablas que ESE rol crea. Las nuestras las
-- crea quien corre el SQL Editor (`postgres`), así que ése es el que importa; si algún
-- rol interno de Supabase queda fuera de nuestro alcance, se reporta pero no aborta.
-- Cubre TABLES y FUNCTIONS: Supabase tiene defaults para ambos, y el de funciones es
-- el que hace que una función recién creada le otorgue EXECUTE a anon directamente
-- (ver bloque C).
do $defaults$
declare
  r        record;
  v_failed text[] := '{}';
begin
  for r in
    select rol.rolname,
           case d.defaclobjtype when 'r' then 'tables' else 'functions' end as objkind
      from pg_default_acl d
      join pg_namespace n   on n.oid   = d.defaclnamespace
      join pg_roles     rol on rol.oid = d.defaclrole
     where n.nspname = 'public'
       and d.defaclobjtype in ('r', 'f')
       and array_to_string(d.defaclacl, ',') like '%anon=%'
  loop
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke all on %s from anon',
        r.rolname, r.objkind
      );
    exception when insufficient_privilege then
      -- No somos dueños de ese rol. Se acumula para el reporte del self-check.
      v_failed := v_failed || (r.rolname || '/' || r.objkind);
    end;
  end loop;

  if array_length(v_failed, 1) > 0 then
    raise notice '0055: no se pudieron revocar los defaults de: %. Solo importa si alguno de esos roles crea objetos de la app.', array_to_string(v_failed, ', ');
  end if;
end $defaults$;

-- ═══════════════════════════════════════════════════════════════════════════
-- C · EXECUTE explícito en las funciones que quedaron con el default
-- ═══════════════════════════════════════════════════════════════════════════

-- CRÍTICO: el `grant ... to authenticated` no es opcional. Cuando una policy invoca
-- una función, ésta corre con el rol del invocante — si `authenticated` pierde EXECUTE
-- sobre is_household_member, las 22 policies que la llaman NO devuelven cero filas:
-- fallan con `permission denied for function`.
--
-- IGUAL DE CRÍTICO, y descubierto al aplicar esta migración: `revoke ... from public`
-- NO le saca el acceso a anon. Supabase tiene un default privilege que otorga EXECUTE
-- a anon DIRECTAMENTE sobre cada función nueva, así que anon no depende de PUBLIC y
-- revocarle a PUBLIC lo deja intacto. Hay que revocarle a anon por separado.
--
-- Esto además implica que el patrón de 0048/0050/0051/0052 (`revoke from public` a
-- secas) nunca le quitó el acceso a anon en esas cuatro funciones. El revoke blanket
-- de acá las cubre a todas de una, y el self-check las verifica explícitamente.
--
-- anon no necesita ejecutar NADA de public: los flujos de auth viven en el schema
-- `auth`, y todo lo de la app requiere sesión.
revoke execute on all functions in schema public from anon;

revoke execute on function public.is_household_member(uuid) from public;
grant  execute on function public.is_household_member(uuid) to authenticated;

revoke execute on function public.get_movements_page(jsonb, integer, integer) from public;
grant  execute on function public.get_movements_page(jsonb, integer, integer) to authenticated;

revoke execute on function public.join_household_by_code(text) from public;
grant  execute on function public.join_household_by_code(text) to authenticated;

revoke execute on function public.register_settlement(uuid, numeric, text, date) from public;
grant  execute on function public.register_settlement(uuid, numeric, text, date) to authenticated;

revoke execute on function public.confirm_settlement(uuid, uuid, date) from public;
grant  execute on function public.confirm_settlement(uuid, uuid, date) to authenticated;

revoke execute on function public.reverse_settlement(uuid) from public;
grant  execute on function public.reverse_settlement(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- D · Self-check
-- ═══════════════════════════════════════════════════════════════════════════

do $check$
declare
  v_count   integer;
  v_secdef  boolean;
  v_missing text;
begin
  -- A1 · la policy de 0024 ya no existe
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and tablename = 'profiles'
     and policyname = 'members read co-member profiles';
  if v_count <> 0 then
    raise exception 'SELF-CHECK FAILED: la policy "members read co-member profiles" sigue viva';
  end if;

  -- A2 · profiles queda con exactamente 2 policies (select propio + update propio)
  select count(*) into v_count
    from pg_policies where schemaname = 'public' and tablename = 'profiles';
  if v_count <> 2 then
    raise exception 'SELF-CHECK FAILED: profiles tiene % policies, se esperaban 2', v_count;
  end if;

  -- A3 · shares_household_with eliminada
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'shares_household_with';
  if v_count <> 0 then
    raise exception 'SELF-CHECK FAILED: shares_household_with sigue existiendo';
  end if;

  -- A4 · el RPC nuevo existe y es SECURITY DEFINER
  select p.prosecdef into v_secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_household_member_profiles';
  if v_secdef is distinct from true then
    raise exception 'SELF-CHECK FAILED: get_household_member_profiles falta o no es SECURITY DEFINER';
  end if;

  -- B1 · anon no conserva privilegio sobre ninguna tabla de public
  select count(*) into v_count
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'SELECT')
       or has_table_privilege('anon', c.oid, 'INSERT')
       or has_table_privilege('anon', c.oid, 'UPDATE')
       or has_table_privilege('anon', c.oid, 'DELETE'));
  if v_count <> 0 then
    raise exception 'SELF-CHECK FAILED: anon conserva privilegios sobre % tablas de public', v_count;
  end if;

  -- B2 · el default del rol que efectivamente crea las tablas de la app (current_user,
  --      que en el SQL Editor es `postgres`) ya no otorga nada a anon.
  select count(*) into v_count
    from pg_default_acl d
    join pg_namespace n   on n.oid   = d.defaclnamespace
    join pg_roles     rol on rol.oid = d.defaclrole
   where n.nspname = 'public' and d.defaclobjtype in ('r', 'f')
     and rol.rolname = current_user
     and array_to_string(d.defaclacl, ',') like '%anon=%';
  if v_count <> 0 then
    raise exception 'SELF-CHECK FAILED: el default de % en public sigue otorgando tablas a anon', current_user;
  end if;

  -- B3 · si algún OTRO rol conserva default hacia anon, se informa sin abortar: sus
  --      defaults solo aplican a las tablas que ese rol cree, y los roles internos de
  --      Supabase no crean tablas de la app.
  select string_agg(rol.rolname, ', ') into v_missing
    from pg_default_acl d
    join pg_namespace n   on n.oid   = d.defaclnamespace
    join pg_roles     rol on rol.oid = d.defaclrole
   where n.nspname = 'public' and d.defaclobjtype in ('r', 'f')
     and rol.rolname <> current_user
     and array_to_string(d.defaclacl, ',') like '%anon=%';
  if v_missing is not null then
    raise notice '0055: los roles % conservan default hacia anon en public (fuera de nuestro alcance; solo aplica a tablas que ellos creen).', v_missing;
  end if;

  -- C · Cobertura de EXECUTE, derivada de pg_proc en vez de una lista de firmas.
  --
  --     La primera versión enumeraba las 12 firmas a mano y abortó con
  --     `function "public.get_account_balance_sums(uuid[])" does not exist`: la 0052
  --     había dropeado esa firma al reemplazarla por la variante con `date`. Una
  --     aserción que enumera envejece con el schema — el mismo motivo por el que la
  --     sección 8.2C de validate_schema.sql deriva su universo de pg_class.
  --
  --     Se excluyen las funciones de trigger: devuelven `trigger` y Postgres rechaza
  --     invocarlas fuera de un trigger, así que su EXECUTE heredado de PUBLIC no
  --     habilita nada.

  -- C1 · authenticated conserva EXECUTE sobre toda función invocable de public.
  --      Si esto falla, las policies que las invocan rompen con permission denied
  --      (ver el comentario CRÍTICO del bloque C).
  for v_missing in
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
     order by 1
  loop
    raise exception 'SELF-CHECK FAILED: authenticated perdió EXECUTE sobre public.%', v_missing;
  end loop;

  -- C2 · y anon no lo conserva sobre ninguna
  for v_missing in
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')
     order by 1
  loop
    raise exception 'SELF-CHECK FAILED: anon conserva EXECUTE sobre public.%', v_missing;
  end loop;

  raise notice '0055 validada: allowlist de profiles en la base, anon sin privilegios de tabla ni EXECUTE sobre public, cobertura de funciones derivada de pg_proc.';
end $check$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — correr entero si hay que volver atrás.
--
-- Los `revoke execute` del bloque C NO se revierten a propósito: son inocuos y dejan
-- las funciones alineadas con el patrón que ya usan 0048/0050/0051/0052. No hay
-- migración de datos que revertir; todo el change es DDL de privilegios + una función.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- begin;
--
-- drop function if exists public.get_household_member_profiles();
--
-- create or replace function public.shares_household_with(p_other uuid)
-- returns boolean
-- language sql
-- security definer
-- stable
-- set search_path = public
-- as $$
--   select exists (
--     select 1
--       from public.household_member self
--       join public.household_member other
--         on other.household_id = self.household_id
--      where self.user_id = auth.uid()
--        and other.user_id = p_other
--   );
-- $$;
--
-- create policy "members read co-member profiles"
--   on public.profiles for select
--   using (shares_household_with(id));
--
-- grant all on all tables in schema public to anon;
-- alter default privileges in schema public grant all on tables to anon;
--
-- commit;
