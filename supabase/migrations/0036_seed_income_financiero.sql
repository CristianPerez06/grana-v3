-- Income "Financiero" category + "Intereses ganados" subcategory (system rows).
-- The read model is "system (user_id IS NULL) or own", so a system row is
-- visible to every existing and future user without per-user backfill.
--
-- categories_system_canonical_name_unique is global across types for system
-- rows, and the expense category already owns 'financiero', so the income
-- category uses canonical_name 'financiero-ingresos' while keeping the same
-- display name, icon and color for visual consistency.

insert into categories (name, canonical_name, color, icon, type) values
  ('Financiero', 'financiero-ingresos', '#6366F1', '🏦', 'income')
on conflict do nothing;

insert into subcategories (category_id, name, canonical_name)
select c.id, 'Intereses ganados', 'intereses-ganados'
from categories c
where c.canonical_name = 'financiero-ingresos' and c.user_id is null
on conflict do nothing;
