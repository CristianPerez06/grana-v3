-- Categorías del hogar — un tercer dueño para categorías y subcategorías.
--
-- Run AFTER 0062_seed_institutions_catalog.sql.
--
-- Hasta acá una categoría era del sistema (`user_id IS NULL`) o de un usuario
-- (`user_id = auth.uid()`), y la política de lectura era exactamente esa
-- disyunción (0005). Un gasto compartido puede llevar una categoría PERSONAL del
-- miembro que lo cargó, y para el otro miembro esa categoría no existe: la dona,
-- la lista y los chips de filtro le muestran el gasto sin nombre. Caso real:
-- "Hogar - La Foresta", creada por un miembro, en blanco para el otro.
--
-- Esta migración agrega el hogar como dueño:
--
--   · `household_id` en `categories` y `subcategories`. Una categoría del hogar
--     CONSERVA `user_id` (quién la creó) y suma `household_id`. Nunca
--     `user_id IS NULL` con hogar: "del sistema" se reconoce por esa columna y
--     sus nombres se traducen por `canonical_name`, así que una fila del hogar
--     con `user_id` nulo se leería como del sistema y su nombre no aparecería.
--   · Unicidad de `canonical_name` por alcance: sistema / propias de un usuario /
--     del hogar de un mismo hogar. Un miembro puede tener "Hogar" propia y el
--     hogar "Hogar"; las pantallas las distinguen con la marca "Hogar".
--   · RLS por membresía, con el helper `is_household_member` (0023): los
--     miembros leen, usan y editan las categorías de su hogar.
--   · Herencia en subcategorías: una subcategoría bajo una categoría del hogar
--     es del hogar (trigger). Una subcategoría puede ser del hogar bajo una
--     categoría del sistema ("Comida > Verdulería" compartida).
--   · INVARIANTE: un movimiento compartido nunca referencia una categoría o
--     subcategoría propia. Al compartir, la categoría propia pasa al hogar del
--     movimiento (trigger sobre `transactions` y `recurrences`). La regla vive en
--     la base para que aplique a web, nativo y SQL manual por igual, y es la
--     misma función que el backfill corre una vez sobre lo ya cargado.
--   · Salir del hogar: `detach_household_classifications` copia como propias
--     las categorías del hogar que el que sale usa en filas no compartidas y
--     las repunta, antes de que la membresía se borre (lo llama
--     `leaveHouseholdCore`).
--
-- Supabase es online-only: aplicar pegando en el SQL Editor y regenerar los
-- tipos. Todo corre en una transacción: un self-check que falla aborta entero.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Columnas y forma de propiedad
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.categories
  add column if not exists household_id uuid null
    references public.household(id) on delete set null;

alter table public.subcategories
  add column if not exists household_id uuid null
    references public.household(id) on delete set null;

-- Las tres formas son excluyentes: sistema (sin user_id, sin hogar), propia
-- (user_id, sin hogar), del hogar (user_id Y hogar). Nunca hogar sin user_id.
alter table public.categories
  drop constraint if exists chk_categories_household_has_owner,
  add constraint chk_categories_household_has_owner
    check (household_id is null or user_id is not null);

alter table public.subcategories
  drop constraint if exists chk_subcategories_household_has_owner,
  add constraint chk_subcategories_household_has_owner
    check (household_id is null or user_id is not null);

comment on column public.categories.household_id is
  'Hogar dueño de la categoría. NULL = del sistema (user_id nulo) o propia (user_id presente). Con valor, la ven, usan y editan todos los miembros del hogar; user_id sigue diciendo quién la creó.';

comment on column public.subcategories.household_id is
  'Hogar dueño de la subcategoría. Heredado de la categoría padre cuando esta es del hogar; puede ser del hogar bajo una categoría del sistema.';

create index if not exists idx_categories_household
  on public.categories (household_id)
  where household_id is not null;

create index if not exists idx_subcategories_household
  on public.subcategories (household_id)
  where household_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Unicidad de canonical_name por alcance
-- ═══════════════════════════════════════════════════════════════════════════

-- El índice de propias (0005) cubría toda fila con user_id; ahora una fila con
-- user_id puede ser del hogar, y esas se comparan entre sí, no con las propias.
drop index if exists public.categories_user_canonical_name_unique;

create unique index categories_user_canonical_name_unique
  on public.categories (user_id, canonical_name)
  where user_id is not null and household_id is null;

create unique index categories_household_canonical_name_unique
  on public.categories (household_id, canonical_name)
  where household_id is not null;

-- Subcategorías: siguen únicas por categoría padre (0005). Sin cambios.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS por membresía
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "authenticated users can read categories" on public.categories;
drop policy if exists "users can insert own categories"          on public.categories;
drop policy if exists "users can update own categories"          on public.categories;
drop policy if exists "users can delete own categories"          on public.categories;

create policy "authenticated users can read categories"
  on public.categories for select
  to authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "users can insert own or household categories"
  on public.categories for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (household_id is null or public.is_household_member(household_id))
  );

create policy "members can update own or household categories"
  on public.categories for update
  to authenticated
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  )
  with check (
    user_id is not null
    and (household_id is null or public.is_household_member(household_id))
  );

create policy "members can delete own or household categories"
  on public.categories for delete
  to authenticated
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  );

drop policy if exists "authenticated users can read subcategories" on public.subcategories;
drop policy if exists "users can insert own subcategories"          on public.subcategories;
drop policy if exists "users can update own subcategories"          on public.subcategories;
drop policy if exists "users can delete own subcategories"          on public.subcategories;

create policy "authenticated users can read subcategories"
  on public.subcategories for select
  to authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy "users can insert own or household subcategories"
  on public.subcategories for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (household_id is null or public.is_household_member(household_id))
  );

create policy "members can update own or household subcategories"
  on public.subcategories for update
  to authenticated
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  )
  with check (
    user_id is not null
    and (household_id is null or public.is_household_member(household_id))
  );

create policy "members can delete own or household subcategories"
  on public.subcategories for delete
  to authenticated
  using (
    user_id = auth.uid()
    or (household_id is not null and public.is_household_member(household_id))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Herencia: una subcategoría de una categoría del hogar es del hogar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Va en la base y no en el cliente: dejarlo a cada app es el patrón "mirror …
-- keep in sync" que el repo prohíbe, y dejaría subcategorías privadas colgando
-- de una categoría que los dos miembros ven.

create or replace function public.trg_fn_subcategory_inherits_household()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_household uuid;
begin
  select c.household_id into v_parent_household
    from public.categories c
   where c.id = NEW.category_id;

  if v_parent_household is not null then
    NEW.household_id := v_parent_household;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_subcategory_inherits_household on public.subcategories;
create trigger trg_subcategory_inherits_household
  before insert or update of category_id, household_id on public.subcategories
  for each row execute function public.trg_fn_subcategory_inherits_household();

-- Y al revés: cuando una categoría propia pasa al hogar, sus subcategorías
-- propias la siguen. Solo las propias del mismo dueño: una subcategoría del
-- sistema bajo una categoría propia no existe, y una del hogar ya está.
create or replace function public.trg_fn_category_household_cascades()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.household_id is not null
     and NEW.household_id is distinct from OLD.household_id then
    update public.subcategories s
       set household_id = NEW.household_id
     where s.category_id = NEW.id
       and s.user_id is not null
       and s.household_id is distinct from NEW.household_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_category_household_cascades on public.categories;
create trigger trg_category_household_cascades
  after update of household_id on public.categories
  for each row execute function public.trg_fn_category_household_cascades();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Invariante: un movimiento compartido no referencia categorías propias
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `promote_classification_to_household` pasa al hogar la categoría y la
-- subcategoría PROPIAS de una clasificación. Es SECURITY DEFINER porque escribe
-- sobre `categories` desde un trigger de `transactions`: el dueño de la categoría
-- es quien comparte, así que la política de UPDATE lo permitiría en el caso
-- normal, pero no conviene depender de eso en todos los caminos (el RPC
-- `unshare_movement`, un UPDATE por SQL). `search_path` fijo y sin parámetros
-- que vengan del cliente: solo toca `household_id` de las dos filas
-- referenciadas, y solo cuando ya son propias de un usuario.
--
-- Solo promueve categorías cuyo dueño es MIEMBRO del hogar del movimiento. Una
-- fila compartida con la categoría propia de un tercero no debería existir
-- (RLS no deja elegirla), pero si existiera, promoverla regalaría la categoría
-- de alguien de afuera al hogar.

create or replace function public.promote_classification_to_household(
  p_household_id  uuid,
  p_category_id   uuid,
  p_subcategory_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_household_id is null then
    return;
  end if;

  if p_category_id is not null then
    update public.categories c
       set household_id = p_household_id
     where c.id = p_category_id
       and c.user_id is not null
       and c.household_id is null
       and exists (
         select 1 from public.household_member hm
          where hm.household_id = p_household_id and hm.user_id = c.user_id
       );
  end if;

  if p_subcategory_id is not null then
    update public.subcategories s
       set household_id = p_household_id
     where s.id = p_subcategory_id
       and s.user_id is not null
       and s.household_id is null
       and exists (
         select 1 from public.household_member hm
          where hm.household_id = p_household_id and hm.user_id = s.user_id
       );
  end if;
end;
$$;

revoke execute on function public.promote_classification_to_household(uuid, uuid, uuid) from public;
-- La ejecutan los triggers (como dueño de la función) y el backfill de abajo.

-- Los dos triggers son SECURITY DEFINER: corren con los privilegios del dueño de
-- la función y no del usuario que insertó la fila, que no tiene (ni debe tener)
-- permiso para invocar `promote_classification_to_household` a mano.
create or replace function public.trg_fn_shared_row_promotes_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_shared and NEW.household_id is not null then
    perform public.promote_classification_to_household(
      NEW.household_id, NEW.category_id, NEW.subcategory_id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_shared_transaction_promotes_classification on public.transactions;
create trigger trg_shared_transaction_promotes_classification
  after insert or update of is_shared, household_id, category_id, subcategory_id
  on public.transactions
  for each row execute function public.trg_fn_shared_row_promotes_classification();

-- Las reglas compartidas no tienen `is_shared`: su marca es `household_id`
-- (0045). Mismo efecto, misma función.
create or replace function public.trg_fn_shared_recurrence_promotes_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.household_id is not null then
    perform public.promote_classification_to_household(
      NEW.household_id, NEW.category_id, NEW.subcategory_id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_shared_recurrence_promotes_classification on public.recurrences;
create trigger trg_shared_recurrence_promotes_classification
  after insert or update of household_id, category_id, subcategory_id
  on public.recurrences
  for each row execute function public.trg_fn_shared_recurrence_promotes_classification();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Backfill: la misma regla, una vez, sobre lo ya cargado
-- ═══════════════════════════════════════════════════════════════════════════

do $backfill$
declare
  r record;
begin
  for r in
    select distinct t.household_id, t.category_id, t.subcategory_id
      from public.transactions t
     where t.is_shared and t.household_id is not null
       and (t.category_id is not null or t.subcategory_id is not null)
    union
    select distinct rc.household_id, rc.category_id, rc.subcategory_id
      from public.recurrences rc
     where rc.household_id is not null
       and (rc.category_id is not null or rc.subcategory_id is not null)
  loop
    perform public.promote_classification_to_household(
      r.household_id, r.category_id, r.subcategory_id
    );
  end loop;
end $backfill$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6b. Salir del hogar: copias propias de lo que el que sale usa en privado
-- ═══════════════════════════════════════════════════════════════════════════
-- Al salir, las categorías del hogar dejan de ser legibles para quien se va
-- (RLS por membresía, §3). Sus movimientos, reglas e instancias NO compartidos
-- que apuntaban a una del hogar quedarían clasificados con algo que ya no ve.
-- Este RPC corre ANTES de borrar la membresía (todavía es miembro, todavía lee
-- lo del hogar) y, en una transacción:
--   1. por cada categoría del hogar referenciada por sus filas propias, crea una
--      copia propia (mismo nombre, ícono, color, tipo y estado; `canonical_name`
--      con sufijo `-hogar` si ya tiene una propia igual);
--   2. copia bajo ella las subcategorías del hogar que referencia;
--   3. una subcategoría del hogar bajo una categoría del sistema se copia como
--      propia bajo la misma categoría (sufijo en `canonical_name`: la unicidad
--      de subcategorías es por categoría, no por dueño);
--   4. repunta esas filas a las copias.
-- Los compartidos no se tocan: el invariante del §5 exige que sigan apuntando a
-- lo del hogar. SECURITY INVOKER: cada lectura y escritura pasa por el RLS del
-- que sale, así que solo puede copiar lo que ve y repuntar lo que es suyo.
-- Devuelve la cantidad de categorías copiadas.

create or replace function public.detach_household_classifications(p_household_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_cat     record;
  v_sub     record;
  v_new_cat uuid;
  v_new_sub uuid;
  v_canon   text;
  v_n       int;
  v_copied  int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'not_member';
  end if;

  -- Categorías del hogar que el que sale referencia desde filas propias no
  -- compartidas, directamente o a través de una subcategoría del hogar.
  for v_cat in
    with refs as (
      select t.category_id, t.subcategory_id
        from public.transactions t
       where t.user_id = v_uid and not t.is_shared
      union
      select r.category_id, r.subcategory_id
        from public.recurrences r
       where r.user_id = v_uid and r.household_id is null
      union
      select ri.category_id, ri.subcategory_id
        from public.recurrence_instances ri
        join public.recurrences r on r.id = ri.recurrence_id
       where ri.user_id = v_uid and r.household_id is null
    )
    select c.*
      from public.categories c
     where c.household_id = p_household_id
       and (
         c.id in (select category_id from refs where category_id is not null)
         or c.id in (
           select s.category_id from public.subcategories s
            where s.household_id = p_household_id
              and s.id in (select subcategory_id from refs where subcategory_id is not null)
         )
       )
     order by c.name
  loop
    v_canon := v_cat.canonical_name;
    v_n := 0;
    while exists (
      select 1 from public.categories
       where user_id = v_uid and household_id is null and canonical_name = v_canon
    ) loop
      v_n := v_n + 1;
      v_canon := v_cat.canonical_name || '-hogar' || case when v_n > 1 then '-' || v_n else '' end;
    end loop;

    insert into public.categories (user_id, household_id, name, canonical_name, icon, color, type, is_active)
    values (v_uid, null, v_cat.name, v_canon, v_cat.icon, v_cat.color, v_cat.type, v_cat.is_active)
    returning id into v_new_cat;
    v_copied := v_copied + 1;

    -- Subcategorías del hogar bajo esta categoría que el que sale referencia.
    for v_sub in
      select s.*
        from public.subcategories s
       where s.category_id = v_cat.id and s.household_id = p_household_id
         and (
           exists (select 1 from public.transactions t
                    where t.user_id = v_uid and not t.is_shared and t.subcategory_id = s.id)
           or exists (select 1 from public.recurrences r
                       where r.user_id = v_uid and r.household_id is null and r.subcategory_id = s.id)
           or exists (select 1 from public.recurrence_instances ri
                       join public.recurrences r on r.id = ri.recurrence_id
                      where ri.user_id = v_uid and r.household_id is null and ri.subcategory_id = s.id)
         )
    loop
      -- La copia cuelga de una categoría nueva: no hay con qué colisionar.
      insert into public.subcategories (category_id, user_id, household_id, name, canonical_name, is_active)
      values (v_new_cat, v_uid, null, v_sub.name, v_sub.canonical_name, v_sub.is_active)
      returning id into v_new_sub;

      update public.transactions set subcategory_id = v_new_sub
       where user_id = v_uid and not is_shared and subcategory_id = v_sub.id;
      update public.recurrences set subcategory_id = v_new_sub
       where user_id = v_uid and household_id is null and subcategory_id = v_sub.id;
      update public.recurrence_instances ri set subcategory_id = v_new_sub
        from public.recurrences r
       where r.id = ri.recurrence_id and ri.user_id = v_uid and r.household_id is null
         and ri.subcategory_id = v_sub.id;
    end loop;

    update public.transactions set category_id = v_new_cat
     where user_id = v_uid and not is_shared and category_id = v_cat.id;
    update public.recurrences set category_id = v_new_cat
     where user_id = v_uid and household_id is null and category_id = v_cat.id;
    update public.recurrence_instances ri set category_id = v_new_cat
      from public.recurrences r
     where r.id = ri.recurrence_id and ri.user_id = v_uid and r.household_id is null
       and ri.category_id = v_cat.id;
  end loop;

  -- Subcategorías del hogar bajo una categoría que NO es del hogar (del
  -- sistema): la copia queda bajo la misma categoría, como propia.
  for v_sub in
    select s.*
      from public.subcategories s
      join public.categories c on c.id = s.category_id
     where s.household_id = p_household_id
       and c.household_id is distinct from p_household_id
       and (
         exists (select 1 from public.transactions t
                  where t.user_id = v_uid and not t.is_shared and t.subcategory_id = s.id)
         or exists (select 1 from public.recurrences r
                     where r.user_id = v_uid and r.household_id is null and r.subcategory_id = s.id)
         or exists (select 1 from public.recurrence_instances ri
                     join public.recurrences r on r.id = ri.recurrence_id
                    where ri.user_id = v_uid and r.household_id is null and ri.subcategory_id = s.id)
       )
     order by s.name
  loop
    v_canon := v_sub.canonical_name;
    v_n := 0;
    while exists (
      select 1 from public.subcategories
       where category_id = v_sub.category_id and canonical_name = v_canon
    ) loop
      v_n := v_n + 1;
      v_canon := v_sub.canonical_name || '-hogar' || case when v_n > 1 then '-' || v_n else '' end;
    end loop;

    insert into public.subcategories (category_id, user_id, household_id, name, canonical_name, is_active)
    values (v_sub.category_id, v_uid, null, v_sub.name, v_canon, v_sub.is_active)
    returning id into v_new_sub;

    update public.transactions set subcategory_id = v_new_sub
     where user_id = v_uid and not is_shared and subcategory_id = v_sub.id;
    update public.recurrences set subcategory_id = v_new_sub
     where user_id = v_uid and household_id is null and subcategory_id = v_sub.id;
    update public.recurrence_instances ri set subcategory_id = v_new_sub
      from public.recurrences r
     where r.id = ri.recurrence_id and ri.user_id = v_uid and r.household_id is null
       and ri.subcategory_id = v_sub.id;
  end loop;

  return v_copied;
end;
$$;

revoke execute on function public.detach_household_classifications(uuid) from public;
grant execute on function public.detach_household_classifications(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

do $check$
declare
  v_count int;
  v_secdef boolean;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'categories' and column_name = 'household_id'
  ) then
    raise exception 'SELF-CHECK FAILED: categories.household_id missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'subcategories' and column_name = 'household_id'
  ) then
    raise exception 'SELF-CHECK FAILED: subcategories.household_id missing';
  end if;

  select count(*) into v_count from pg_policies
   where schemaname = 'public' and tablename = 'categories';
  if v_count <> 4 then
    raise exception 'SELF-CHECK FAILED: expected 4 policies on categories, found %', v_count;
  end if;

  select count(*) into v_count from pg_policies
   where schemaname = 'public' and tablename = 'subcategories';
  if v_count <> 4 then
    raise exception 'SELF-CHECK FAILED: expected 4 policies on subcategories, found %', v_count;
  end if;

  select p.prosecdef into v_secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'promote_classification_to_household';
  if v_secdef is distinct from true then
    raise exception 'SELF-CHECK FAILED: promote_classification_to_household must be SECURITY DEFINER';
  end if;

  select p.prosecdef into v_secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'detach_household_classifications';
  if v_secdef is distinct from false then
    raise exception 'SELF-CHECK FAILED: detach_household_classifications must exist and be SECURITY INVOKER';
  end if;

  -- El invariante quedó satisfecho sobre lo ya cargado: ningún compartido
  -- referencia una categoría o subcategoría propia de un miembro.
  select count(*) into v_count
    from public.transactions t
    left join public.categories c on c.id = t.category_id
    left join public.subcategories s on s.id = t.subcategory_id
   where t.is_shared and t.household_id is not null
     and (
       (c.user_id is not null and c.household_id is null
        and exists (select 1 from public.household_member hm
                     where hm.household_id = t.household_id and hm.user_id = c.user_id))
       or
       (s.user_id is not null and s.household_id is null
        and exists (select 1 from public.household_member hm
                     where hm.household_id = t.household_id and hm.user_id = s.user_id))
     );
  if v_count > 0 then
    raise exception 'SELF-CHECK FAILED: % shared transaction(s) still reference a private classification', v_count;
  end if;

  raise notice 'household categories validated: columns, scoped uniqueness, 4+4 policies, leave RPC, promotion invariant holds.';
end $check$;

select '✓ 0063 household categories applied' as status;

commit;
