## Why

C.1 trajo el detalle de movimiento nativo (`/transactions/[txId]`) en modo **read-only**; su requirement dice literalmente "la edición y el borrado son un change posterior". Este es ese change: la app nativa gana **editar** y **borrar** un movimiento desde el detalle, cerrando la paridad del gap "Detalle/edit".

El bloqueo real es chico: **la lógica de edición ya está toda compartida y cableada**. `useMovementForm` tiene un `submitEdit()` completo que rutea a todos los `update*` mutators, y el binding mobile (`apps/mobile/lib/transactions/mutators.ts`) **ya bindea** `updateTransaction/Transfer/Adjustment/Exchange`, `updateInstallmentParent` y `saveExpenseReimbursement` — con un comentario que lo dice: _"The native edit UI doesn't surface it yet; the binding keeps the shared contract complete and is ready for the native edit section to consume."_ El gating de campos (`getEditableFields`) ya es puro y compartido en `@grana/money-logic`, y los reads del grafo (`getTransactionDetail`, `getInstallmentFamily`) se extrajeron en C.1. **Cero i18n nuevo**: las keys de acciones y warnings de borrado (`transactions.detail.actions.delete_warning_{default,parent,card_payment}`, `delete_confirm`) ya viven en `@grana/i18n-messages`.

Lo único genuinamente **no compartido** es el **borrado**: `deleteTransaction` existe sólo como server action web (`apps/web/app/_actions/transactions.ts`) con sus guards (cuota hija, consumo pagado, leg de liquidación, guard temporal `GRN01`) y strings hardcodeados. Mobile no tiene nada. Este es el primer segundo consumidor real del borrado → dispara la extracción a un thin mutator compartido.

## What Changes

- **Extracción del thin `deleteTransaction`** a `@grana/transactions-mutations` (`GranaSupabaseClient` + `userId`), devolviendo `{ ok, errorCode? }` para que cada plataforma localice. Se llevan los guards (cuota hija, `paid`, `settlement`, mapeo `GRN01`) a la capa compartida; **web re-apunta** su action al mutator (`revalidateAfterMovementMutation` queda en web). Sin cambio de comportamiento; tests web verdes.
- **Binding mobile del borrado** en `mutators.ts` (resuelve auth, delega al thin mutator) + **mirror mobile de `buildMovementEditContext`** en `apps/mobile/lib/transactions/edit-context.ts` (mismo patrón de mirror que `getMovementSharedInfo`/`getHousehold`): arma el `MovementEditContext` a partir de los reads que la pantalla ya tiene (transacción + familia de cuotas + reintegro + split) más `getEditableFields` (puro, compartido).
- **Modo edición en el `MovementForm` mobile**: se agregan las ramas `isEdit` al mismo componente (paridad con web, que lo hace en un solo `movement-form.tsx`): oculta el selector de tabs; renderiza **filas de contexto read-only** (tipo · moneda · cuenta(s) con caption "no editable"); gatea cada campo por `editableFields`; muestra el hero de monto sólo si `editable.amount`; expone la cuenta de débito editable (pago de resumen, `editable.account`); respeta `reimbursementReadOnly`; label de submit "Guardar cambios". Todo el estado ya sale del hook — es sólo pintar.
- **Afordancia de editar/borrar en el detalle**: `MovementDetailView` gana acciones en el topbar gateadas por `canEdit` / `canDelete` / `canManage` (mismas reglas que web). **Editar** empuja la pantalla de edición; **Borrar** confirma con `Alert.alert` destructivo (warning por tipo) y, al éxito, invalida el cache y popea al feed.
- **Pantalla de edición nativa** `/transactions/[txId]/edit`: espeja `new.tsx` (mismos loads de cuentas/categorías/hogar) más el edit-context, y renderiza `<MovementForm edit={…}>`. Requiere **reestructurar** la ruta de detalle de `[txId].tsx` (archivo plano) a `[txId]/index.tsx` para poder anidar `[txId]/edit.tsx` (expo-router no admite archivo y carpeta homónimos).

## Capabilities

### Modified Capabilities

- `transactions`: el requirement **"La app nativa expone el detalle de movimiento `/transactions/[txId]`"** se ajusta — deja de ser estrictamente read-only; SHALL exponer las afordancias de **editar** y **borrar** gateadas por `canEdit`/`canDelete`/`canManage` (un movimiento compartido que pagó el otro miembro sigue legible pero NO editable/borrable).

### Added Capabilities

- `transactions`: nuevo requirement **"La app nativa expone la edición y el borrado de un movimiento"** — pantalla `/transactions/[txId]/edit` (reuso de `useMovementForm` en modo edición, gating por `editableFields`) + borrado desde el detalle vía el thin `deleteTransaction` compartido, con las mismas reglas de permiso y guards que web.

## Impact

- **Packages**: `@grana/transactions-mutations` gana el thin `deleteTransaction` (mueve los guards de la action web; misma abstracción `GranaSupabaseClient` que el resto de thin-mutations). Sin cambios de datos/API/RLS.
- **Web**: `deleteTransaction` action pasa a delegar en el mutator compartido (sin cambio de comportamiento; tests verdes).
- **Mobile**: `mutators.ts` (+delete), `lib/transactions/edit-context.ts` (nuevo mirror), `MovementForm.tsx` (ramas `isEdit`), `detail/MovementDetailView.tsx` (acciones), ruta de detalle reestructurada a `[txId]/index.tsx` + `[txId]/edit.tsx` (nuevo). Sin deps nuevas.
- **i18n**: cero keys nuevas (acciones + warnings de borrado ya en `@grana/i18n-messages`).
- **Dependencias entre changes**: depende de C.1 (detalle) ya mergeado. Reusa la capa de form/mutations ya extraída.

### Fuera de scope

- **Recurrencia editable** desde el detalle/edit (crear/editar/cancelar la serie) — su propia slice; el form no la toca en edición (igual que web).
- **Tiles de contexto diferidos de C.1** (peso en el mes, recurrencia, composición de resumen) — siguen fuera; este change no los agrega.
- **Confirmar/cancelar un reintegro** desde su flujo propio — el edit sólo agrega/edita/quita el reintegro **pendiente** (un reintegro recibido/cancelado se muestra read-only, igual que web).
- **Adopción del prop de navegación de filas por los panes account/card** — sigue siendo follow-up de C.1.
