# Tasks — mobile-movement-edit

## 1. Extracción del thin `deleteTransaction` (Decisión 3)

- [x] 1.1 Agregar `deleteTransaction(supabase, userId, id)` a `@grana/transactions-mutations` (`packages/transactions-mutations/src/thin-mutations.ts` + export en `index.ts`), moviendo los guards de la action web: cuota hija (`parent_id`), consumo `paid`, leg de `settlement`, y el mapeo del guard temporal `GRN01`. Devuelve `{ ok: true }` o `{ ok: false, errorCode }` (sin strings hardcodeados). `DELETE_GUARD_CODES` exporta los códigos estables; `GRN01` fluye por `error.code`.
- [x] 1.2 Re-apuntar `apps/web/app/_actions/transactions.ts::deleteTransaction` al thin mutator: llama al mutator, localiza el `errorCode` a los strings actuales (o `translatePostgresError`), conserva `revalidateAfterMovementMutation()`. Sin cambio de comportamiento.
- [x] 1.3 `pnpm --filter web test` verde (468), `pnpm --filter web typecheck` verde (los tests de borrado siguen cubriendo los guards vía la action re-apuntada).

## 2. Capa mobile: binding de borrado + edit-context mirror (Decisión 2, 3, 6)

- [x] 2.1 Binding de borrado en `apps/mobile/lib/transactions/mutators.ts`: `deleteMovement(id, t)` resuelve auth (`currentUserId`) y delega en el thin `deleteTransaction`; localiza el resultado a `transactions.errors.generic` (los guards ya los previene `canDelete`; GRN01 degrada a genérico — web conserva su copy específico).
- [x] 2.2 Mirror mobile de `buildMovementEditContext` en `apps/mobile/lib/transactions/edit-context.ts`: arma el `MovementEditContext` reusando los reads del detalle (transacción + `getInstallmentFamily` para `hasPaidInstallment`/cuenta del padre + `getAccountDetail` para el saldo + reintegro pendiente + split %) más `getEditableFields` (puro, compartido). Devuelve `null` cuando `transaction.user_id !== user.id` o el movimiento no es editable por este form (reintegro/settlement, padre sin cuenta resoluble).

## 3. Modo edición en `MovementForm` mobile (Decisión 1)

- [x] 3.1 Ramas `isEdit` en `apps/mobile/components/transactions/MovementForm.tsx`: ocultar el selector de tabs; renderizar la card de **filas de contexto read-only** (tipo/"Compra en cuotas" · moneda · cuenta(s) origen→destino o simple) con caption `common.not_editable`.
- [x] 3.2 Gating de campos por `editableFields`: hero de monto sólo si `editable.amount`; categoría/fecha/descripción/dirección-de-ajuste/monto-recibido gateados; moneda inmutable (segmented oculto); cuenta de débito editable sólo si `editable.account` (pago de resumen); cuentas origen/destino inmutables; `reimbursementReadOnly` respetado (toggle disabled + resumen read-only del reintegro recibido/cancelado). Label de submit "Guardar cambios". Recurrencia/cuotas/preview de ajuste ocultos en edit.
- [x] 3.3 `new.tsx` sigue funcionando sin `edit` (modo create intacto); el warning de saldo negativo usa la rama de edición del hook (baseline por `signedAmount`). Typecheck + lint mobile verdes.

## 4. Afordancia editar/borrar + pantalla de edición (Decisión 4, 5, 6)

- [x] 4.1 Reestructurar la ruta: mover `apps/mobile/app/(app)/transactions/[txId].tsx` → `[txId]/index.tsx` (mismo contenido/path público; `_layout.tsx` usa `<Stack>` dinámico, sin nombres hardcodeados).
- [x] 4.2 Acciones en el topbar del detalle (`[txId]/index.tsx`): botón **Editar** (gateado por `canEdit`) que empuja `/transactions/[txId]/edit?from=…`; botón **Borrar** (gateado por `canDelete`) que abre `Alert.alert` destructivo con el warning por tipo (`delete_warning_{default,parent,card_payment}`) y CTA `delete_confirm`; al éxito invalida el cache (`invalidateAfterMovementMutation`) y va al feed; en error muestra `Alert.alert`. `canManage` viene de `getMovementDetail`; `canEdit`/`canDelete` calculados como web (`actionAccountId`, `status !== 'paid'`, cuota hija / madre). Chrome siempre visible.
- [x] 4.3 Pantalla `apps/mobile/app/(app)/transactions/[txId]/edit.tsx`: espejo de `new.tsx` (mismos `useQuery` de cuentas/categorías/hogar) + edit-context keyed por `txId`; renderiza `<MovementForm edit={…}>`; header chrome desde el primer paint; `notFound` cuando el edit-context es `null` (movimiento no editable / ajeno); al guardar vuelve al detalle (invalidación refresca el detalle).

## 5. Verificación

- [x] 5.1 Typecheck web + mobile en verde; `pnpm --filter web test` verde (468); lint mobile/web verde (salvo warning pre-existente `gen-icons.mjs`).
- [x] 5.2 Cero keys i18n nuevas; diff de `@grana/i18n-messages` vacío. Cambios de `apps/web` acotados a `deleteTransaction` re-apuntado (sin cambio de comportamiento).
- [x] 5.3 Smoke en device — **editar**: gasto simple (monto/categoría/fecha/descripción), ingreso, transferencia, ajuste (dirección), cambio (monto recibido), compartido (toggle + split), gasto con reintegro pendiente (agregar/editar/quitar), compra en cuotas madre (categoría/descripción; monto locked si hay cuota pagada), pago de resumen (cuenta de débito editable). **Read-only/locked**: consumo pagado (sin editar/borrar), cuota hija (sin acción; nota al padre), compartido ajeno (legible, sin acciones). **Borrar**: confirma con warning por tipo, popea al feed; guards (cuota hija / pagado / liquidación) muestran el error correcto.
