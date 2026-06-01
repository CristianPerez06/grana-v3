# Tareas — Bloquear borrado de categorías/subcategorías en uso

## 1 · DB como autoridad

- [x] 1.1. Migración `0026_restrict_category_subcategory_deletes.sql`: convertir a `ON DELETE RESTRICT` los FK `transactions.subcategory_id`, `recurrences.category_id`, `recurrences.subcategory_id`, `recurrence_instances.category_id`, `recurrence_instances.subcategory_id` (descubrimiento dinámico del nombre de constraint por tabla/columna/destino).
- [x] 1.2. Self-check en la migración: exigir exactamente 6 FK RESTRICT.
- [x] 1.3. `supabase/validate_schema.sql`: bloque 8.1G que valida los 6 FK RESTRICT en futuras auditorías.

## 2 · Guards de aplicación

- [x] 2.1. Web (`apps/web/app/_actions/categories.ts`): helper `isCategoryColumnInUse` sobre las 3 tablas (usado en `deleteSubcategory`) + `isCategoryInUse` que al borrar una categoría también verifica referencias a sus subcategorías hijas (usado en `deleteCategory`).
- [x] 2.2. Mobile (`apps/mobile/lib/categories.ts`): helpers gemelos en `deleteCategory`/`deleteSubcategory` (antes mobile borraba directo, sin guard).
- [x] 2.3. Strings i18n `delete_in_use_category` / `delete_in_use_subcategory` (es/en).

## 3 · Spec + verificación

- [x] 3.1. MODIFICAR el requisito de archivar/eliminar en `openspec/specs/categories/spec.md` (definición de "en uso" + enforcement DB).
- [x] 3.2. Web/mobile typecheck, web lint, web tests (326), mobile lint — verdes.
- [x] 3.3. Aplicar `0026` en el SQL Editor de Supabase (online-only) — aplicada 2026-06-01.
- [ ] 3.4. Smoke manual (web + mobile): borrar sin uso funciona; con movimiento/recurrencia/instancia bloquea con mensaje de archivar; archivar sigue funcionando — **manual, pendiente del usuario**.
