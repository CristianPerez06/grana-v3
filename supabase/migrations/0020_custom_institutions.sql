-- 0020_custom_institutions.sql
--
-- Lets users create their own institutions ("custom") when the bank or wallet
-- they need isn't in the curated catalog. Custom institutions coexist with the
-- catalog in the same `institutions` table, distinguished by `user_id`:
--   * `user_id IS NULL`     → catalog row (immutable, as before)
--   * `user_id = auth.uid()` → user-owned custom row (full CRUD via RLS)
--
-- The shape of `institutions` (name, slug, brand_color, icon_type, is_active)
-- stays uniform across both origins, so the avatar resolver, queries and types
-- consumed by the rest of the product do not branch on origin. See OpenSpec
-- change `custom-institutions` (design.md §1, Option A) for the full rationale
-- and the alternative that was rejected.
--
-- Constraints (decisions in design.md §2):
--   * `slug` is globally unique inside the catalog only — custom rows derive a
--     slug for shape uniformity but their real key is `(name, user_id)`.
--   * Custom rows are validated in a trigger to mirror the validation schema
--     in `@grana/validation` (defense in depth).
--   * `is_active` is forced to `true` for custom rows; soft-delete is out of
--     scope until a settings CRUD screen lands.

-- 1. New column. ON DELETE CASCADE wipes a user's custom institutions when the
-- auth user is deleted; their accounts already cascade through `accounts.user_id`.
alter table public.institutions
  add column user_id uuid references auth.users(id) on delete cascade;

comment on column public.institutions.user_id is
  'Owner of a user-created custom institution. NULL for the curated catalog (immutable). Non-NULL rows are visible only to their owner via RLS.';

-- 2. Replace the global UNIQUE(slug) with partial uniqueness:
--    catalog keeps a unique slug; custom uniqueness is by (name, user_id).
alter table public.institutions
  drop constraint institutions_slug_key;

create unique index institutions_slug_catalog_unique
  on public.institutions (slug)
  where user_id is null;

create unique index institutions_name_user_unique
  on public.institutions (name, user_id)
  where user_id is not null;

create index institutions_user_id_idx
  on public.institutions (user_id)
  where user_id is not null;

-- 3. Trigger to derive `slug` and validate fields for custom rows. It only
-- mutates rows when `user_id IS NOT NULL`, so the catalog (seeded with explicit
-- slugs in 0003) is untouched.
create or replace function public.fn_institution_custom_defaults()
  returns trigger
  language plpgsql
  as $$
  begin
    if new.user_id is not null then
      -- Trim + length check on name.
      new.name := trim(new.name);
      if length(new.name) < 1 or length(new.name) > 50 then
        raise exception 'institutions.name must be 1-50 characters after trim';
      end if;

      -- Derive slug from name: lowercase, non-alphanumeric → '-', trim leading/trailing '-'.
      new.slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
      if length(new.slug) = 0 then
        raise exception 'institutions.name produces an empty slug; use alphanumeric characters';
      end if;

      -- brand_color must be #RRGGBB.
      if new.brand_color is null or new.brand_color !~ '^#[0-9a-fA-F]{6}$' then
        raise exception 'institutions.brand_color must match #RRGGBB';
      end if;

      -- icon_type must be one of the curated values.
      if new.icon_type is null or new.icon_type not in ('bank', 'wallet') then
        raise exception 'institutions.icon_type must be bank or wallet';
      end if;

      -- Custom rows are always active; soft-delete is out of scope here.
      new.is_active := true;

      -- country is harmless to leave at its default, but force AR for now to
      -- avoid spurious values until a future change explicitly opens it.
      if new.country is null then
        new.country := 'AR';
      end if;
    end if;
    return new;
  end;
  $$;

create trigger trg_institution_custom_defaults
  before insert or update on public.institutions
  for each row
  execute function public.fn_institution_custom_defaults();

-- 4. Tighten the SELECT policy: each authenticated user sees the catalog plus
-- their own custom rows. The previous `using (true)` would have exposed every
-- user's custom rows to every other user once `user_id` rows started landing.
drop policy if exists "authenticated users can read institutions" on public.institutions;

create policy "users read catalog and their own custom institutions"
  on public.institutions
  for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

-- 5. Write policies: users can INSERT/UPDATE/DELETE only their own custom rows.
-- The catalog (user_id IS NULL) remains immutable to all users.
create policy "users insert their own custom institutions"
  on public.institutions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users update their own custom institutions"
  on public.institutions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete their own custom institutions"
  on public.institutions
  for delete
  to authenticated
  using (user_id = auth.uid());
