-- Shared module (Compartido) — part 2 of 2: schema, RLS, functions.
--
-- Run AFTER 0022_settlement_type.sql (which commits the 'settlement' enum value).
--
-- A "household" links two people who split expenses. A shared expense is a REAL
-- ledger transaction (is_shared=true + household_id) plus a per-member split in
-- shared_expense_split; the debt is DERIVED (never persisted), per currency.
-- Settling a debt creates two `settlement`-type movements (one per member, in
-- different accounts owned by different users) tracked by the `settlement` table.
--
-- This is v3's FIRST cross-user read: a member may SELECT the other's shared
-- transactions. Writes stay owner-only. Membership checks go through the
-- SECURITY DEFINER helper is_household_member() (so RLS on household_member does
-- not recurse). See openspec/changes/add-shared-expenses/design.md.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Tables
-- ═══════════════════════════════════════════════════════════════════════════

create table public.household (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  is_active     boolean     not null default true,
  -- [{ "user_id": uuid, "percentage": int }, ...] — default split applied to new shared expenses
  default_split jsonb       not null default '[]'::jsonb,
  created_by    uuid        not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),

  constraint chk_household_name_len check (char_length(name) between 1 and 50)
);

create table public.household_member (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.household(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),

  unique (household_id, user_id)
);

create table public.household_invite (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.household(id) on delete cascade,
  code         text        not null unique,
  invited_by   uuid        not null references auth.users(id) on delete cascade,
  expires_at   timestamptz not null,
  used_by      uuid        references auth.users(id) on delete set null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Per-member split of a shared expense (or, for installments, of a child cuota).
-- Also carries the inherited split of a shared reimbursement linked to a shared
-- expense (the debt formula flips the sign by the linked movement's type).
create table public.shared_expense_split (
  id              uuid          primary key default gen_random_uuid(),
  transaction_id  uuid          not null references public.transactions(id) on delete cascade,
  household_id    uuid          not null references public.household(id) on delete cascade,
  user_id         uuid          not null references auth.users(id) on delete cascade,
  percentage      smallint      not null,
  amount_assigned numeric(18,2) not null,
  created_at      timestamptz   not null default now(),

  constraint chk_split_percentage check (percentage between 1 and 100),
  constraint chk_split_amount_non_negative check (amount_assigned >= 0),
  unique (transaction_id, user_id)
);

-- One row per debt settlement. Each leg is a `type='settlement'` transaction in
-- the corresponding member's own account. `receiver_movement_id` is NULL until
-- the receiver assigns the account where the money landed (handshake liviano).
create table public.settlement (
  id                  uuid          primary key default gen_random_uuid(),
  household_id        uuid          not null references public.household(id) on delete cascade,
  payer_id            uuid          not null references auth.users(id) on delete restrict,
  payer_movement_id   uuid          not null references public.transactions(id) on delete cascade,
  receiver_id         uuid          not null references auth.users(id) on delete restrict,
  receiver_movement_id uuid         references public.transactions(id) on delete set null,
  amount              numeric(18,2) not null,
  currency_code       text          not null references public.currencies(code),
  status              text          not null default 'pending_receipt',
  created_at          timestamptz   not null default now(),
  resolved_at         timestamptz,

  constraint chk_settlement_amount_positive check (amount > 0),
  constraint chk_settlement_currency check (currency_code in ('ARS', 'USD')),
  constraint chk_settlement_status check (status in ('pending_receipt', 'completed')),
  constraint chk_settlement_distinct check (payer_id <> receiver_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. transactions: sharing + settlement columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_shared            boolean not null default false,
  ADD COLUMN IF NOT EXISTS household_id         uuid    null references public.household(id) on delete set null,
  ADD COLUMN IF NOT EXISTS settlement_direction text    null;

-- settlement_direction is set on (and only on) settlement rows; 'out' = payer leg
-- (debits the account), 'in' = receiver leg (credits the account). See D11.
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_settlement_direction_valid
    CHECK (settlement_direction IS NULL OR settlement_direction IN ('out', 'in'));

ALTER TABLE public.transactions
  ADD CONSTRAINT chk_settlement_direction_presence
    CHECK (
      (type::text =  'settlement' AND settlement_direction IS NOT NULL)
      OR
      (type::text <> 'settlement' AND settlement_direction IS NULL)
    );

-- A shared row must carry its household; a non-shared row must not.
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_is_shared_has_household
    CHECK (
      (is_shared = true  AND household_id IS NOT NULL)
      OR
      (is_shared = false AND household_id IS NULL)
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Membership helper (SECURITY DEFINER so RLS on household_member never
--    recurses when policies call it). Used by every household-scoped policy.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_member
     where household_id = p_household_id
       and user_id = auth.uid()
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Enforce max 2 members per household (Phase 1).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_household_member_max_two()
returns trigger language plpgsql as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.household_member
   where household_id = NEW.household_id;
  if v_count >= 2 then
    raise exception 'household % already has the maximum of 2 members', NEW.household_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_household_member_max_two on public.household_member;
create trigger trg_household_member_max_two
  before insert on public.household_member
  for each row execute function public.trg_fn_household_member_max_two();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Indexes
-- ═══════════════════════════════════════════════════════════════════════════

create index idx_household_member_user      on public.household_member (user_id);
create index idx_household_member_household  on public.household_member (household_id);
create index idx_household_invite_code       on public.household_invite (code);
create index idx_shared_split_transaction    on public.shared_expense_split (transaction_id);
create index idx_shared_split_household       on public.shared_expense_split (household_id);
create index idx_settlement_household         on public.settlement (household_id);
create index idx_settlement_receiver_pending
  on public.settlement (receiver_id)
  where status = 'pending_receipt';
create index idx_transactions_household
  on public.transactions (household_id)
  where is_shared = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS — new tables
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.household enable row level security;

create policy "members select own household"
  on public.household for select
  using (is_household_member(id));

create policy "users insert own household"
  on public.household for insert
  with check (created_by = auth.uid());

create policy "members update own household"
  on public.household for update
  using (is_household_member(id))
  with check (is_household_member(id));

-- household_member ----------------------------------------------------------

alter table public.household_member enable row level security;

create policy "members select household members"
  on public.household_member for select
  using (is_household_member(household_id));

-- A user may add only themselves (create-household and join-by-code flows).
create policy "users add themselves to household"
  on public.household_member for insert
  with check (user_id = auth.uid());

-- A user may remove only themselves (leave household).
create policy "users remove themselves from household"
  on public.household_member for delete
  using (user_id = auth.uid());

-- household_invite ----------------------------------------------------------

alter table public.household_invite enable row level security;

-- Members see all their invites; a not-yet-member can read a still-valid unused
-- invite in order to join by code (codes are random GRANA-XXXX).
create policy "read household invites"
  on public.household_invite for select
  using (
    is_household_member(household_id)
    OR (used_by IS NULL AND expires_at > now())
  );

create policy "members create invites"
  on public.household_invite for insert
  with check (is_household_member(household_id) AND invited_by = auth.uid());

-- The joining user claims a valid invite by marking it used.
create policy "joining user claims invite"
  on public.household_invite for update
  using (used_by IS NULL AND expires_at > now())
  with check (used_by = auth.uid());

-- shared_expense_split ------------------------------------------------------

alter table public.shared_expense_split enable row level security;

create policy "members select household splits"
  on public.shared_expense_split for select
  using (is_household_member(household_id));

-- Writes only on splits of one's OWN transaction (the debt must not be tampered
-- with by the other member). Owner of the transaction is gated by transactions RLS.
create policy "owner inserts own splits"
  on public.shared_expense_split for insert
  with check (
    is_household_member(household_id)
    AND exists (
      select 1 from public.transactions t
       where t.id = shared_expense_split.transaction_id
         and t.user_id = auth.uid()
    )
  );

create policy "owner updates own splits"
  on public.shared_expense_split for update
  using (
    exists (
      select 1 from public.transactions t
       where t.id = shared_expense_split.transaction_id
         and t.user_id = auth.uid()
    )
  );

create policy "owner deletes own splits"
  on public.shared_expense_split for delete
  using (
    exists (
      select 1 from public.transactions t
       where t.id = shared_expense_split.transaction_id
         and t.user_id = auth.uid()
    )
  );

-- settlement ----------------------------------------------------------------

alter table public.settlement enable row level security;

create policy "members select household settlements"
  on public.settlement for select
  using (is_household_member(household_id));

create policy "payer inserts settlement"
  on public.settlement for insert
  with check (is_household_member(household_id) AND payer_id = auth.uid());

-- Receiver assigns account (completes) and payer edits while pending: gated by
-- membership; the action layer enforces who-can-do-what. Reversal of a COMPLETED
-- settlement goes through reverse_settlement() (crosses the user boundary).
create policy "members update household settlements"
  on public.settlement for update
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "payer deletes pending settlement"
  on public.settlement for delete
  using (is_household_member(household_id) AND payer_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RLS — transactions SELECT widened to shared rows of one's household
--    (INSERT/UPDATE/DELETE stay strictly owner-only — see 0008).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "users select own transactions" on public.transactions;
create policy "users select own transactions"
  on public.transactions for select
  using (
    user_id = auth.uid()
    OR (is_shared = true AND household_id IS NOT NULL AND is_household_member(household_id))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Reverse a COMPLETED settlement (D10). The receiver leg is another user's
--    movement, which owner-only write RLS forbids touching from the client.
--    This SECURITY DEFINER function deletes both legs atomically, after checking
--    the caller belongs to the settlement's household. Deleting the payer leg
--    cascades the settlement row away (FK ON DELETE CASCADE).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reverse_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.settlement;
begin
  select * into v_s from public.settlement where id = p_settlement_id;
  if not found then
    raise exception 'settlement % not found', p_settlement_id;
  end if;

  if not exists (
    select 1 from public.household_member
     where household_id = v_s.household_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized to reverse this settlement';
  end if;

  if v_s.receiver_movement_id is not null then
    delete from public.transactions where id = v_s.receiver_movement_id;
  end if;
  -- Cascades the settlement row away via settlement.payer_movement_id FK.
  delete from public.transactions where id = v_s.payer_movement_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_ok boolean;
BEGIN
  -- Tables
  PERFORM 1 FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('household','household_member','household_invite',
                        'shared_expense_split','settlement')
   GROUP BY table_schema HAVING COUNT(*) = 5;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: shared tables missing'; END IF;

  -- transactions columns
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions'
     AND column_name IN ('is_shared','household_id','settlement_direction')
   GROUP BY table_name HAVING COUNT(*) = 3;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions sharing columns missing'; END IF;

  -- Helper function is SECURITY DEFINER
  SELECT p.prosecdef INTO v_ok
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_household_member';
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: is_household_member missing or not SECURITY DEFINER';
  END IF;

  -- reverse_settlement is SECURITY DEFINER
  SELECT p.prosecdef INTO v_ok
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reverse_settlement';
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: reverse_settlement missing or not SECURITY DEFINER';
  END IF;

  -- max-2 trigger
  SELECT COUNT(*) = 1 INTO v_ok FROM pg_trigger
   WHERE tgname = 'trg_household_member_max_two' AND NOT tgisinternal;
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: max-2 member trigger missing'; END IF;

  -- RLS enabled on all new tables
  SELECT bool_and(c.relrowsecurity) INTO v_ok
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('household','household_member','household_invite',
                       'shared_expense_split','settlement');
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: RLS not enabled on all shared tables';
  END IF;

  -- transactions select policy widened (1 select policy expected)
  SELECT COUNT(*) = 1 INTO v_ok FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'transactions'
     AND policyname = 'users select own transactions' AND cmd = 'SELECT';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: transactions select policy missing'; END IF;

  -- partial index on shared transactions
  SELECT COUNT(*) = 1 INTO v_ok FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'transactions'
     AND indexname = 'idx_transactions_household';
  IF NOT v_ok THEN RAISE EXCEPTION 'SELF-CHECK FAILED: idx_transactions_household missing'; END IF;

  RAISE NOTICE 'shared migration validated: tables, columns, helper, trigger, RLS, policies, indexes.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Final summary
-- ═══════════════════════════════════════════════════════════════════════════

select
  '✓ 0023 shared applied' as status,
  (select count(*)::int from information_schema.tables
    where table_schema = 'public'
      and table_name in ('household','household_member','household_invite',
                         'shared_expense_split','settlement')) as shared_tables,
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('household','household_member','household_invite',
                        'shared_expense_split','settlement')) as shared_policies,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_household_member') as helper_exists,
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reverse_settlement') as reverse_fn_exists;
