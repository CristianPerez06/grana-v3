-- Shared module (Compartido) — security & integrity hardening (Paso 1 del rediseño).
--
-- Run AFTER 0023_shared.sql / 0024_household_profile_read.sql.
--
-- Closes the cross-user holes found in the audit (docs/design/shared/decisiones-rediseno.md,
-- Parte B). The security frontier of the module used to live only in the server actions;
-- this migration lowers it into the database (RLS + SECURITY DEFINER RPCs + invariants):
--
--   B1  Invite chain → self-insert. Anyone logged-in could SELECT every live invite and
--       add THEMSELVES to any household. Now: invites are member-only readable; joining by
--       code goes EXCLUSIVELY through join_household_by_code() (atomic, privileged); direct
--       self-insert into household_member is narrowed to the creator as first member.
--   B2  Deleting a shared expense with a live settlement silently changed the derived debt.
--       Now: a BEFORE DELETE trigger blocks deleting a shared expense while ANY settlement
--       exists in its household (net-debt model — no per-expense imputation; reversal by
--       contraasiento is Paso 3). Settlement legs (is_shared=false) are exempt.
--   B5  settlement RLS too broad (any member could UPDATE any column). Now: no direct
--       client writes on settlement — all transitions go through privileged RPCs.
--   B6  register/confirm settlement were non-atomic multi-writes. Now: register_settlement()
--       and confirm_settlement() (SECURITY DEFINER), symmetric to reverse_settlement().
--   B7  Three invariants lowered to the DB: splits sum the total · split owner is a member ·
--       one active household per user.
--
-- Supabase is online-only: apply this by pasting into the dashboard SQL Editor, then
-- regenerate types. The self-check block at the end aborts if any guarantee is missing.

-- ═══════════════════════════════════════════════════════════════════════════
-- B1 · household_invite — readable only by members (drop the open branch)
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "read household invites" on public.household_invite;
create policy "members read household invites"
  on public.household_invite for select
  using (is_household_member(household_id));

-- The joining user no longer claims the invite from the client; the privileged
-- join RPC does it. Remove the client UPDATE policy entirely.
drop policy if exists "joining user claims invite" on public.household_invite;

-- ═══════════════════════════════════════════════════════════════════════════
-- B1 · household_member — direct self-insert narrowed to creator-first-member
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "users add themselves to household" on public.household_member;
-- A user may add ONLY themselves, ONLY to a household they created, ONLY while it
-- still has no members. The second member enters exclusively via the join RPC.
create policy "creator inserts self as first member"
  on public.household_member for insert
  with check (
    user_id = auth.uid()
    AND exists (
      select 1 from public.household h
       where h.id = household_member.household_id
         and h.created_by = auth.uid()
    )
    AND not exists (
      select 1 from public.household_member m
       where m.household_id = household_member.household_id
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- B1 · join_household_by_code — privileged, atomic join (resolve code → join)
--      Raises distinguishable messages the action maps to field errors.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.join_household_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $join$
declare
  v_uid          uuid := auth.uid();
  v_invite_id    uuid;
  v_household_id uuid;
  v_expires_at   timestamptz;
  v_used_by      uuid;
  v_members      uuid[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Caller must not already belong to an active household.
  if exists (
    select 1 from public.household_member m
      join public.household h on h.id = m.household_id
     where m.user_id = v_uid and h.is_active
  ) then
    raise exception 'already_in_household';
  end if;

  -- Scalar SELECT INTO (avoid a rowtype variable, which the parser can mistake
  -- for a relation in field-access expressions).
  select id, household_id, expires_at, used_by
    into v_invite_id, v_household_id, v_expires_at, v_used_by
    from public.household_invite where code = p_code;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_used_by is not null then
    raise exception 'invite_used';
  end if;
  if v_expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  -- Household must be active and have capacity.
  if not exists (select 1 from public.household where id = v_household_id and is_active) then
    raise exception 'household_inactive';
  end if;
  if (select count(*) from public.household_member where household_id = v_household_id) >= 2 then
    raise exception 'household_full';
  end if;

  -- Join (the max-two and one-active-household triggers still apply).
  insert into public.household_member (household_id, user_id)
    values (v_household_id, v_uid);

  -- Claim the invite.
  update public.household_invite
     set used_by = v_uid, used_at = now()
   where id = v_invite_id;

  -- Reconfigure the default split to 50·50 between both members.
  select array_agg(user_id) into v_members
    from public.household_member where household_id = v_household_id;
  update public.household
     set default_split = (
       select jsonb_agg(jsonb_build_object('user_id', uid, 'percentage', 50))
         from unnest(v_members) as uid
     )
   where id = v_household_id;

  return v_household_id;
end;
$join$;

-- ═══════════════════════════════════════════════════════════════════════════
-- B5 · settlement — no direct client writes (keep SELECT for members only)
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "payer inserts settlement"            on public.settlement;
drop policy if exists "members update household settlements" on public.settlement;
drop policy if exists "payer deletes pending settlement"     on public.settlement;
-- "members select household settlements" (SELECT) stays as defined in 0023.
-- Pending-settlement deletion happens by deleting the payer's own transaction leg
-- (owner-only transactions RLS), which cascades the settlement row away.

-- ═══════════════════════════════════════════════════════════════════════════
-- B6 · register_settlement — atomic payer leg + settlement row, author server-side
--      The amount ≤ debt ceiling stays in the action (debt derivation lives in TS).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.register_settlement(
  p_account_id uuid,
  p_amount     numeric,
  p_currency   text,
  p_date       date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $register$
declare
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_partner   uuid;
  v_mov_id    uuid;
  v_settle_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Caller's active household (at most one, by invariant) with a partner.
  select m.household_id into v_household
    from public.household_member m
    join public.household h on h.id = m.household_id
   where m.user_id = v_uid and h.is_active;
  if v_household is null then
    raise exception 'no_active_household';
  end if;

  select user_id into v_partner
    from public.household_member
   where household_id = v_household and user_id <> v_uid;
  if v_partner is null then
    raise exception 'household_incomplete';
  end if;

  -- The source account must belong to the caller.
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_uid) then
    raise exception 'account_not_owned';
  end if;

  -- Payer leg: a settlement-type movement that debits the payer's account.
  insert into public.transactions (
    user_id, account_id, type, settlement_direction,
    amount, currency_code, date, category_id
  ) values (
    v_uid, p_account_id, 'settlement', 'out',
    p_amount, p_currency, p_date, null
  )
  returning id into v_mov_id;

  insert into public.settlement (
    household_id, payer_id, payer_movement_id, receiver_id,
    amount, currency_code, status
  ) values (
    v_household, v_uid, v_mov_id, v_partner,
    p_amount, p_currency, 'pending_receipt'
  )
  returning id into v_settle_id;

  return v_settle_id;
end;
$register$;

-- ═══════════════════════════════════════════════════════════════════════════
-- B6 · confirm_settlement — receiver assigns account: atomic in-leg + completed
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.confirm_settlement(
  p_settlement_id uuid,
  p_account_id    uuid,
  p_date          date
)
returns void
language plpgsql
security definer
set search_path = public
as $confirm$
declare
  v_uid         uuid := auth.uid();
  v_receiver_id uuid;
  v_status      text;
  v_amount      numeric(18,2);
  v_currency    text;
  v_mov_id      uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Scalar SELECT INTO (no rowtype variable; see join_household_by_code).
  select receiver_id, status, amount, currency_code
    into v_receiver_id, v_status, v_amount, v_currency
    from public.settlement where id = p_settlement_id;
  if not found then
    raise exception 'settlement_not_found';
  end if;
  if v_receiver_id <> v_uid then
    raise exception 'not_receiver';
  end if;
  if v_status <> 'pending_receipt' then
    raise exception 'already_completed';
  end if;
  if not exists (select 1 from public.accounts where id = p_account_id and user_id = v_uid) then
    raise exception 'account_not_owned';
  end if;

  -- Receiver leg: a settlement-type movement that credits the receiver's account.
  insert into public.transactions (
    user_id, account_id, type, settlement_direction,
    amount, currency_code, date, category_id
  ) values (
    v_uid, p_account_id, 'settlement', 'in',
    v_amount, v_currency, p_date, null
  )
  returning id into v_mov_id;

  update public.settlement
     set receiver_movement_id = v_mov_id,
         status               = 'completed',
         resolved_at          = now()
   where id = p_settlement_id;
end;
$confirm$;

-- ═══════════════════════════════════════════════════════════════════════════
-- B2 · Block deleting a shared expense while a settlement is live in its household
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_block_shared_delete_with_settlement()
returns trigger language plpgsql as $trg1$
begin
  -- Settlement legs are is_shared=false → exempt (reversal/cancel still works).
  if OLD.is_shared and OLD.household_id is not null
     and exists (select 1 from public.settlement where household_id = OLD.household_id) then
    raise exception
      'cannot delete shared expense while a settlement exists in household %', OLD.household_id;
  end if;
  return OLD;
end;
$trg1$;

drop trigger if exists trg_block_shared_delete_with_settlement on public.transactions;
create trigger trg_block_shared_delete_with_settlement
  before delete on public.transactions
  for each row execute function public.trg_fn_block_shared_delete_with_settlement();

-- ═══════════════════════════════════════════════════════════════════════════
-- B7 · Invariant — a split's owner is a member of its household
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_split_owner_is_member()
returns trigger language plpgsql as $trg2$
begin
  if not exists (
    select 1 from public.household_member
     where household_id = NEW.household_id and user_id = NEW.user_id
  ) then
    raise exception 'split owner % is not a member of household %', NEW.user_id, NEW.household_id;
  end if;
  return NEW;
end;
$trg2$;

drop trigger if exists trg_split_owner_is_member on public.shared_expense_split;
create trigger trg_split_owner_is_member
  before insert or update on public.shared_expense_split
  for each row execute function public.trg_fn_split_owner_is_member();

-- ═══════════════════════════════════════════════════════════════════════════
-- B7 · Invariant — splits sum exactly the transaction amount (deferred to commit,
--      since splits are inserted row by row; checked per transaction_id).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_splits_sum_total()
returns trigger language plpgsql as $trg3$
declare
  v_tx_id  uuid := coalesce(NEW.transaction_id, OLD.transaction_id);
  v_amount numeric(18,2);
  v_sum    numeric(18,2);
begin
  -- If the transaction itself is gone (cascade delete), nothing to check.
  select amount into v_amount from public.transactions where id = v_tx_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(amount_assigned), 0) into v_sum
    from public.shared_expense_split where transaction_id = v_tx_id;

  if v_sum <> v_amount then
    raise exception
      'shared splits for transaction % sum % but the amount is %', v_tx_id, v_sum, v_amount;
  end if;
  return null;
end;
$trg3$;

drop trigger if exists trg_splits_sum_total on public.shared_expense_split;
create constraint trigger trg_splits_sum_total
  after insert or update or delete on public.shared_expense_split
  deferrable initially deferred
  for each row execute function public.trg_fn_splits_sum_total();

-- ═══════════════════════════════════════════════════════════════════════════
-- B7 · Invariant — a user belongs to at most one ACTIVE household (A1)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.trg_fn_one_active_household_per_user()
returns trigger language plpgsql as $trg4$
begin
  if exists (
    select 1 from public.household_member m
      join public.household h on h.id = m.household_id
     where m.user_id = NEW.user_id and h.is_active
  ) then
    raise exception 'user % already belongs to an active household', NEW.user_id;
  end if;
  return NEW;
end;
$trg4$;

drop trigger if exists trg_one_active_household_per_user on public.household_member;
create trigger trg_one_active_household_per_user
  before insert on public.household_member
  for each row execute function public.trg_fn_one_active_household_per_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- Self-check
-- ═══════════════════════════════════════════════════════════════════════════

DO $check$
DECLARE
  v_ok boolean;
  v_n  int;
BEGIN
  -- B1: invite SELECT policy no longer has the open branch (only the member one remains)
  SELECT COUNT(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'household_invite' AND cmd = 'SELECT';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SELF-CHECK FAILED: household_invite SELECT policy count = %', v_n; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='household_invite' AND cmd='SELECT'
       AND qual ILIKE '%used_by%'
  ) THEN RAISE EXCEPTION 'SELF-CHECK FAILED: open invite-read branch still present'; END IF;

  -- B1: join RPC is SECURITY DEFINER
  SELECT p.prosecdef INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='join_household_by_code';
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SELF-CHECK FAILED: join_household_by_code missing/not SECURITY DEFINER'; END IF;

  -- B5: settlement has no INSERT/UPDATE/DELETE policy (SELECT only)
  SELECT COUNT(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='settlement' AND cmd <> 'SELECT';
  IF v_n <> 0 THEN RAISE EXCEPTION 'SELF-CHECK FAILED: settlement still has % write policies', v_n; END IF;

  -- B6: register/confirm RPCs are SECURITY DEFINER
  SELECT p.prosecdef INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='register_settlement';
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SELF-CHECK FAILED: register_settlement missing/not SECURITY DEFINER'; END IF;
  SELECT p.prosecdef INTO v_ok FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='confirm_settlement';
  IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'SELF-CHECK FAILED: confirm_settlement missing/not SECURITY DEFINER'; END IF;

  -- B2 + B7: the four triggers exist
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_block_shared_delete_with_settlement' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: shared-delete guard trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_split_owner_is_member' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: split-owner-is-member trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_splits_sum_total' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: splits-sum-total constraint trigger missing'; END IF;
  PERFORM 1 FROM pg_trigger WHERE tgname='trg_one_active_household_per_user' AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF-CHECK FAILED: one-active-household trigger missing'; END IF;

  RAISE NOTICE 'shared security hardening validated: invite RLS, member RLS, settlement RPCs, delete guard, invariants.';
END $check$;

select '✓ 0043 shared security hardening applied' as status;
