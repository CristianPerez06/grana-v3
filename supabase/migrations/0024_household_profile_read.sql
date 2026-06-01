-- Shared module (Compartido) — follow-up: let household members read each
-- other's profile (full_name) so the UI can say "Juan te debe …".
--
-- profiles RLS so far is strictly `auth.uid() = id` (0001). The shared module
-- needs a member to read their co-member's name. This adds a SECOND permissive
-- SELECT policy (policies are OR'd) gated by a SECURITY DEFINER helper, so it
-- does not widen anything beyond people who share a household with the caller.
--
-- See openspec/changes/add-shared-expenses/.

create or replace function public.shares_household_with(p_other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.household_member self
      join public.household_member other
        on other.household_id = self.household_id
     where self.user_id = auth.uid()
       and other.user_id = p_other
  );
$$;

create policy "members read co-member profiles"
  on public.profiles for select
  using (shares_household_with(id));

-- ─── Self-check ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT p.prosecdef INTO v_ok
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'shares_household_with';
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: shares_household_with missing or not SECURITY DEFINER';
  END IF;

  SELECT COUNT(*) = 1 INTO v_ok FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'profiles'
     AND policyname = 'members read co-member profiles';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: co-member profile read policy missing';
  END IF;

  RAISE NOTICE 'household profile-read migration validated.';
END $$;

select '✓ 0024 household_profile_read applied' as status;
