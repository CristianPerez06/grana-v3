## 1. Migración del seed (DB)

- [x] 1.1 Crear `supabase/migrations/0028_reseed_categories_argentina.sql` siguiendo el patrón de `0006`: comentario de cabecera explicando que es aditivo e idempotente.
- [x] 1.2 Bloque de categorías: `INSERT INTO categories (name, canonical_name, color, icon, type)` con la categoría nueva `Cuidado personal` (`cuidado-personal`, `type = expense`, `🧴` / `#D946EF`) + `ON CONFLICT DO NOTHING`.
- [x] 1.3 Bloque de subcategorías: `INSERT INTO subcategories (category_id, name, canonical_name) SELECT ... FROM (values ...) JOIN categories c ON c.canonical_name = s.cat_canonical AND c.user_id IS NULL` con las **40 subcategorías nuevas** del Apéndice A de `design.md` + `ON CONFLICT DO NOTHING`. NO incluye las 31 existentes.
- [x] 1.4 Verificado: ningún `canonical_name` nuevo colisiona con uno existente (categorías: único por sistema; subcategorías: único por `(category_id, canonical_name)` — `plazo-fijo` bajo `inversiones` es independiente de `constitucion-plazo-fijo` bajo `financiero`).
- [x] 1.5 NO se editó `0006_seed_categories.sql`. Sin UPDATE/DELETE/rename de `canonical_name`.

## 2. i18n (display)

- [x] 2.1 `packages/i18n-messages/src/es.json` — sección `categories`: agregado `cuidado-personal`. Sección `subcategories`: agregadas las 40 claves nuevas (keyed por `canonical_name`) con su label en español.
- [x] 2.2 `packages/i18n-messages/src/en.json` — las mismas claves (1 categoría + 40 subcategorías) con label en inglés.
- [x] 2.3 Renombres de display (solo value, sin tocar `canonical_name`):
  - `subcategories.transporte-publico`: es → "SUBE / Transporte público", en → "SUBE / Public Transport".
  - `subcategories.intereses-cuenta-remunerada`: es → "Intereses", en → "Interest".
- [x] 2.4 Confirmado: cada `canonical_name` nuevo tiene clave en **ambos** locales; ambos JSON parsean OK.

## 3. Guardrails de validación y docs

- [x] 3.1 `supabase/validate_schema.sql` (sección 8.1D): asserts de conteo actualizados — categorías `<> 18`, expense `<> 13`, income sigue en `5`, subcategorías `<> 71`; `raise notice` final actualizado.
- [x] 3.2 `supabase/validate_schema.sql` (sección 8.1E): `cuidado-personal` sumado al array de categorías y las 40 subcategorías nuevas al array de subcategorías (71 en total); `raise notice` actualizado.
- [x] 3.3 `AGENTS.md` (línea ~248): "17 categorías sistema" → "18 categorías sistema".

## 4. Spec delta

- [x] 4.1 Confirmado que `openspec/changes/reseed-categories-argentina/specs/categories/spec.md` refleja el requirement modificado (18/13/5 + 71). (Al archivar el change con `/opsx:archive` se aplica sobre `openspec/specs/categories/spec.md`, incluyendo el Purpose.)

## 5. Verificación

- [x] 5.1 Aplicada `0028` en el SQL Editor de Supabase. Pre-vuelo detectó 1 colisión (un usuario de prueba con "Verdulería" propia bajo Comida); se resolvió promoviendo esa fila a sistema (`user_id = NULL`) antes de la migración.
- [x] 5.2 `supabase/validate_schema.sql` corrido post-apply: 8.1A–8.1E OK; se corrigió el spot-check 8.1F (comida 5→8). Mini-check final verde: 18 categorías (13/5) · 71 subcategorías · comida=8.
- [x] 5.3 `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm --filter web test` ✓ (342), `pnpm --filter @grana/dashboard test` ✓ (21). Los tests de breakdown usan mocks; sin regresiones.
- [ ] 5.4 **(opcional — visual en app)** Abrir el selector de categorías en alta de movimiento y confirmar las nuevas traducidas; cambiar idioma a `en`. Pendiente de chequeo visual; cobertura indirecta vía paridad i18n verificada (sin claves faltantes).
- [x] 5.5 Datos existentes intactos: confirmado por construcción (cambio aditivo, sin deletes/renames) y por que 8.1E encontró todos los canonical_name previos. La Verdulería del usuario conserva su `id`, así que sus transacciones siguen vinculadas.
