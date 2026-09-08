-- 0062_seed_institutions_catalog.sql
--
-- Extends the curated institutions catalog (seeded in 0003, last touched in
-- 0034) with the entities users were re-creating by hand as custom
-- institutions — brokers, an exchange and two multi-currency wallets:
--
--   IOL (InvertirOnline)  broker (ALyC)
--   Cocos Capital         broker (ALyC)
--   AstroPay              wallet
--   Binance               crypto exchange
--   ARQ (ex DolarApp)     wallet
--
-- The balance sitting in a comitente or exchange account is real money the user
-- wants next to their bank accounts, and a custom institution only ever exists
-- for the one user who created it.
--
-- Field choices:
--   * `name` carries both the short brand and the long or former one where they
--     differ ("IOL (InvertirOnline)", "ARQ (ex DolarApp)") because the pickers
--     filter by substring — either spelling has to match.
--   * `icon_type = 'wallet'` for all five: the avatar resolver reserves
--     `landmark` (a bank building) for 'bank' and renders `wallet` for
--     everything else. None of these holds a banking licence.
--   * `brand_color` is display-only (avatar background, white monogram on top),
--     so a correction is a one-line UPDATE, not a data migration. Binance's
--     #F0B90B is its documented brand yellow; the other four are approximations
--     picked to stay distinguishable from each other and from the existing
--     catalog.
--
-- Catalog rows have user_id IS NULL: immutable for users, visible to every
-- authenticated user via the SELECT policy in 0020, and untouched by the
-- custom-row trigger in that same migration.
--
-- Idempotent: ON CONFLICT on the partial unique index for catalog slugs
-- (institutions_slug_catalog_unique, slug WHERE user_id IS NULL).

insert into public.institutions (name, slug, brand_color, icon_type) values
  ('IOL (InvertirOnline)', 'iol',      '#00B140', 'wallet'),
  ('Cocos Capital',        'cocos',    '#00C08B', 'wallet'),
  ('AstroPay',             'astropay', '#1B4DFF', 'wallet'),
  ('Binance',              'binance',  '#F0B90B', 'wallet'),
  ('ARQ (ex DolarApp)',    'arq',      '#152C5B', 'wallet')
on conflict (slug) where user_id is null do nothing;
