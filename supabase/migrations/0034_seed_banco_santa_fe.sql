-- 0034_seed_banco_santa_fe.sql
--
-- Adds "Banco Santa Fe" (Nuevo Banco de Santa Fe) to the curated institutions
-- catalog. Catalog rows have user_id IS NULL, so the row is immutable and
-- visible to every authenticated user via the SELECT policy in 0020
-- ("users read catalog and their own custom institutions"). No per-slug logo
-- map exists in the front-end; the avatar renders from brand_color + icon_type.
--
-- Idempotent: ON CONFLICT on the partial unique index for catalog slugs
-- (institutions_slug_catalog_unique, slug WHERE user_id IS NULL).

insert into public.institutions (name, slug, brand_color, icon_type) values
  ('Banco Santa Fe', 'santa-fe', '#009639', 'bank')
on conflict (slug) where user_id is null do nothing;
