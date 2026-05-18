create table categories (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete cascade,
  name           text        not null,
  canonical_name text        not null,
  icon           text,
  color          text,
  type           text        not null check (type in ('income', 'expense', 'both')),
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now()
);

-- system categories: one canonical_name per system (user_id IS NULL)
create unique index categories_system_canonical_name_unique
  on categories (canonical_name)
  where user_id is null;

-- user categories: one canonical_name per user
create unique index categories_user_canonical_name_unique
  on categories (user_id, canonical_name)
  where user_id is not null;

create table subcategories (
  id             uuid        primary key default gen_random_uuid(),
  category_id    uuid        not null references categories(id) on delete cascade,
  user_id        uuid        references auth.users(id) on delete cascade,
  name           text        not null,
  canonical_name text        not null,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),

  unique (category_id, canonical_name)
);

-- RLS: categories
alter table categories enable row level security;

create policy "authenticated users can read categories"
  on categories for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "users can insert own categories"
  on categories for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own categories"
  on categories for update
  to authenticated
  using (user_id = auth.uid());

create policy "users can delete own categories"
  on categories for delete
  to authenticated
  using (user_id = auth.uid());

-- RLS: subcategories
alter table subcategories enable row level security;

create policy "authenticated users can read subcategories"
  on subcategories for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "users can insert own subcategories"
  on subcategories for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update own subcategories"
  on subcategories for update
  to authenticated
  using (user_id = auth.uid());

create policy "users can delete own subcategories"
  on subcategories for delete
  to authenticated
  using (user_id = auth.uid());
