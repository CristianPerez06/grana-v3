## 1. Validación (`packages/validation`)

- [x] 1.1 En `src/onboarding.ts`: quitar `MODE_VALUES`, el `profileSchema` entero (con D2-a el paso de perfil desaparece) y los campos `cash_*` de `initialBalanceSchema`. Conservar solo el schema de saldo inicial (`primary_account_id`, `primary_ars`, `primary_usd`).
- [x] 1.2 En `src/credit-cards.ts`: borrar `createNovatoCreditCardSchema` y `CreateNovatoCreditCardInput`.
- [x] 1.3 En `src/index.ts`: quitar los exports `createNovatoCreditCardSchema`, `CreateNovatoCreditCardInput`, `profileSchema` y `ProfileInput`.

## 2. i18n (`packages/i18n-messages`)

- [x] 2.1 En `src/es.json` y `src/en.json`: borrar el bloque `onboarding.profile`, `initialBalance.description_experto`, `initialBalance.group_primary_bank`, `initialBalance.group_cash`, `cards.new.subtitle_novato`, `cards.labels.novato_close_date`, `cards.labels.novato_close_helper`.
- [x] 2.2 Renombrar a neutral: `initialBalance.description_novato` → `description`, `initialBalance.group_novato` → `group_total`; actualizar consumidores (web + mobile). Agregar `accounts.hint` (title/description/dismiss).

## 3. Onboarding — web

- [x] 3.1 Eliminar la ruta `app/(onboarding-wizard)/onboarding/profile/**`; `welcome` navega a `/onboarding/initial-balance`.
- [x] 3.2 En `app/_actions/onboarding.ts`: borrar `saveProfileAction`; `saveInitialBalanceAction` impacta solo la `Billetera` (sin `cash_*`).
- [x] 3.3 En `onboarding/initial-balance/**`: un único grupo "¿Cuánta plata tenés hoy?" (ARS + USD); sin rama experto+banco. La página resuelve `primary = Billetera` (cuenta `cash`).
- [x] 3.4 Gate/middleware: ya se basa en `onboarding_completed_at` (no referencia `profile` ni `mode`); sin cambios necesarios.

## 4. Onboarding — mobile (paridad)

- [x] 4.1 Eliminar `app/(onboarding)/profile.tsx`; `welcome` enruta a `/(onboarding)/initial-balance`.
- [x] 4.2 En `app/(onboarding)/initial-balance.tsx`: flujo único de saldo (sin mode/banco/`cash_*`).
- [x] 4.3 Splash gate: ya usa `onboarding_completed_at`; sin cambios.

## 5. Cuentas — web

- [x] 5.1 En `accounts/page.tsx`: quitar la lectura de `profiles.mode` y el `isNovato`; botón "Crear cuenta" siempre visible.
- [x] 5.2 En `accounts/_components/empty-accounts-state.tsx`: mostrar siempre el CTA de crear cuenta.
- [x] 5.3 En `accounts/new/page.tsx`: quitar el `redirect` por modo.
- [x] 5.4 (D3) Hint de primer uso (`AccountsHint`, dismissible vía `localStorage`/`useSyncExternalStore`) en el listado cuando hay una sola cuenta.

## 6. Tarjetas — web

- [x] 6.1 Borrar `app/(app)/cards/new/_components/create-novato-credit-card-form.tsx`.
- [x] 6.2 En `cards/new/page.tsx`: quitar la lectura de modo y la rama novato; siempre el form de 4 fechas.
- [x] 6.3 En `app/_actions/credit-cards.ts`: borrar `createNovatoCreditCard`.

## 7. Transacciones — web

- [x] 7.1 En `transactions/page.tsx`: `showAccount = filterOptions.accounts.length >= 2` (derivado de la data, no del modo).
- [x] 7.2 Renombrar el prop `isExpert` → `showAccount` en `movement-filters.tsx` (consistencia con `movement-list`/`movement-row`) y actualizar comentarios "expert mode" en los tres componentes + el detalle de cuenta.

## 8. DB + tipos

- [x] 8.1 Migración `supabase/migrations/0019_drop_profiles_mode.sql` con `ALTER TABLE public.profiles DROP COLUMN IF EXISTS mode;`.
- [x] 8.2 **(Manual, Supabase online)** Aplicar la migración en el SQL Editor **después** de mergear el código que ya no lee/escribe `mode` (ver D1). Aplicada: "Success. No rows returned".
- [x] 8.3 **(Manual, Supabase online)** Regenerar `packages/supabase/src/types.ts` y verificar que `mode` desapareció de `profiles`. Editado a mano (sin CLI en el entorno); `tsc` web + mobile en verde.

## 9. Tests

- [x] 9.1 Actualizar `apps/web/lib/__tests__/onboarding-schemas.test.ts` (quitar `profileSchema` y casos `cash_*`).
- [x] 9.2 Suite en verde (`pnpm --filter web test` — 215 passing).

## 10. Verificación

- [x] 10.1 `pnpm --filter web exec tsc --noEmit` (0 errores) y `pnpm --filter web lint` (0 errores; 2 warnings pre-existentes de `main`).
- [x] 10.2 Mobile: `tsc --noEmit` (0 errores) y `lint` (0 errores).
- [x] 10.3 **(Manual)** QA en navegador/app: onboarding sin modo, crear cuenta visible para todos, alta de tarjeta 4 fechas, filtro de transacciones con 1 cuenta (oculto) y con ≥2 (visible), dashboard intacto. Confirmado por el usuario.
- [x] 10.4 Grep final: sin `novato`/`experto` en código (solo comentarios de specs/changes); `isExpert` eliminado; sin lecturas de `profiles.mode`.

## 11. Docs + specs (en la rama, antes del merge)

- [x] 11.1 Reescrita la sección "User modes" de `CLAUDE.md` (un solo perfil) y arreglado el drift `users.mode` → `profiles.mode`; actualizados los módulos `profiles` y `cards`.
- [x] 11.2 **(Al mergear)** Aplicar los deltas a los master specs `profiles`, `onboarding`, `accounts`, `cards`, `dashboard` y archivar el change en `openspec/changes/archive/2026-05-27-remove-user-modes/`. Se limpió además el drift de modos fuera de los deltas autorizados (`transactions`, `auth`, `spending-by-category`) por decisión del usuario, para dejar el repo 100% consistente con el código.
- [x] 11.3 **(Al mergear)** `pnpm openspec:check` en verde.
