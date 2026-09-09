-- ═══════════════════════════════════════════════════════════════════════════
-- 0066 · The minimum native client the backlog can be activated with
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Requirement for the activation, not a nicety.
--
-- The activation migration drops `recurrence_instances_one_pending_per_rule`,
-- and from that moment the backlog exists. A user who stays on an OLD native
-- build never runs the new generator: their backlog is never materialized, so
-- #96 stays alive for them — now without the index that used to contain it. The
-- compatibility trigger protects the INTEGRITY of what that client writes; it
-- cannot make it run logic it does not have.
--
-- So the app has to be able to say "this build is too old to keep using", and
-- the answer has to live on the server: a version pinned into a shipped build
-- cannot be raised for the builds already installed, which are precisely the
-- ones this is about.
--
-- One row per platform, because the two stores approve on their own schedule
-- and blocking Android for a build iOS has not shipped yet would lock users out
-- of an app that has no newer version to offer them.
--
-- `store_url` travels with the requirement for the same reason: the App Store id
-- does not exist until the app is published, and a build that hard-codes the
-- wrong link sends a blocked user nowhere. NULL means "we have no link to give
-- you", and the screen then explains without offering a button.
--
-- The row is read by SIGNED-IN users only — see the policy below for why it is
-- not public.
--
-- SEEDED INERT (`0.0.0`) ON PURPOSE. Applying this migration must block nobody:
-- the requirement is raised by an operator, deliberately, once the new build is
-- live in both stores — which is the step that has to come BEFORE the
-- activation. Shipping the mechanism and arming it are two decisions, and only
-- the first one belongs in a migration.

create table public.app_release_requirements (
  platform     TEXT        PRIMARY KEY,
  min_version  TEXT        NOT NULL,
  store_url    TEXT        NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  constraint chk_app_release_requirements_platform
    check (platform in ('ios', 'android')),
  -- Exactly three numeric parts. The client compares part by part, and a value
  -- it cannot parse makes it fail OPEN — so a typo here would silently disarm
  -- the gate instead of announcing itself.
  constraint chk_app_release_requirements_min_version
    check (min_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

insert into public.app_release_requirements (platform, min_version)
values ('ios', '0.0.0'), ('android', '0.0.0');

alter table public.app_release_requirements enable row level security;

-- READABLE BY ANY SIGNED-IN USER, AND BY NOBODY ELSE.
--
-- The number itself is not secret — both app stores publish it — so the obvious
-- move would be to let `anon` read it and block an out-of-date build on the
-- login screen too. That is NOT done here: `harden-supabase-anon-boundary` made
-- "anon holds no privilege on any table in public" an invariant of this schema,
-- checked by `validate_schema.sql` (8.2C.3), precisely so that RLS is not a
-- single point of failure. One convenient exception is how that stops being an
-- invariant.
--
-- The cost is small and lands in the right place: a signed-out build shows the
-- login screen as before, and the gate closes as soon as there is a session —
-- which is also the only state in which an old client can do the damage this
-- prevents, because materializing a backlog takes a signed-in user.
create policy "signed-in users read the app release requirement"
  on public.app_release_requirements
  for select
  to authenticated
  using (true);

grant select on public.app_release_requirements to authenticated;

-- No insert / update / delete grant on purpose: raising the floor locks users
-- out of the app, and that is an operator action taken with the service role,
-- never something a client can do.
