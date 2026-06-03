## Why

El seed por defecto de categorías del sistema (17 categorías + 31 subcategorías, `supabase/migrations/0006_seed_categories.sql`) tiene dos problemas para el público objetivo (Argentina):

1. **Categorías huérfanas**: 6 categorías no tienen ninguna subcategoría pre-cargada — `Educación`, `Tecnología`, `Otros gastos` y casi todos los ingresos (`Sueldo`, `Freelance`, `Inversiones`, `Otros ingresos`). El usuario que registra un movimiento ahí no tiene de dónde elegir y arranca con fricción.
2. **Faltan conceptos centrales del gasto argentino**: `Monotributo`, `Expensas`, `Prepaga` (distinta de Obra social), `SUBE`, `VTV`, `Patente`, `Aguinaldo`, `Compra dólar/MEP`. Son rubros que aparecen en la canasta del INDEC (COICOP-Argentina) y en cómo la gente categoriza su plata acá, pero hoy no están.

También falta una categoría que pesa fuerte en el gasto de los hogares de la región (~8-10% según ENIGH/DANE) y no existe en el seed: **Cuidado personal** (peluquería, gimnasio, cosmética, skin care).

La decisión de producto (explorada con el usuario) es **enfocar el catálogo en Argentina** —manteniendo marcas locales reconocibles (Netflix, Uber, PedidosYa, Rappi)— y dejar la neutralización pan-LatAm (e i18n por país) para más adelante.

## What Changes

Enriquecer el seed del sistema de **17 categorías / 31 subcategorías** a **18 categorías / 71 subcategorías**, de forma **100% aditiva**:

- **1 categoría nueva**: `Cuidado personal` (`type = expense`), con 4 subcategorías.
- **40 subcategorías nuevas** distribuidas en las categorías existentes (y la nueva), priorizando rubros argentinos: Monotributo, Tasas municipales, Expensas, Prepaga, SUBE/Transporte público, Peajes, Service/Mecánico, Seguro auto, VTV, Patente, Aguinaldo, Compra dólar/MEP, etc. El catálogo completo con `canonical_name` está en `design.md` (Apéndice A).
- **2 cambios de display (solo i18n, sin tocar `canonical_name`)**: `transporte-publico` pasa a mostrarse "SUBE/Transporte público"; `intereses-cuenta-remunerada` pasa a mostrarse "Intereses".

La entrega es una **migración nueva incremental** (`0027_reseed_categories_argentina.sql`) con `INSERT ... ON CONFLICT DO NOTHING`. **No se edita `0006`** (ya aplicada en prod) y **no se borra ni renombra ningún `canonical_name` existente** (se respeta la regla de inmutabilidad). Los renombres son únicamente de la etiqueta visible vía i18n.

Como el display de las categorías de sistema se resuelve por i18n (`canonical_name` → `categories.*` / `subcategories.*`), el change incluye agregar las claves nuevas en `es.json` **y** `en.json` (si falta una clave, next-intl lanza `MISSING_MESSAGE`).

## Capabilities

### Modified Capabilities

- `categories`: se actualiza el requirement **"Catálogo de categorías del sistema"** — los conteos pasan de "17 categorías (12 expense, 5 income) + 31 subcategorías" a "18 categorías (13 expense, 5 income) + 71 subcategorías". El resto de los requirements (inmutabilidad de `canonical_name`, RLS de sistema, traducción i18n, gestión de categorías propias) **no cambia**: este change solo agrega filas de sistema y sus traducciones.

## Impact

**Código / datos afectados:**

- `supabase/migrations/0027_reseed_categories_argentina.sql` — **NUEVO**. INSERT aditivo de 1 categoría + 40 subcategorías con `ON CONFLICT DO NOTHING`.
- `packages/i18n-messages/src/es.json` y `en.json` — claves nuevas en `categories.*` (1) y `subcategories.*` (40); + 2 cambios de value para los renombres de display.
- `supabase/validate_schema.sql` — actualizar los asserts de conteo (`raise exception`): 17→18 categorías, 12→13 expense, 31→71 subcategorías; sumar los `canonical_name` nuevos a los arrays de las secciones 8.1D/8.1E. Income sigue en 5.
- `openspec/specs/categories/spec.md` — vía el delta de este change (Purpose + requirement "Catálogo de categorías del sistema").
- `AGENTS.md` (línea ~248) — la mención "17 categorías sistema" pasa a 18.

**No afectado (intencional / verificado):**

- `0006_seed_categories.sql` — intacta (ya aplicada en prod; el nuevo seed es idempotente y aditivo).
- `canonical_name` de cualquier categoría/subcategoría existente — sin cambios (inmutabilidad).
- Transacciones, recurrencias e instancias históricas — intactas (cero deletes → cero conflicto con los FK `ON DELETE RESTRICT` de `0026`).
- RLS — el seed corre en el dashboard (rol `postgres`), bypassa RLS igual que `0006`.
- `apps/mobile` y `apps/web` — no requieren cambios de código: leen las categorías de DB y resuelven el nombre por i18n; las nuevas filas aparecen solas.
- `supabase/scripts/reset-onboarding.sql` — no toca categorías.
