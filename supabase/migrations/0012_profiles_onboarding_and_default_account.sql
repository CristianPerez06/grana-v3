-- Onboarding migration (change: add-onboarding-post-signup).
-- Three concerns:
--   1. Extend profiles with mode, financial_timezone, onboarding_completed_at.
--   2. Rename the default account created by the signup trigger: 'Efectivo' -> 'Billetera'.
--   3. Backfill existing 'Efectivo' rows + mark the owner's onboarding as already completed.
--
-- Order matters: the ALTER must run before the owner UPDATE (which writes to the
-- new column), and the function replace must run before the rename UPDATE
-- (so new signups during the apply window already get 'Billetera').

-- ─── 1. Extend profiles ─────────────────────────────────────────────────────

alter table public.profiles
  add column mode text not null default 'novato'
    check (mode in ('novato', 'experto')),
  add column financial_timezone text not null
    default 'America/Argentina/Buenos_Aires',
  add column onboarding_completed_at timestamptz null;

comment on column public.profiles.mode is
  'UX flag: novato hides account-level detail; experto shows it. Not enforced server-side.';
comment on column public.profiles.financial_timezone is
  'IANA timezone used to compute accounting "today" (e.g. getTodayAR). Default Buenos Aires.';
comment on column public.profiles.onboarding_completed_at is
  'Set by /onboarding/done. NULL means the user has not finished the wizard yet — the middleware redirects to /onboarding/welcome.';

-- ─── 2. Replace the default-account function so new users get 'Billetera' ───

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
  values (new.id, 'Billetera', 'cash', null)
  returning id into v_account_id;

  insert into public.account_currencies (account_id, currency_code, initial_balance, initial_balance_date)
  values
    (v_account_id, 'ARS', 0, current_date),
    (v_account_id, 'USD', 0, current_date);

  return new;
end;
$$;

-- The trigger itself does not need to be recreated — CREATE OR REPLACE
-- rebinds the existing trigger to the new function body automatically.

-- ─── 3. Backfill: rename existing default cash accounts ─────────────────────
--
-- Known risk: if any user manually created a separate cash account named
-- 'Efectivo' it will also be renamed. With a single active user (the owner)
-- and no such account in the current dataset, this is safe. If you re-run
-- this migration against an environment with multiple users, audit first.

update public.accounts
   set name = 'Billetera'
 where name = 'Efectivo'
   and type = 'cash';

-- ─── 4. Mark the owner's onboarding as already completed ────────────────────
--
-- The single existing user should NOT see the wizard. Anyone else who exists
-- will see it on next login (intended behaviour for new users created via
-- signup before this migration ran). Replace the email below if needed.

update public.profiles
   set onboarding_completed_at = now()
 where email = 'cristian.ap84@gmail.com';

-- ─── Self-check: fail loudly if anything is off ─────────────────────────────

do $$
declare
  v_mode_col_exists           boolean;
  v_tz_col_exists             boolean;
  v_onboarding_col_exists     boolean;
  v_efectivo_count            int;
  v_billetera_count           int;
  v_owner_onboarding_set      boolean;
begin
  -- New columns are present
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'mode'
  ) into v_mode_col_exists;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'financial_timezone'
  ) into v_tz_col_exists;

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed_at'
  ) into v_onboarding_col_exists;

  if not v_mode_col_exists or not v_tz_col_exists or not v_onboarding_col_exists then
    raise exception 'profiles is missing one of the new columns (mode / financial_timezone / onboarding_completed_at)';
  end if;

  -- No 'Efectivo' cash accounts remain
  select count(*) into v_efectivo_count
    from public.accounts
   where name = 'Efectivo' and type = 'cash';

  if v_efectivo_count > 0 then
    raise exception '% account(s) named Efectivo still exist after the rename', v_efectivo_count;
  end if;

  -- At least one 'Billetera' cash account exists (sanity that we have data)
  select count(*) into v_billetera_count
    from public.accounts
   where name = 'Billetera' and type = 'cash';

  raise notice 'Billetera cash accounts after rename: %', v_billetera_count;

  -- Owner onboarding marked complete
  select exists (
    select 1 from public.profiles
     where email = 'cristian.ap84@gmail.com'
       and onboarding_completed_at is not null
  ) into v_owner_onboarding_set;

  if not v_owner_onboarding_set then
    raise notice 'Owner profile not found or onboarding_completed_at still NULL — verify the email matches the active user before running the wizard on yourself.';
  end if;

  raise notice 'Migration 0012 validated: profiles extended, default account renamed, owner onboarding seeded.';
end $$;

-- ─── Final report ───────────────────────────────────────────────────────────

select
  (
    select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in ('mode', 'financial_timezone', 'onboarding_completed_at')
  ) as new_profile_columns,
  (
    select count(*) from public.accounts where name = 'Efectivo' and type = 'cash'
  ) as leftover_efectivo_accounts,
  (
    select count(*) from public.accounts where name = 'Billetera' and type = 'cash'
  ) as billetera_accounts,
  (
    select onboarding_completed_at from public.profiles where email = 'cristian.ap84@gmail.com'
  ) as owner_onboarding_completed_at;
