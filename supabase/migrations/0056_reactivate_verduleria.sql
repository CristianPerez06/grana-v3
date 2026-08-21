-- 0056_reactivate_verduleria.sql
--
-- Repara la subcategoría de sistema "Verdulería" (comida / verduleria), que
-- estaba con is_active = false y por eso no aparecía al clasificar un gasto:
-- `getAllCategories` filtra `subcategories.is_active = true` (el catálogo no
-- reparte filas archivadas — ver apps/web/lib/categories/queries.ts).
--
-- Cómo llegó a ese estado: la fila se creó a mano el 2026-05-25, antes del seed
-- 0028 (2026-06-04). Como subcategories tiene `unique (category_id,
-- canonical_name)` (0005), el `insert ... on conflict do nothing` del 0028 no
-- pudo sembrar su propia fila y quedó la vieja — archivada y con el name sin
-- tilde. Un seed aditivo idempotente NO repara filas preexistentes: las saltea
-- en silencio.
--
-- Por qué va en SQL y no desde la app: archiveSubcategory / updateSubcategory
-- filtran `user_id = auth.uid()` y la política RLS de update exige lo mismo, así
-- que una fila de sistema (user_id IS NULL) solo se toca con el rol postgres.
--
-- El `name` se alinea con el del 0028; es cosmético, porque la etiqueta visible
-- sale de i18n por canonical_name (`subcategories.verduleria`) para las filas de
-- sistema, nunca de esta columna (apps/web/lib/categories/display.ts).
--
-- Idempotente: no-op si la fila ya está activa y con el nombre correcto.

update subcategories s
set is_active = true,
    name = 'Verdulería'
from categories c
where c.id = s.category_id
  and c.canonical_name = 'comida'
  and c.user_id is null
  and s.canonical_name = 'verduleria'
  and s.user_id is null;
