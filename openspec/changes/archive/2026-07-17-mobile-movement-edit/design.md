# Design — mobile-movement-edit

## Contexto

Web edita un movimiento con **un solo componente** (`apps/web/lib/transactions/components/movement-form.tsx`, ~1734 líneas) que ramifica por `isEdit`: en modo edición oculta el selector de tipo, muestra filas de contexto read-only (tipo · moneda · cuenta) y gatea cada campo por `editableFields`. El submit rutea a los `updateX` actions. El borrado vive aparte, en `DetailActions` (dropdown ··· + AlertDialog) que llama a `deleteTransaction`.

En mobile, tras C.1, **casi todo ya está**: `useMovementForm(edit)` tiene `submitEdit()` completo; el binding mobile ya cablea los `update*` + `saveExpenseReimbursement` + `updateInstallmentParent`; `getEditableFields` es puro y compartido; `getTransactionDetail`/`getInstallmentFamily` se extrajeron. Falta la **UI** de edición, el **edit-context** que la alimenta, y el **borrado** (que no existe en mobile en ninguna forma). Este change es, en su mayor parte, pintar y un mínimo de extracción.

## Decisión 1 — Un solo `MovementForm` con ramas `isEdit` (no un `MovementEditForm` aparte)

Web mantiene create y edit en un componente. Por el principio cross-platform (mismos nombres/estructura, impl idiomática por plataforma), mobile hace lo mismo: se **agregan las ramas `isEdit`** al `MovementForm` existente, no se crea un componente nuevo.

En modo edición el form:
- **Oculta** el selector de tabs (el tipo es inmutable).
- Renderiza **filas de contexto read-only** (una card con filas etiqueta/valor + caption `common.not_editable`): tipo (o "Compra en cuotas"), moneda, y cuenta(s) — origen→destino para transferencia/cambio, o la cuenta simple cuando `!editable.account`.
- Muestra el **hero de monto** sólo si `editable.amount`; si no, el monto va como fila de contexto.
- Gatea cada campo por `editableFields.*` (categoría, fecha, descripción, dirección de ajuste, monto recibido de cambio, shared, reintegro).
- Expone la **cuenta de débito editable** sólo cuando `editable.account` (pago de resumen: la cuenta es un puntero de débito sin cascada).
- Respeta `reimbursementReadOnly` (reintegro recibido/cancelado: se muestra pero no se edita).
- Label de submit "Guardar cambios" (`transactions.edit_title` / la key equivalente ya en i18n).

Costo: el archivo crece (~980 → más grande). Aceptado — es el mismo trade-off que web ya asumió, y evita duplicar el andamiaje de campos.

## Decisión 2 — `buildMovementEditContext`: mirror mobile, no extracción

Web arma el `MovementEditContext` en `apps/web/lib/transactions/edit-context.ts` (~150 líneas de I/O: resuelve cuenta del padre + `hasPaidInstallment`, llama `getEditableFields`, lee saldo disponible, el % de split actual y el reintegro vinculado). Devuelve **tipos web** (su propio `Household`, `CategoryWithSubcategories`), así que no hay una extracción limpia hoy.

Precedente: `getHousehold` y `getMovementSharedInfo` son **mirrors** deliberados en mobile, diferidos a extracción "cuando aterrice el módulo Hogar". Se sigue el mismo camino: un **mirror mobile** en `apps/mobile/lib/transactions/edit-context.ts` que arma el `MovementEditContext` reusando los reads que la pantalla ya dispara (transacción + familia + reintegros + split) más `getEditableFields` (el núcleo puro, ya compartido). La duplicación real es sólo el ensamblado de I/O, no la regla de editabilidad.

## Decisión 3 — Sólo el borrado se extrae (thin `deleteTransaction` compartido)

A diferencia del edit-context, el borrado **no tiene** ninguna forma compartida y sus guards NO deben divergir entre plataformas (una cuota hija, un consumo pagado, un leg de liquidación y el guard temporal `GRN01` bloquean el borrado). Se extrae un thin `deleteTransaction(supabase, userId, id)` a `@grana/transactions-mutations` que:
- corre los guards y devuelve `{ ok: false, errorCode }` (p. ej. `'installment_child'`, `'paid'`, `'settlement'`, `'GRN01'`) o `{ ok: true }`,
- deja que cada plataforma **localice** el `errorCode` (web con sus strings, mobile con las keys `transactions.detail.actions.*` ya presentes).

Web re-apunta su action al mutator y conserva `revalidateAfterMovementMutation()`. Es el mismo patrón que el resto de `@grana/transactions-mutations` (thin sobre `GranaSupabaseClient`, plataforma-agnóstico).

## Decisión 4 — Borrado con `Alert.alert` destructivo (precedente existente)

El patrón de confirmación **destructiva** ya establecido en mobile es `Alert.alert(..., { style: 'destructive' })` — lo usan `AccountRowMenu` y `CategoryRow`. Los bottom-sheets existentes (`SelectSheet`) son **pickers**, no confirmaciones, y no hay `ConfirmSheet`. Se sigue el precedente: **`Alert.alert`** con el warning por tipo (`delete_warning_default` / `_parent` / `_card_payment`, ya en i18n) y el CTA `delete_confirm`. Cero primitivos nuevos, consistente con los otros borrados de la app.

## Decisión 5 — Reestructura de la ruta de detalle

expo-router (como Next app-router) no admite a la vez el archivo `[txId].tsx` y la carpeta `[txId]/`. Para anidar `[txId]/edit.tsx` se **mueve** el detalle de `apps/mobile/app/(app)/transactions/[txId].tsx` → `[txId]/index.tsx` (mismo contenido, mismo path público `/transactions/[txId]`). La pantalla de edición queda en `[txId]/edit.tsx`, espejo de `new.tsx`: mismos `useQuery` de cuentas (`['movement-form','accounts']`), categorías y hogar, más el edit-context keyed por `txId`; header chrome visible desde el primer paint; al guardar, invalida y vuelve al detalle (patrón `?from=` ya existente).

Alternativa descartada: `/transactions/edit/[txId]` — evitaría mover el archivo pero diverge del path web (`/transactions/[txId]/edit`); la paridad de estructura pesa más que ahorrar un rename.

## Decisión 6 — Gating de permisos, espejo de web

Las afordancias del detalle se gatean con las mismas reglas que `global-transaction-detail.tsx`:

```
canManage = transaction.user_id === currentUserId   // compartido pagado por el otro → read-only
canEdit   = canManage && account != null && status !== 'paid' && !esCuotaHija
canDelete = canManage && account != null && !parent_id       && status !== 'paid'
```

Un movimiento compartido es **legible** cross-user (RLS del hogar) pero sólo su dueño (pagador) lo edita/borra; sin este gate el otro miembro vería el form y un "no encontrado" al guardar (la mutation filtra por `user_id`). El edit-context mobile devuelve `null` cuando `transaction.user_id !== user.id` (igual que web), y el detalle esconde las acciones.

## Riesgos / notas

- **Sin tests nuevos de negocio**: el thin `deleteTransaction` preserva comportamiento (cubierto por los tests web al re-apuntar la action); el edit rutea por `submitEdit()` ya existente. Verificación = typecheck (web+mobile), `pnpm --filter web test` verde, lint, y smoke en device por tipo (simple, cuotas madre/hija, transferencia, ajuste, cambio, compartido, con reintegro; y los casos read-only/locked: consumo pagado, cuota hija, compartido ajeno).
- **Crecimiento de `MovementForm.tsx`**: se acepta un componente más grande a cambio de paridad con la estructura de web (un solo form create+edit).
- **`errorCode` como contrato**: el thin mutator expone strings de `errorCode` estables que ambas plataformas mapean; agregar un guard nuevo = agregar su `errorCode` + su string en cada plataforma.
