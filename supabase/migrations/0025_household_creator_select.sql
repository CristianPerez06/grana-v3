-- Shared module (Compartido) — fix: the creator must be able to SELECT their
-- household.
--
-- createHousehold does `insert(...).select('id')`. With return=representation,
-- PostgREST reads the just-inserted row back, gated by the SELECT policy. That
-- policy was `is_household_member(id)`, but the membership row is created in the
-- NEXT statement — so at insert time the creator is not yet a member and the
-- read-back is denied, surfacing as "new row violates row-level security policy".
--
-- Widen the SELECT policy to also allow the creator. (Insert/update unchanged.)
--
-- See openspec/changes/add-shared-expenses/.

drop policy if exists "members select own household" on public.household;
create policy "members select own household"
  on public.household for select
  using (created_by = auth.uid() OR is_household_member(id));

-- ─── Self-check ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT COUNT(*) = 1 INTO v_ok FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'household'
     AND policyname = 'members select own household' AND cmd = 'SELECT';
  IF NOT v_ok THEN
    RAISE EXCEPTION 'SELF-CHECK FAILED: household select policy missing';
  END IF;
  RAISE NOTICE 'household creator-select migration validated.';
END $$;

select '✓ 0025 household_creator_select applied' as status;
