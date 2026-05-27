## 1. Validación (`packages/validation`)

- [ ] 1.1 En `src/onboarding.ts`: quitar `MODE_VALUES`, el campo `mode` y los campos/condicionales de banco (`has_bank_account`, `institution_id`, `bank_account_name`). Si con D2-a el paso de perfil desaparece, eliminar el schema de perfil entero; conservar solo el schema de saldo inicial.
- [ ] 1.2 En `src/credit-cards.ts`: borrar `createNovatoCreditCardSchema` y `CreateNovatoCreditCardInput`.
- [ ] 1.3 En `src/index.ts`: quitar los exports `createNovatoCreditCardSchema` y `CreateNovatoCreditCardInput` (y el schema de perfil si se eliminó).

## 2. i18n (`packages/i18n-messages`)

- [ ] 2.1 En `src/es.json` y `src/en.json`: borrar `mode_simple_title/description`, `mode_detailed_title/description`, `description_experto`, `group_experto` (si existe), `subtitle_novato`, `novato_close_date`, `novato_close_helper`.
- [ ] 2.2 Renombrar las claves que sobreviven con sufijo de modo a neutral (`description_novato` → `description`, `group_novato` → `group_total`, etc.) y actualizar sus consumidores en código.

## 3. Onboarding — web

- [ ] 3.1 (D2-a) Eliminar la ruta `app/(onboarding-wizard)/onboarding/profile/**` y hacer que `welcome` navegue a `/onboarding/initial-balance`.
- [ ] 3.2 En `app/_actions/onboarding.ts`: borrar `saveProfileAction` (o su rama de modo/banco) y dejar solo la acción de saldo inicial sobre la `Billetera`.
- [ ] 3.3 En `onboarding/initial-balance/**`: dejar un único grupo "¿Cuánta plata tenés hoy?" (ARS + USD); quitar la rama experto+banco de dos grupos.
- [ ] 3.4 Actualizar el gate/middleware y la redirección de reanudar para el nuevo set de pantallas (sin `profile`).

## 4. Onboarding — mobile (paridad)

- [ ] 4.1 (D2-a) Eliminar `app/(onboarding)/profile.tsx` y enrutar `welcome → initial-balance`.
- [ ] 4.2 En `app/(onboarding)/initial-balance.tsx`: flujo único de saldo (sin rama por modo/banco).
- [ ] 4.3 Actualizar el splash gate de onboarding al nuevo set de pantallas.

## 5. Cuentas — web

- [ ] 5.1 En `accounts/page.tsx`: quitar la lectura de `profiles.mode` y el `isNovato`; el botón "Crear cuenta" siempre visible.
- [ ] 5.2 En `accounts/_components/empty-accounts-state.tsx`: mostrar siempre el CTA de crear cuenta.
- [ ] 5.3 En `accounts/new/page.tsx`: quitar el `redirect` por modo (ruta accesible para todos).
- [ ] 5.4 (D3) Agregar el hint de primer uso (nota dismissible) en el listado de cuentas.

## 6. Tarjetas — web

- [ ] 6.1 Borrar `app/(app)/cards/new/_components/create-novato-credit-card-form.tsx`.
- [ ] 6.2 En `cards/new/page.tsx`: quitar la lectura de modo y la rama novato; renderizar siempre el form de 4 fechas.
- [ ] 6.3 En `app/_actions/credit-cards.ts`: borrar `createNovatoCreditCard`.

## 7. Transacciones — web

- [ ] 7.1 En `transactions/page.tsx`: reemplazar `showAccount = profile.mode === 'experto'` por `showAccount = (cantidad de cuentas) >= 2`.
- [ ] 7.2 Actualizar comentarios "expert mode"/"novato" en `lib/transactions/components/movement-filters.tsx`, `movement-list.tsx`, `movement-row.tsx` (la lógica de props se mantiene).

## 8. DB + tipos

- [ ] 8.1 Crear migración `supabase/migrations/00XX_drop_profiles_mode.sql` con `ALTER TABLE public.profiles DROP COLUMN mode;` y un comentario explicando el retiro del flag.
- [ ] 8.2 Aplicar la migración en el SQL Editor de Supabase (online) **después** de mergear el código que ya no lee/escribe `mode` (ver D1).
- [ ] 8.3 Regenerar `packages/supabase/src/types.ts` (`supabase gen types ...`) y verificar que `mode` desapareció de `profiles`.

## 9. Tests

- [ ] 9.1 Actualizar `apps/web/lib/__tests__/onboarding-schemas.test.ts` (quitar casos de `mode`/banco).
- [ ] 9.2 `pnpm --filter web test` (o el runner del repo) en verde.

## 10. Verificación

- [ ] 10.1 `pnpm --filter web exec tsc --noEmit` (0 errores) y `pnpm --filter web lint` (0 errores).
- [ ] 10.2 Typecheck/lint de mobile si aplica.
- [ ] 10.3 QA manual: onboarding completo (sin elegir modo), crear cuenta visible para todos, alta de tarjeta con 4 fechas, filtro de transacciones con 1 cuenta (oculto) y con ≥2 (visible), dashboard intacto.
- [ ] 10.4 Grep final: `grep -rniE "novato|experto" apps packages` sin resultados de usuario-modo; `\bmode\b` solo en usos no relacionados (edit/create/input mode).

## 11. Docs + specs (en la rama, antes del merge)

- [ ] 11.1 Reescribir en `CLAUDE.md` la sección "User modes" (una sola app) y arreglar el drift `users.mode` → `profiles.mode` donde aparezca.
- [ ] 11.2 Aplicar los deltas a los master specs `profiles`, `onboarding`, `accounts`, `cards`, `dashboard` y archivar el change en `openspec/changes/archive/2026-05-27-remove-user-modes/`.
- [ ] 11.3 `pnpm openspec:check` en verde.
