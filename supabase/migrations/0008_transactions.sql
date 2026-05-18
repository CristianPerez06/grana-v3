-- Transactions module: income and expense on cash/bank accounts.
-- Table: transactions.
-- Balance is always derived: initial_balance + SUM(income) - SUM(expense). Never persisted.

-- ─── Type ────────────────────────────────────────────────────────────────────

create type transaction_type as enum ('income', 'expense');
-- Future: ALTER TYPE transaction_type ADD VALUE 'transfer';  (add-transactions-transfer)
-- Future: ALTER TYPE transaction_type ADD VALUE 'adjustment'; (add-transactions-adjustment)

-- ─── Table ───────────────────────────────────────────────────────────────────

create table public.transactions (
  id              uuid             primary key default gen_random_uuid(),
  user_id         uuid             not null references auth.users(id) on delete cascade,
  account_id      uuid             not null references public.accounts(id) on delete cascade,
  category_id     uuid             references public.categories(id) on delete restrict,
  subcategory_id  uuid             references public.subcategories(id) on delete set null,
  type            transaction_type not null,
  amount          numeric(18,2)    not null,
  currency_code   text             not null references public.currencies(code),
  date            date             not null,
  description     text,
  is_verified     boolean          not null default false,
  created_at      timestamptz      not null default now(),

  constraint chk_amount_positive check (amount > 0)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_transactions_account_currency
  on public.transactions (account_id, currency_code);

create index idx_transactions_user_date
  on public.transactions (user_id, date desc);

create index idx_transactions_account_date
  on public.transactions (account_id, date desc, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.transactions enable row level security;

create policy "users select own transactions"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "users insert own transactions"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "users update own transactions"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own transactions"
  on public.transactions for delete
  using (user_id = auth.uid());

-- ─── Self-check ───────────────────────────────────────────────────────────────

do $$
declare
  v_rls_enabled  boolean;
  v_policy_count int;
begin
  -- Table exists
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'transactions'
  ) then
    raise exception 'transactions table was not created';
  end if;

  -- transaction_type enum exists
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'transaction_type'
  ) then
    raise exception 'transaction_type enum was not created';
  end if;

  -- RLS enabled
  select c.relrowsecurity into v_rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'transactions';
  if not v_rls_enabled then
    raise exception 'RLS is not enabled on public.transactions';
  end if;

  -- 4 policies
  select count(*) into v_policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'transactions'
     and policyname in (
       'users select own transactions',
       'users insert own transactions',
       'users update own transactions',
       'users delete own transactions'
     );
  if v_policy_count <> 4 then
    raise exception 'Expected 4 RLS policies on transactions, found %', v_policy_count;
  end if;

  -- FK to accounts
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     where tc.table_schema = 'public'
       and tc.table_name = 'transactions'
       and tc.constraint_type = 'FOREIGN KEY'
       and kcu.column_name = 'account_id'
  ) then
    raise exception 'FK account_id on transactions is missing';
  end if;

  -- FK to currencies
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     where tc.table_schema = 'public'
       and tc.table_name = 'transactions'
       and tc.constraint_type = 'FOREIGN KEY'
       and kcu.column_name = 'currency_code'
  ) then
    raise exception 'FK currency_code on transactions is missing';
  end if;

  -- chk_amount_positive
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'transactions'
       and constraint_name = 'chk_amount_positive'
       and constraint_type = 'CHECK'
  ) then
    raise exception 'chk_amount_positive constraint is missing';
  end if;

  -- Indexes
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'transactions'
       and indexname = 'idx_transactions_account_currency'
  ) then
    raise exception 'idx_transactions_account_currency index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'transactions'
       and indexname = 'idx_transactions_user_date'
  ) then
    raise exception 'idx_transactions_user_date index is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and tablename = 'transactions'
       and indexname = 'idx_transactions_account_date'
  ) then
    raise exception 'idx_transactions_account_date index is missing';
  end if;

  raise notice 'transactions migration validated: table, enum, RLS, 4 policies, FKs, check constraint, indexes — all present.';
end $$;

-- ─── Final summary ────────────────────────────────────────────────────────────

select
  '✓ transactions migration applied successfully' as status,
  exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'transactions'
  ) as transactions_table_exists,
  exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'transaction_type'
  ) as transaction_type_enum_exists,
  (
    select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'transactions'
  ) as rls_enabled,
  (
    select count(*)::int
      from pg_policies
     where schemaname = 'public' and tablename = 'transactions'
  ) as policy_count,
  exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'transactions'
       and indexname = 'idx_transactions_account_currency'
  ) as idx_account_currency_exists,
  exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'transactions'
       and indexname = 'idx_transactions_user_date'
  ) as idx_user_date_exists,
  exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'transactions'
       and indexname = 'idx_transactions_account_date'
  ) as idx_account_date_exists;
