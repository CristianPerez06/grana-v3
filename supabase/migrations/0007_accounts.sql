-- Accounts module: cash and bank accounts with multi-currency support.
-- Tables: accounts, account_currencies.
-- Trigger: creates a default Efectivo (cash) account on new user signup.

-- ─── Type ───────────────────────────────────────────────────────────────────

create type account_type as enum ('cash', 'bank');
-- Future: ALTER TYPE account_type ADD VALUE 'credit'; (add-accounts-credit-cards)

-- ─── Tables ─────────────────────────────────────────────────────────────────

create table public.accounts (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  name           text        not null,
  type           account_type not null,
  institution_id uuid        references public.institutions(id) on delete restrict,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),

  constraint chk_cash_no_institution
    check (type != 'cash' or institution_id is null),
  constraint chk_bank_has_institution
    check (type != 'bank' or institution_id is not null)
);

create table public.account_currencies (
  id                   uuid         primary key default gen_random_uuid(),
  account_id           uuid         not null references public.accounts(id) on delete cascade,
  currency_code        text         not null references public.currencies(code),
  initial_balance      numeric(18,2) not null default 0,
  initial_balance_date date         not null default current_date,
  is_active            boolean      not null default true,
  created_at           timestamptz  not null default now(),

  constraint chk_account_currencies_supported
    check (currency_code in ('ARS', 'USD')),
  constraint chk_initial_balance_non_negative
    check (initial_balance >= 0),

  unique (account_id, currency_code)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_accounts_user
  on public.accounts (user_id);

create index idx_account_currencies_account
  on public.account_currencies (account_id);

-- ─── RLS — accounts ──────────────────────────────────────────────────────────

alter table public.accounts enable row level security;

create policy "users select own accounts"
  on public.accounts for select
  using (user_id = auth.uid());

create policy "users insert own accounts"
  on public.accounts for insert
  with check (user_id = auth.uid());

create policy "users update own accounts"
  on public.accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own accounts"
  on public.accounts for delete
  using (user_id = auth.uid());

-- ─── RLS — account_currencies ────────────────────────────────────────────────

alter table public.account_currencies enable row level security;

create policy "users select own account currencies"
  on public.account_currencies for select
  using (
    exists (
      select 1 from public.accounts a
       where a.id = account_currencies.account_id
         and a.user_id = auth.uid()
    )
  );

create policy "users insert own account currencies"
  on public.account_currencies for insert
  with check (
    exists (
      select 1 from public.accounts a
       where a.id = account_currencies.account_id
         and a.user_id = auth.uid()
    )
  );

create policy "users update own account currencies"
  on public.account_currencies for update
  using (
    exists (
      select 1 from public.accounts a
       where a.id = account_currencies.account_id
         and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
       where a.id = account_currencies.account_id
         and a.user_id = auth.uid()
    )
  );

create policy "users delete own account currencies"
  on public.account_currencies for delete
  using (
    exists (
      select 1 from public.accounts a
       where a.id = account_currencies.account_id
         and a.user_id = auth.uid()
    )
  );

-- ─── Default Efectivo trigger ─────────────────────────────────────────────────

-- Separate from handle_new_user (profiles) so each module owns its bootstrap.
-- SECURITY DEFINER lets the insert bypass RLS on accounts + account_currencies.
create or replace function public.handle_new_user_default_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  insert into public.accounts (user_id, name, type, institution_id)
  values (new.id, 'Efectivo', 'cash', null)
  returning id into v_account_id;

  insert into public.account_currencies (account_id, currency_code, initial_balance, initial_balance_date)
  values
    (v_account_id, 'ARS', 0, current_date),
    (v_account_id, 'USD', 0, current_date);

  return new;
end;
$$;

create trigger on_auth_user_created_default_account
  after insert on auth.users
  for each row execute function public.handle_new_user_default_account();

-- ─── Backfill: create Efectivo for users who registered before this migration ─

do $$
declare
  v_user       record;
  v_account_id uuid;
begin
  for v_user in
    select u.id
      from auth.users u
     where not exists (
       select 1 from public.accounts a
        where a.user_id = u.id and a.type = 'cash'
     )
  loop
    insert into public.accounts (user_id, name, type, institution_id)
    values (v_user.id, 'Efectivo', 'cash', null)
    returning id into v_account_id;

    insert into public.account_currencies (account_id, currency_code, initial_balance, initial_balance_date)
    values
      (v_account_id, 'ARS', 0, current_date),
      (v_account_id, 'USD', 0, current_date);

    raise notice 'Created default Efectivo for user %', v_user.id;
  end loop;
end $$;

-- ─── Self-check ───────────────────────────────────────────────────────────────

do $$
declare
  v_policy_count_accounts         int;
  v_policy_count_account_currencies int;
  v_rls_accounts                  boolean;
  v_rls_account_currencies        boolean;
begin
  -- Tables exist
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'accounts'
  ) then
    raise exception 'accounts table was not created';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'account_currencies'
  ) then
    raise exception 'account_currencies table was not created';
  end if;

  -- account_type enum exists
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'account_type'
  ) then
    raise exception 'account_type enum was not created';
  end if;

  -- RLS on accounts
  select c.relrowsecurity into v_rls_accounts
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'accounts';
  if not v_rls_accounts then
    raise exception 'RLS is not enabled on public.accounts';
  end if;

  -- RLS on account_currencies
  select c.relrowsecurity into v_rls_account_currencies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'account_currencies';
  if not v_rls_account_currencies then
    raise exception 'RLS is not enabled on public.account_currencies';
  end if;

  -- 4 policies on accounts
  select count(*) into v_policy_count_accounts
    from pg_policies
   where schemaname = 'public' and tablename = 'accounts'
     and policyname in (
       'users select own accounts',
       'users insert own accounts',
       'users update own accounts',
       'users delete own accounts'
     );
  if v_policy_count_accounts <> 4 then
    raise exception 'Expected 4 RLS policies on accounts, found %', v_policy_count_accounts;
  end if;

  -- 4 policies on account_currencies
  select count(*) into v_policy_count_account_currencies
    from pg_policies
   where schemaname = 'public' and tablename = 'account_currencies'
     and policyname in (
       'users select own account currencies',
       'users insert own account currencies',
       'users update own account currencies',
       'users delete own account currencies'
     );
  if v_policy_count_account_currencies <> 4 then
    raise exception 'Expected 4 RLS policies on account_currencies, found %', v_policy_count_account_currencies;
  end if;

  -- Trigger function exists and is SECURITY DEFINER
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'handle_new_user_default_account'
       and p.prosecdef = true
  ) then
    raise exception 'handle_new_user_default_account is missing or not SECURITY DEFINER';
  end if;

  -- Trigger is attached to auth.users
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
     where t.tgname = 'on_auth_user_created_default_account'
       and n.nspname = 'auth' and c.relname = 'users'
  ) then
    raise exception 'trigger on_auth_user_created_default_account is missing on auth.users';
  end if;

  -- Indexes exist
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'accounts'
       and indexname = 'idx_accounts_user'
  ) then
    raise exception 'idx_accounts_user index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'account_currencies'
       and indexname = 'idx_account_currencies_account'
  ) then
    raise exception 'idx_account_currencies_account index is missing';
  end if;

  raise notice 'accounts migration validated: tables, enum, RLS, 8 policies, function, trigger, indexes — all present.';
end $$;

-- ─── Final summary ────────────────────────────────────────────────────────────

select
  '✓ accounts migration applied successfully' as status,
  exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'accounts'
  ) as accounts_table_exists,
  exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'account_currencies'
  ) as account_currencies_table_exists,
  (
    select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'accounts'
  ) as accounts_rls_enabled,
  (
    select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'account_currencies'
  ) as account_currencies_rls_enabled,
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public'
       and tablename in ('accounts', 'account_currencies')
  ) as policy_count,
  exists (
    select 1 from pg_trigger
     where tgname = 'on_auth_user_created_default_account'
  ) as trigger_installed,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'handle_new_user_default_account'
  ) as function_installed,
  (
    select count(*)::int from public.accounts where type = 'cash'
  ) as default_accounts_count;
