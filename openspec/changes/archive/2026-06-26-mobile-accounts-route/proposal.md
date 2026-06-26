## Why

El módulo de cuentas existe en web (`/accounts` lista + `/accounts/[id]` detalle, con crear/editar/archivar/eliminar, agregar/quitar moneda, selector de banco con institución custom y avatar/color) pero en mobile solo hay un stub (`app/(app)/accounts.tsx`). Las capas de datos ya fueron extraídas **específicamente para habilitar este espejo**: `@grana/accounts` (reads + 7 mutations + tipos + `computeBalance`), `@grana/cards` (resúmenes credit que `getAccounts` embebe — no relevante acá porque `/accounts` es solo cash+bank), y —con las changes previas de este stack— `@grana/transactions` (movimientos por cuenta + reintegros) y el contrato de error neutro (`messageKey`) de las mutations.

Esta change construye el **consumer mobile thin** sobre esa capa lista: pantallas nativas + un mutator mobile que llama a `@grana/accounts` directo (sin server actions en mobile), inyectando el client nativo + `userId` + `today`, y traduciendo `messageKey`/`errorCode` con `useT`. Es el mismo shape "consumer mobile delgado sobre capa compartida lista" que se preparó para el form de movimientos.

Es la **tercera de tres** changes (`accounts-mutations-neutral-errors` → `transactions-read-slice` → **`mobile-accounts-route`**). Las dos previas son prerequisito: la #1 deja el contrato de error traducible por `useT`; la #2 desbloquea la lista de movimientos del detalle.

## What Changes

- **Navegación (Menú, no tab):** las tabs nativas están fijas (Inicio/Movimientos/Hogar/Menú). El módulo de cuentas se **pushea desde Menú** (ya lo hace `AccountsCard` del dashboard con `router.push('/accounts')`). `app/(app)/accounts.tsx` pasa a un stack `app/(app)/accounts/_layout.tsx` (`Stack { headerShown:false }`) — mirror de `settings/categories/`.
- **Pantallas (Expo Router):**
  - `accounts/index.tsx` — lista: secciones Efectivo / Cuentas bancarias (activas) + Archivadas; por fila avatar + nombre/institución + saldos ARS/USD + menú de acciones; empty state; hint de primer uso.
  - `accounts/[id]/index.tsx` — detalle: hero navy (identidad + saldos), card de reintegros pendientes, link "+ Agregar moneda", lista de movimientos con saldo corriente.
  - `accounts/new.tsx` — crear (form pushed; web era drawer).
  - `accounts/[id]/edit.tsx` — editar nombre + institución (saldos locked).
  - `accounts/[id]/currency.tsx` — agregar / desactivar moneda.
- **Componentes nativos (mismos nombres, impl RN):** `AccountSection`, `AccountRow`, `AccountRowMenu` (vía el `Popover` bottom-sheet + `Alert.alert` ya usados por `CategoryRow`), `CreateAccountForm`, `EditAccountForm`, `BankSelector` (búsqueda + alta de institución custom + color picker), `AccountAvatar`/color picker, lista de movimientos (read de `@grana/transactions` + `computeRunningBalances` de `@grana/money-logic`), card de reintegros, confirmaciones de archivar/eliminar.
- **Reads (`apps/mobile/lib/accounts/`):** hooks TanStack (`useAccountsList`, `useAccountDetail`, `useInstitutions`, `useAccountMovements`, `usePendingReimbursements`) sobre los paquetes compartidos, mirror de `useDashboardHero`. Query keys propios de mobile (los de web no son compartidos). `today` inyectado vía `getTodayAR()` de `@grana/money-logic` donde haga falta (lista/detalle no lo necesitan; mutations sí).
- **Mutator (`apps/mobile/lib/accounts/mutations.ts`):** análogo nativo del shell web `_actions/accounts.ts`. Resuelve `userId` (`supabase.auth.getUser()`), inyecta `today`, llama la mutation del paquete, mapea el resultado neutro a `{ ok } | { ok:false, errorKey, fieldErrors }` (mismo shape que `lib/categories.ts`), e invalida los query keys. `errorKey`/`messageKey` se resuelven con `useT` en la pantalla.
- **Diseño:** `docs/design/accounts/mobile` y `docs/design/accounts-detail/mobile` ya existen → tokenizar (tokens estructurales, no aliases shadcn que son web-only), no se necesita mock nuevo.
- **Sin cambios de negocio:** las reglas de cuentas (validación, guards de archivo/borrado, bimoneda) son las del paquete compartido; mobile conforma la implementación nativa a requirements ya vigentes.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva; el dominio accounts ya existe. -->

### Modified Capabilities
- `accounts`: se agregan los requirements de la implementación **mobile** del módulo de cuentas — navegación pushed desde Menú, lista + detalle + crear/editar + agregar/quitar moneda + archivar/eliminar/reactivar nativos, reads vía TanStack sobre los paquetes compartidos, y el mutator mobile que traduce el contrato de error neutro con `useT`. Paridad funcional con la superficie web; presentación idiomática nativa.

## Impact

- **Código (mobile, nuevo):** `apps/mobile/app/(app)/accounts/` (stack + 5 pantallas), `apps/mobile/lib/accounts/` (queries, mutations, query-keys), `apps/mobile/components/accounts/` (componentes nativos).
- **Código (mobile, deps):** `apps/mobile/package.json` (+`@grana/accounts`, `@grana/transactions`; `@grana/money-logic` ya presente). Sin nuevas libs de UI (action sheet = `Popover` + `Alert` existentes).
- **i18n:** keys de cuentas en `@grana/i18n-messages` ya existen (incluyendo `accounts.errors.*` neutralizadas en #1); agregar las que falten para labels nativos nuevos.
- **Sin cambios web.** Sin cambios de datos/API/RLS — RLS sigue siendo la frontera de autorización; el client nativo usa la sesión del usuario.
- **Detalles a confirmar en apply (ver design):** fidelidad del BankSelector con alta de institución custom + color picker; fidelidad del avatar/color picker; si el saldo corriente se muestra por fila (web lo esconde en mobile-web) o solo el total en el hero.
- **Riesgos:** medio. Es superficie nueva (no refactor), toca dinero (inputs vía `MoneyAmountInput`) y los guards de archivo/borrado. Mitigado porque la lógica vive en los paquetes ya testeados; el riesgo está en el wiring nativo (auth/today/invalidación) y la paridad de presentación.
