-- 0054_seed_juntadas_and_viajes.sql
--
-- Enriquecimiento ADITIVO del catálogo de categorías del sistema:
--   • 1 subcategoría nueva bajo "Entretenimiento": "Juntadas".
--   • 1 categoría nueva de gasto: "Viajes / Escapadas", con 4 subcategorías
--     (Transporte, Hospedaje, Comida, Excursiones).
--
-- Visible a todo usuario existente y futuro vía el read model "sistema
-- (user_id IS NULL) o propio", sin backfill por usuario. Las etiquetas visibles
-- se resuelven en i18n (categories.viajes-escapadas / subcategories.*), nunca
-- desde el `name` de la fila (ver apps/web/lib/categories/display.ts).
--
-- Las subcategorías de "Viajes / Escapadas" usan canonical_name con prefijo
-- `viaje-` para no colisionar con otras subcategorías del catálogo global.
--
-- Idempotente: ON CONFLICT DO NOTHING. No edita ni borra filas existentes ni
-- modifica ningún canonical_name previo (regla de enriquecimiento aditivo).
-- Corre en el dashboard (rol postgres), bypassa RLS igual que los seeds previos.

-- subcategoría nueva bajo "Entretenimiento"
insert into subcategories (category_id, name, canonical_name)
select c.id, 'Juntadas', 'juntadas'
from categories c
where c.canonical_name = 'entretenimiento' and c.user_id is null
on conflict do nothing;

-- categoría nueva del sistema (user_id IS NULL)
insert into categories (name, canonical_name, color, icon, type) values
  ('Viajes / Escapadas', 'viajes-escapadas', '#0EA5E9', '✈️', 'expense')
on conflict do nothing;

-- subcategorías de "Viajes / Escapadas"
insert into subcategories (category_id, name, canonical_name)
select c.id, s.name, s.canonical_name
from (values
  ('viajes-escapadas', 'Transporte',  'viaje-transporte'),
  ('viajes-escapadas', 'Hospedaje',   'viaje-hospedaje'),
  ('viajes-escapadas', 'Comida',      'viaje-comida'),
  ('viajes-escapadas', 'Excursiones', 'viaje-excursiones')
) as s(cat_canonical, name, canonical_name)
join categories c on c.canonical_name = s.cat_canonical and c.user_id is null
on conflict do nothing;
