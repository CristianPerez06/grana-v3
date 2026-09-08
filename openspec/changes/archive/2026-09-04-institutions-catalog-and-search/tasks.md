## 1. Catálogo

- [x] 1.1 Migración única `0062_seed_institutions_catalog.sql` con IOL, Cocos Capital, AstroPay, Binance y ARQ (ex DolarApp), idempotente vía `ON CONFLICT (slug) WHERE user_id IS NULL`.
- [x] 1.2 Número de migración elegido contra `main` (máximo ahí: `0061`), no contra el working tree.
- [x] 1.3 Nombres que matcheen las dos formas conocidas de la entidad donde difieren (`IOL (InvertirOnline)`, `ARQ (ex DolarApp)`).
- [x] 1.4 Aplicada en el proyecto online y verificada: 5 filas.

## 2. Búsqueda

- [x] 2.1 `filterInstitutions` en `@grana/accounts`, plegando diacríticos en los dos lados, con el mismo idiom NFD que el `slugify` de las dos apps.
- [x] 2.2 Consumirlo desde las cuatro superficies (web: `bank-selector.tsx`, `card-form-ui.tsx`; mobile: `BankSelector.tsx`, `InstitutionPickerModal.tsx`).
- [x] 2.3 Tests del matcher: sin acento encuentra acentuado, acentuado sigue encontrando, case-insensitive, query vacía devuelve la misma referencia.

## 3. Verificación

- [x] 3.1 `pnpm test` (856 tests), lint y typecheck en web y mobile.
- [x] 3.2 Archivar la change, aplicar deltas a `schema-base` y `accounts`, correr `pnpm openspec:check`.
