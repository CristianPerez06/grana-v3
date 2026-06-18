-- Add two system subcategories (user_id IS NULL) under existing expense
-- categories:
--   • "Cuota Préstamo" under "Financiero"
--   • "Seguro Hogar"   under "Hogar"
-- Visible to every existing and future user via the system-or-own read model,
-- no per-user backfill. Display labels are resolved in i18n
-- (subcategories.cuota-prestamo / subcategories.seguro-hogar).

insert into subcategories (category_id, name, canonical_name)
select c.id, v.name, v.canonical_name
from (values
  ('financiero', 'Cuota Préstamo', 'cuota-prestamo'),
  ('hogar',      'Seguro Hogar',   'seguro-hogar')
) as v(cat_canonical, name, canonical_name)
join categories c on c.canonical_name = v.cat_canonical and c.user_id is null
on conflict do nothing;
