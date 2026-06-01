# Diseño — Bloquear borrado de categorías/subcategorías en uso

## Decisión: DB + app (no uno u otro)

- **La DB es la autoridad.** `ON DELETE RESTRICT` en los 6 FK de `category_id`/`subcategory_id` garantiza la invariante para cualquier cliente, presente o futuro, incluido SQL manual. Es el patrón de invariantes-por-DB que ya usa el repo (triggers I-CRED-*, invariantes de reintegros, etc.).
- **Los guards de app dan UX.** Web y mobile consultan `transactions`, `recurrences` y `recurrence_instances` antes de borrar para devolver un mensaje accionable ("archivá en lugar de eliminar"). Sin esto, el usuario vería un error de FK crudo. El guard es conveniencia de mensaje; la correctitud la garantiza la DB.

## Descubrimiento robusto de constraints

La migración no asume los nombres de los FK: los descubre dinámicamente por `(tabla, columna, tabla_referenciada)` sobre `pg_constraint`, y recrea cada uno con `ON DELETE RESTRICT`. El self-check exige que existan **exactamente 6** FK RESTRICT (cubre tanto "alguno no es RESTRICT" como "alguno falta").

## Borde de categoría padre con subcategoría hija en uso

Al borrar una categoría **padre**, la FK `subcategories.category_id` es `ON DELETE CASCADE` (0005): borrar la categoría intentaría borrar sus subcategorías; si una subcategoría hija está referenciada (ahora RESTRICT), la DB aborta el cascade y el delete del padre falla.

Este borde **es alcanzable**: el schema NO obliga a que una fila con `subcategory_id` lleve también `category_id` (en `transactions`, `category_id` es nullable y no hay CHECK que los ligue), y los updates pueden mover `category_id` y `subcategory_id` de forma independiente. Una fila podría entonces referenciar una subcategoría hija sin referenciar a la categoría padre.

Por eso el guard de categoría (`isCategoryInUse`, web y mobile) NO se limita a `category_id`: además junta las subcategorías hijas de la categoría y verifica si alguna está referenciada por `subcategory_id` en las tres tablas. Así el borrado del padre con una subcategoría hija en uso devuelve el mensaje accionable ("archivá en lugar de eliminar") en lugar de un error de FK crudo. La DB sigue siendo la última barrera ante cualquier camino no cubierto.
