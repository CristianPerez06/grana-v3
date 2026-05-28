## Why

Los modos `novato`/`experto` (`profiles.mode`) prometían simplificarle la vida al usuario casual, pero en la práctica **no esconden ningún diferencial de Grana**. Los tres diferenciales —cuotas de tarjeta, bimoneda, contexto de inflación— están disponibles para todos los usuarios sin importar el modo. La revisión de producto (2026-05-27) concluyó que el flag agrega complejidad sin pagar su costo:

- La **única** diferencia real es que el novato no crea cuentas adicionales. Eso se resuelve con una explicación de primer uso ("podés centralizar todo en una cuenta, o crear cuentas para ver dónde está tu plata"), no con un modo persistido.
- El alta de tarjeta novato a **1 fecha** calcula mal los estimados: el ciclo deja de coincidir con el resumen real del banco y no soporta múltiples tarjetas con ciclos distintos. La corrección contable (pilar #1) exige las 4 fechas siempre.
- Pedirle al usuario que se **autoclasifique** en el onboarding es fricción y un anti-patrón (la gente no sabe si es "novato" o "experto"). Además la etiqueta `novato` choca con el pilar "pedagogía sin condescendencia".

Conclusión: **una sola app para todos**, sin flag de modo. La profundidad la elige el usuario con sus actos (crear o no más cuentas), no marcando una casilla.

## What Changes

- **DB:** se elimina la columna `profiles.mode` (nueva migración `ALTER TABLE ... DROP COLUMN` + regeneración de `packages/supabase/src/types.ts`). Las otras dos columnas de la migración `0012` (`financial_timezone`, `onboarding_completed_at`) se mantienen.
- **Onboarding:** la pantalla de perfil deja de preguntar modo y banco. El saldo inicial usa un **único** flujo ("¿Cuánta plata tenés hoy?", ARS + USD) sobre la `Billetera` para todos. El destino del paso `/onboarding/profile` se define en `design.md` (D2).
- **Cuentas:** cualquiera puede crear cuentas. Se quita el gating `isNovato`: el botón "Crear cuenta" siempre visible y `/accounts/new` sin redirect.
- **Tarjetas:** queda **solo** el alta completa de 4 fechas. Se borra `createNovatoCreditCard`, `CreateNovatoCreditCardForm` y `createNovatoCreditCardSchema`.
- **Transacciones:** el filtro por cuenta se muestra cuando el usuario tiene ≥2 cuentas (derivado de la data, no del modo).
- **Hint de primer uso:** nueva explicación in-app sobre centralizar vs. detallar (ubicación en `design.md` D3).
- **Docs/specs:** se actualizan `profiles`, `onboarding`, `accounts`, `cards`, `dashboard` y `CLAUDE.md` (reescribir la sección "User modes", arreglar el drift `users.mode` → `profiles.mode`).

## Capabilities

### Modified Capabilities

- `profiles`: elimina la columna `mode` de la tabla y la saca de la policy/escenarios de RLS.
- `onboarding`: la pantalla de perfil ya no captura modo ni banco; el saldo inicial es un flujo único para todos.
- `cards`: el alta de tarjeta es un único flujo de 4 fechas (se elimina la variante novato de 1 fecha).
- `dashboard`: deja de referenciar modos (ya era idéntico; ahora hay una sola experiencia).

### Removed Requirements

- `accounts`: se elimina el requirement "En modo novato la creación de cuentas no está disponible en la UI" (se revierte el change `2026-05-26-hide-account-creation-novato`).
- `onboarding`: se elimina el requirement "La creación de cuenta bancaria en la pantalla de perfil es atómica" (ya no se crea banco en el onboarding).

## Impact

- **DB:** nueva migración en `supabase/migrations/`; regen `packages/supabase/src/types.ts`.
- **Validación:** `packages/validation/src/onboarding.ts` (quita `mode` + campos de banco), `packages/validation/src/credit-cards.ts` (borra `createNovatoCreditCardSchema`), `packages/validation/src/index.ts` (quita exports).
- **i18n:** `packages/i18n-messages/src/{es,en}.json` — quita `mode_simple_*`, `mode_detailed_*`, `description_experto`, `subtitle_novato`, `novato_close_date`, `novato_close_helper`; las claves que sobreviven con sufijo `_novato` se renombran a neutral.
- **Web:** `app/(onboarding-wizard)/onboarding/profile/**`, `onboarding/initial-balance/**`, `app/_actions/onboarding.ts`, `app/_actions/credit-cards.ts`, `app/(app)/accounts/page.tsx`, `accounts/new/page.tsx`, `accounts/_components/empty-accounts-state.tsx`, `app/(app)/cards/new/**`, `app/(app)/transactions/page.tsx`, `lib/transactions/components/movement-filters.tsx` (+ comentarios en `movement-row.tsx`, `movement-list.tsx`).
- **Mobile:** `app/(onboarding)/profile.tsx`, `app/(onboarding)/initial-balance.tsx` (paridad).
- **Tests:** `apps/web/lib/__tests__/onboarding-schemas.test.ts`.
- **Docs:** `CLAUDE.md`.
- Sin cambios en la lógica de balances ni en el gate de onboarding (`onboarding_completed_at`), que no dependen del modo.
