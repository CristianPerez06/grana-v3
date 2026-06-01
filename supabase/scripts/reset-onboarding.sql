-- Reset onboarding state for a specific user so the wizard runs again.
-- One-off dev helper — paste into the Supabase SQL Editor against the remote project.
--
-- What it does, by default:
--   1. Sets profiles.onboarding_completed_at = NULL (re-arms the gate).
--   2. Resets initial_balance to 0 on the user's Billetera (ARS + USD).
--
-- (The old profiles.mode flag was removed in 0019_drop_profiles_mode; Grana is
--  now a single app for everyone, so there is no mode to re-arm.)
--
-- What it does NOT do by default:
--   - Delete bank accounts created by a previous onboarding run.
--     If you onboarded with "Vista detallada + sí a banco" before, those accounts
--     remain in the DB. A fresh run will create a SECOND bank account next to them.
--     Uncomment block §3 to wipe them — only safe if there are no transactions
--     linked to those bank accounts yet.

DO $$
DECLARE
  v_email text := 'cristian.perez@aerolab.co';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users', v_email;
  END IF;

  -- 1. Re-arm the wizard.
  UPDATE public.profiles
     SET onboarding_completed_at = NULL
   WHERE id = v_user_id;

  -- 2. Reset Billetera initial_balance to 0 (both currencies).
  UPDATE public.account_currencies ac
     SET initial_balance = 0
    FROM public.accounts a
   WHERE ac.account_id = a.id
     AND a.user_id = v_user_id
     AND a.type = 'cash'
     AND a.name = 'Billetera';

  -- 3. OPTIONAL: wipe bank accounts created by previous onboarding runs.
  --    Uncomment only if you are sure there are no transactions linked.
  --    The FK from account_currencies to accounts cascades, but transactions FK does not.
  -- DELETE FROM public.accounts
  --  WHERE user_id = v_user_id
  --    AND type = 'bank';

  RAISE NOTICE 'Onboarding reset for user % (%).', v_email, v_user_id;
END $$;

-- Verification queries — run separately after the DO block.
-- SELECT id, onboarding_completed_at FROM public.profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'cristian.perez@aerolab.co');
-- SELECT a.name, a.type, ac.currency_code, ac.initial_balance
--   FROM public.accounts a
--   JOIN public.account_currencies ac ON ac.account_id = a.id
--  WHERE a.user_id = (SELECT id FROM auth.users WHERE email = 'cristian.perez@aerolab.co')
--  ORDER BY a.type, ac.currency_code;
