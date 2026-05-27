-- 0016_accounts_visual_identity.sql
--
-- Adds visual identity to accounts: each account gets an avatar = color + icon.
--
-- Two nullable text columns drive the avatar. The unifying rule is:
--   * a non-NULL value is an explicit user choice (a fixed override);
--   * NULL means "derive automatically".
--
-- Automatic derivation (resolved in app code, not in the DB):
--   * bank → inherits its institution's brand_color + icon_type (live: if the
--            account's institution changes, the derived avatar follows it);
--   * cash → 'wallet' icon + a deterministic palette color from hash(id).
--
-- Because NULL = auto, existing rows and the signup-provisioned "Efectivo"
-- account need no backfill and the signup trigger is left untouched: they stay
-- NULL and the resolver paints them correctly.
--
-- color_key references the curated account palette (tokens --account-* in
-- @grana/ui-tokens); icon_key references the curated lucide icon set. Both are
-- validated against the registry in @grana/validation before insert/update.
-- They are intentionally free-form text at the DB layer (no CHECK): the curated
-- key sets evolve in code, and a stale CHECK constraint would fight that.

alter table public.accounts
  add column color_key text,
  add column icon_key  text;

comment on column public.accounts.color_key is
  'Account avatar color. NULL = auto (bank: inherit institution; cash: deterministic from id). Non-NULL = explicit palette key from @grana/ui-tokens --account-*.';
comment on column public.accounts.icon_key is
  'Account avatar icon. NULL = auto (bank: from institution.icon_type; cash: wallet). Non-NULL = explicit key from the curated lucide set.';
