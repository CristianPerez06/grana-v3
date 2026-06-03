## 1. Migración del seed (DB)

- [ ] 1.1 Crear `supabase/migrations/0027_reseed_categories_argentina.sql` siguiendo el patrón de `0006`: comentario de cabecera explicando que es aditivo e idempotente.
- [ ] 1.2 Bloque de categorías: `INSERT INTO categories (name, canonical_name, color, icon, type)` con la categoría nueva `Cuidado personal` (`cuidado-personal`, `type = expense`, ícono/color a definir) + `ON CONFLICT DO NOTHING`.
- [ ] 1.3 Bloque de subcategorías: `INSERT INTO subcategories (category_id, name, canonical_name) SELECT ... FROM (values ...) JOIN categories c ON c.canonical_name = s.cat_canonical AND c.user_id IS NULL` con las **40 subcategorías nuevas** del Apéndice A de `design.md` + `ON CONFLICT DO NOTHING`. NO incluir las 31 existentes.
- [ ] 1.4 Verificar que ningún `canonical_name` nuevo colisiona con uno existente (categorías: único por sistema; subcategorías: único por `(category_id, canonical_name)`).
- [ ] 1.5 NO editar `0006_seed_categories.sql`. NO incluir UPDATE/DELETE/rename de `canonical_name`.

## 2. i18n (display)

- [ ] 2.1 `packages/i18n-messages/src/es.json` — sección `categories`: agregar `cuidado-personal`. Sección `subcategories`: agregar las 40 claves nuevas (keyed por `canonical_name`) con su label en español.
- [ ] 2.2 `packages/i18n-messages/src/en.json` — las mismas claves (1 categoría + 40 subcategorías) con label en inglés.
- [ ] 2.3 Renombres de display (solo value, sin tocar `canonical_name`):
  - `subcategories.transporte-publico`: es → "SUBE/Transporte público", en → "SUBE/Public transport".
  - `subcategories.intereses-cuenta-remunerada`: es → "Intereses", en → "Interest".
- [ ] 2.4 Confirmar que cada `canonical_name` nuevo tiene clave en **ambos** locales (evita `MISSING_MESSAGE` en runtime para categorías de sistema).

## 3. Guardrails de validación y docs

- [ ] 3.1 `supabase/validate_schema.sql` (sección 8.1D): actualizar los asserts de conteo — categorías `<> 18`, expense `<> 13`, income sigue en `5`, subcategorías `<> 71`; actualizar el `raise notice` final.
- [ ] 3.2 `supabase/validate_schema.sql` (sección 8.1E): sumar los `canonical_name` nuevos al array de categorías (cuidado-personal) y al array de subcategorías esperadas (las 40 nuevas); actualizar el `raise notice`.
- [ ] 3.3 `AGENTS.md` (línea ~248): "17 categorías sistema" → "18 categorías sistema".

## 4. Spec delta

- [ ] 4.1 Confirmar que `openspec/changes/reseed-categories-argentina/specs/categories/spec.md` refleja el requirement modificado (18/13/5 + 71). (Al archivar el change se aplica sobre `openspec/specs/categories/spec.md`, incluyendo el Purpose.)

## 5. Verificación

- [ ] 5.1 Aplicar `0027` en el dashboard de Supabase (entorno de desarrollo y prod) — pegar el SQL en el SQL Editor.
- [ ] 5.2 Correr `supabase/validate_schema.sql`: debe reportar 18/13/71 y los canonical_names OK, sin `raise exception`.
- [ ] 5.3 `pnpm typecheck`, `pnpm lint`, `pnpm --filter web test` (los tests de breakdown usan mocks, no deberían verse afectados).
- [ ] 5.4 Manual (web): abrir el selector de categorías en alta de movimiento y verificar que aparecen las categorías/subcategorías nuevas con su nombre traducido; cambiar idioma a `en` y confirmar que las de sistema se traducen (sin `MISSING_MESSAGE`).
- [ ] 5.5 Confirmar que las categorías/subcategorías existentes y las transacciones que las referencian siguen intactas (cambio aditivo).
