## Why

La tab **Movimientos** de mobile ya muestra el feed global (change `mobile-movements-feed`, 2026-07-10), pero su `QuickAddFab` sigue **deshabilitado**: no hay forma de **registrar** un movimiento desde la app nativa. Es el gap de write más visible — el FAB está a la vista, verde, invitando al tap, y no hace nada.

Toda la lógica del formulario ya es **cross-platform**: `useMovementForm` (`@grana/movement-form`, 688 líneas) aloja el estado, las cascadas (tab → cuentas elegibles / moneda / toggles), los validadores y el submit dispatcher, y es 100% agnóstico de plataforma — toca el mundo exterior por sólo dos costuras: el objeto `Mutators` que recibe y la fn `translate`. El requirement `La lógica del formulario vive en @grana/movement-form` ya nombró este momento: dice que el hook recibe un `Mutators` que *"mobile (cuando exista) bindea a wrappers `@grana/supabase` para las thin mutations + a los orquestadores compartidos"*. Este change **es** ese momento.

Lo que todavía **no** está compartido es el cuerpo de las thin mutations (el `.insert({...})` de cada create/update): hoy vive inline en las server actions de `apps/web/app/_actions/transactions.ts`. Los orquestadores con rollback (`registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`) y los helpers de sharing/reintegro (`applySharedSplits`, `insertDeclaredReimbursement`) **ya** están en `@grana/transactions-mutations`; faltan las thin.

Es deliberadamente el **slice B-minimal**: pantalla full-screen `/transactions/new` con las tres tabs de mayor uso (**Gasto · Ingreso · Transferencia**) sobre cuentas **cash/bank**, con el **split compartido (100%-al-otro)** que el módulo Hogar de web ya ofrece. **NO** incluye consumo de tarjeta (+ cuotas + reintegro-a-resumen), cambio de moneda, ajuste, recurrencia, ni la edición de un movimiento existente. Cada uno es aditivo (ver [Fuera de scope](#fuera-de-scope)).

## What Changes

- **Extraer a `@grana/transactions-mutations`** las thin mutations (relocalización mecánica, web behavior-preserving), siguiendo el **mismo contrato que los orquestadores** ya alojados ahí — reciben un cliente Supabase **ya autenticado** y un input **ya validado**, devuelven `{ ok, formError?, fieldErrors?, id? }`, y NO conocen auth ni cache-invalidation:
  - Creates: `createIncome`, `createExpense`, `createTransfer`, `createAdjustment`, `createExchange`.
  - Updates: `updateTransaction`, `updateTransfer`, `updateAdjustment`, `updateExchange`, `updateInstallmentParent`.
  - El helper `verifyActiveCurrency` (pre-check de moneda activa) los acompaña (co-locado, mismo dominio).
- **Las server actions web** (`apps/web/app/_actions/transactions.ts`) pasan a ser **wrappers thin**: validan (schemas `@grana/validation`) + resuelven auth (`getAuthenticatedUserId`) + delegan el insert a la fn compartida + `revalidateAfterMovementMutation()`. Firma pública sin cambios, comportamiento de `/transactions` idéntico (cubierto por los tests web + typecheck).
- **Mutators mobile (thin):** `apps/mobile/lib/transactions/mutators.ts` bindea cada slot del contrato `Mutators` a: `auth.getUser()` + validación (schemas compartidos) + la fn extraída + invalidación TanStack (`invalidateAfterMovementMutation` nativo). Los slots aún no usados por la UI B-minimal (exchange, card purchase, installments, recurrence) se bindean igual (el contrato es un drift detector) aunque la pantalla no los dispare todavía.
- **Household read (thin, form-only):** `apps/mobile/lib/shared/queries.ts` — `getHousehold(supabase)` espejo del web (ya client-agnóstico), sólo lo que el form necesita para poblar el shape `Household` y habilitar el toggle "Compartir gasto". El módulo Hogar completo sigue web-only; esto es el mínimo para honrar el constraint del split.
- **Pantalla `/transactions/new` (full-screen, thin consumer):**
  - `PageHeader` (chrome visible desde el primer paint) + tabs `Gasto · Ingreso · Transferencia` (`Segmented`) + campos: monto (`MoneyAmountInput`, hero), cuenta (picker cash/bank), fecha (`DateField`), categoría (+drill a subcategoría, Gasto/Ingreso), descripción (+sugerencia por historial), aviso de saldo negativo, y el split compartido (Gasto, cuando el hogar tiene 2 miembros).
  - Monta `useMovementForm` con los mutators nativos, `accounts`/`categories`/`household` cargados vía TanStack Query, `today: getTodayAR()`, `translate` wire al i18n mobile.
  - `onSuccess` navega de vuelta al feed; `onMutationSuccess` invalida las queries del feed/dashboard/accounts.
- **Encender el FAB:** `QuickAddFab` con `DISABLED=false` — pierde `opacity-50` / `accessibilityState.disabled`, el tap navega a `/transactions/new`.

## Capabilities

### New Capabilities
<!-- Ninguna capability de negocio nueva: reusa el flujo de alta ya especificado, ahora en mobile. -->

### Modified Capabilities
- `transactions`:
  - El requirement **"La lógica del formulario vive en `@grana/movement-form`…"** se amplía: las **thin mutations** (creates/updates simples) SHALL vivir también en `@grana/transactions-mutations` como funciones isomórficas (cliente autenticado + input validado → resultado), no inline en cada plataforma. Web las consume vía wrappers thin (validate+auth+revalidate); mobile vía wrappers thin (validate+auth+invalidate TanStack).
  - El requirement **"La app nativa expone un FAB…"** se actualiza: con `/transactions/new` mobile ya existente, el FAB SHALL estar **habilitado** (sin `opacity-50`/disabled) y el tap SHALL navegar a `/transactions/new`.
  - Nuevo requirement — la app nativa expone la pantalla **`/transactions/new`** (create-only, tabs Gasto/Ingreso/Transferencia sobre cuentas cash/bank, con split compartido), thin consumer de `useMovementForm` + los mutators nativos.

## Impact

- **Packages**: `@grana/transactions-mutations` gana las thin creates/updates + `verifyActiveCurrency`. Sin deps nuevas (usa `@grana/supabase` + `@grana/validation`, ya deps). `@grana/movement-form` sin cambios (el hook ya estaba completo).
- **Web**: `apps/web/app/_actions/transactions.ts` pasa a wrappers thin sobre las fns extraídas; `/transactions` y todos los call-sites de alta/edición sin cambio de comportamiento. Cubierto por los tests web + typecheck.
- **Mobile**: nueva pantalla `/transactions/new` + `mutators.ts` + `getHousehold` thin + helper `invalidateAfterMovementMutation`; FAB habilitado. `@grana/movement-form`, `@grana/transactions-mutations`, `@grana/validation` pasan a ser deps de mobile (si no lo eran).
- **Sin cambios de datos/API/RLS**: mismas tablas, mismos schemas de validación, mismo RLS path (anon-key + policies) que web.
- **Dependencias entre changes**: depende de `mobile-movements-feed` (el feed que el alta refresca) y de los packages `@grana/movement-form` + `@grana/transactions-mutations` (existen). Habilita el change C (detalle/edición): las thin updates extraídas acá dejan a C como consumer puro de la pantalla de edición.

### Fuera de scope

- **Consumo de tarjeta de crédito** (cuenta `credit` en el picker) y con él **cuotas** (`registerInstallments`), **reintegro a resumen** (`reimbursement.target = statement`) y el reintegro-a-cuenta → change posterior (B.2). El picker de cuentas de B-minimal ofrece sólo cash/bank; las ramas `isCredit`/`isInstallments` del hook quedan inalcanzables desde mobile todavía (sin cambios al hook).
- **Cambio de moneda (exchange)** y **ajuste (adjustment)** como tabs → B.2. Sus mutators se extraen igual (el contrato es completo) pero la UI no expone las tabs.
- **Recurrencia** (toggle "Repetir" + `createRecurrenceFromMovement`) → B.2.
- **Edición de un movimiento existente** (`/transactions/[txId]` + edit context) → change C. Las thin updates se extraen ahora para dejar C como consumer puro; ninguna pantalla de edición mobile en B. El constraint de **movimiento pagado por el otro miembro = read-only** vive en C.
- **Módulo Hogar completo** (`/shared/*`) → sigue web-only. El `getHousehold` de este change es sólo el read mínimo que el form necesita.
