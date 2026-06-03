## Why

La capability `categories` ya define como requirement que **los nombres de categorías y subcategorías del sistema se muestren en el idioma activo**, usando `canonical_name` como clave i18n (spec `categories`, requirement "Nombres de categorías del sistema son traducibles", con scenarios para `en`). Las claves ya existen en `packages/i18n-messages` (`categories.*`, `subcategories.*`) y el helper `apps/web/lib/categories/display.ts` (`getCategoryName` / `getSubcategoryName`) ya resuelve la traducción para categorías de sistema (`user_id === null`) con fallback al `name` para las propias.

El problema es de **conformidad**: el helper solo se usa en 2 pantallas (`settings/categories` y sus subcategorías). El resto de los puntos de display —detalle de movimiento, lista de movimientos, filtros, "En qué se fue", spending-by-category, formulario de movimiento— renderiza el `name` crudo guardado en DB (español), así que al cambiar el idioma a inglés esas categorías no se traducen.

Causa raíz en la capa de datos: `apps/web/lib/transactions/movements.ts` (`toFinancialMovement`) hornea `category_name = tx.category.name` y `subcategory_name = tx.subcategory.name` sin arrastrar `canonical_name` ni `user_id`, así que aguas abajo no hay con qué resolver la traducción. Lo mismo en los breakdowns del dashboard (`@grana/dashboard` → `getMonthCategoryBreakdown` y derivados), que devuelven `label` directamente del `name`.

Detectado en QA (caso SET-N2-01).

## What Changes

- El contrato de datos de movimientos (`FinancialMovement` y el payload de query) arrastra, para categoría y subcategoría, lo necesario para traducir: `canonical_name` + un flag de sistema (`user_id === null`, expuesto como `category_is_system` / `subcategory_is_system`). Se deja de hornear el label final en la capa de datos.
- Cada punto de display de categoría/subcategoría resuelve el label con `getCategoryName` / `getSubcategoryName` (helper existente) usando `useTranslations` (client) o `getTranslations` (server):
  - Detalle de movimiento (`transactions/[txId]`).
  - Lista de movimientos (`movement-row` / `movement-list`).
  - Filtros de movimientos (`movement-filters`: opciones de categoría/subcategoría).
  - Formulario de movimiento (`movement-form`: selector de categoría/subcategoría).
- Los breakdowns del dashboard (`@grana/dashboard`) devuelven, además del `label` crudo, `canonical_name` + flag de sistema por slice, y los consumidores (`category-teaser`, `category-spending-overview`) resuelven el label traducido:
  - "En qué se fue" (teaser del dashboard).
  - Spending-by-category (vista completa en `/transactions`).
- Auditar y cubrir cualquier otro punto que muestre nombre de categoría: recurrencias (detalle / upcoming) y consumos de tarjeta, si aplica.

No cambia: el seed de categorías, el `canonical_name`, las reglas RLS, ni los nombres de categorías **propias** del usuario (que siguen mostrando su `name` literal, sin traducir — comportamiento correcto).

## Capabilities

### Modified Capabilities

- `categories`: sin cambios de requirement (el requirement "Nombres de categorías del sistema son traducibles" ya existe y es el que este change lleva a cumplir en todos los displays). A lo sumo, una aclaración de que la regla aplica a **todos** los puntos de presentación, no solo a la gestión de categorías en Settings.

## Impact

**Código afectado:**

- `apps/web/lib/transactions/movements.ts` — `FinancialMovement` + `toFinancialMovement`: arrastrar `category_canonical_name`, `category_is_system`, `subcategory_canonical_name`, `subcategory_is_system`; dejar de fijar el label traducido acá.
- `apps/web/lib/transactions/queries.ts` (y los wrappers client de `_actions/queries.ts`) — incluir `canonical_name` y `user_id` de categoría/subcategoría en los `select`.
- `apps/web/lib/transactions/types.ts` — tipos del payload de categoría/subcategoría.
- Display de movimientos: `lib/transactions/components/movement-row.tsx`, `movement-list.tsx`, `movement-filters.tsx`, `transactions/[txId]/_components/*`, `transactions/new/_components/movement-form.tsx`.
- `packages/dashboard/src/queries.ts` + `types.ts` — `getMonthCategoryBreakdown` (y `getMonthSubcategoryBreakdown` / income breakdown si aplica) devuelven `canonical_name` + flag de sistema por slice; `CategorySliceInput`/`CategorySlice` (en `@grana/money-logic`) lo propagan.
- Display de spending: `dashboard/_components/category-teaser*.tsx`, `lib/transactions/components/category-spending-overview*.tsx`.
- Auditar: `lib/recurrences/*` y `lib/cards/*` si muestran nombre de categoría.

**No afectado (intencional):**

- Migraciones / seed / RLS de `categories`.
- Categorías propias del usuario (fallback a `name` literal).
- `apps/mobile` (paridad diferida; el mismo helper aplica cuando se implemente).
