-- Profiles table — one row per auth user, kept in sync via trigger.

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new auth user is inserted.
-- security definer so the function runs with owner privileges and the
-- insert bypasses RLS (which has no insert policy by design).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Post-migration self-check: fail loudly if anything is missing.
-- Runs once at apply time and raises NOTICE on success.
do $$
declare
  policy_count int;
  rls_enabled  boolean;
begin
  -- Table
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'profiles'
  ) then
    raise exception 'profiles table was not created';
  end if;

  -- Expected columns
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'id'
  ) then raise exception 'profiles.id is missing'; end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'full_name'
  ) then raise exception 'profiles.full_name is missing'; end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'email'
  ) then raise exception 'profiles.email is missing'; end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'created_at'
  ) then raise exception 'profiles.created_at is missing'; end if;

  -- RLS is enabled
  select c.relrowsecurity into rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'profiles';
  if not rls_enabled then
    raise exception 'RLS is not enabled on public.profiles';
  end if;

  -- Both policies exist
  select count(*) into policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'profiles'
     and policyname in ('users read own profile', 'users update own profile');
  if policy_count <> 2 then
    raise exception 'Expected 2 RLS policies on profiles, found %', policy_count;
  end if;

  -- Trigger function exists and is SECURITY DEFINER
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user' and p.prosecdef = true
  ) then
    raise exception 'handle_new_user function is missing or not SECURITY DEFINER';
  end if;

  -- Trigger is attached to auth.users
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'auth' and c.relname = 'users'
  ) then
    raise exception 'trigger on_auth_user_created is missing on auth.users';
  end if;

  raise notice 'profiles migration validated: table, RLS, 2 policies, function, trigger — all present.';
end $$;

-- Final summary row visible in the SQL Editor results pane.
select
  '✓ profiles migration applied successfully' as status,
  (
    select count(*)::int
      from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
  ) as profile_columns,
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public' and tablename = 'profiles'
  ) as rls_policies,
  exists (
    select 1 from pg_trigger
     where tgname = 'on_auth_user_created'
  ) as trigger_installed,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) as function_installed;
