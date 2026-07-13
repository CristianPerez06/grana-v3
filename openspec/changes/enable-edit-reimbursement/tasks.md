## 1. Contratos compartidos (tipos)

- [x] 1.1 `packages/money-logic/src/movements.ts`: agregar `reimbursement?: boolean` a `EditableFields` y computarlo en `getEditableFields` (true para expense categorizable y madre de cuotas; false para `isCardPayment`, cuota hija, income/transfer/adjustment/exchange; ortogonal al lock por pagado).
- [x] 1.2 Actualizar/agregar tests de `getEditableFields` cubriendo la nueva columna `reimbursement` por tipo/estado.
- [x] 1.3 `packages/movement-form/src/types.ts`: agregar `reimbursement?: { id; status: 'pending'|'received'|'cancelled'; target: 'account'|'statement'; amount; accountId; cardPeriodId } | null` a `MovementEditContext`.
- [x] 1.4 `packages/movement-form/src/types.ts`: agregar el mutator `saveExpenseReimbursement` a `Mutators` (recibe expenseId + declaración opcional + spec de compartido; `undefined` ⇒ quitar) con su tipo de resultado.

## 2. Validación

- [x] 2.1 `packages/validation`: schema del input de `saveExpenseReimbursement` (expenseId, target, estimated_amount, account_id, received_now, date, card_period_id opcional, shared opcional); exportar el tipo.
- [x] 2.2 Tests del schema (monto positivo, target válido, cuenta requerida según target).

## 3. Orquestador de mutación

- [x] 3.1 `packages/transactions-mutations`: extraer la lógica de inserción reutilizable de `internal/declared-reimbursement.ts` (`insertDeclaredReimbursement`) para compartirla.
- [x] 3.2 `packages/transactions-mutations`: nuevo `saveExpenseReimbursement` (reconciliador): carga el reintegro vinculado (`linked_transaction_id=expenseId`, `type='reimbursement'`); **guarda** que rechaza si el actual está recibido/cancelado; borra el pendiente existente (con splits); inserta el nuevo si hay declaración; hereda el split vía `applySharedSplits` cuando el gasto es compartido. Para cuotas, `expenseId` = id de la madre y `statement` cae en el período de la 1ª cuota.
- [x] 3.3 Exportar el mutator desde `packages/transactions-mutations/src/index.ts`.
- [x] 3.4 Tests del orquestador: agregar (sin actual → insert), editar (pendiente → delete+insert), quitar (pendiente → delete), rechazo en recibido/cancelado, herencia de split compartido, y descompartir (sin split).

## 4. Hook `useMovementForm`

- [x] 4.1 `packages/movement-form/src/use-movement-form.ts`: prefillar el estado de reintegro desde `edit.reimbursement` (enabled, amount, target, receivedNow, accountId) al entrar en edición.
- [x] 4.2 Exponer un flag derivado de solo-lectura del reintegro (status recibido/cancelado) para que la UI lo consuma.
- [x] 4.3 Agregar la rama de reintegro en `submitEdit`: construir la declaración deseada (o `undefined` si el toggle quedó apagado), aplicar el update del gasto primero (con su `sharedUpdate`), luego llamar `saveExpenseReimbursement` con el spec de compartido resultante; en fallo del reintegro, setear `formError` y no reportar éxito.
- [x] 4.4 No permitir cambios cuando el reintegro es read-only (recibido/cancelado): submitEdit no debe intentar mutarlo.

## 5. UI web

- [x] 5.1 `apps/web/.../movement-form.tsx`: agregar `showReimbursementToggleEdit = isEdit && !!edit?.editableFields?.reimbursement` (gemelo de `showSharedToggleEdit`); actualizar el gate del bloque para renderizarlo también en edición.
- [x] 5.2 Renderizar la sección en estado editable (pendiente / sin reintegro) reutilizando los campos del alta, y en estado read-only (recibido/cancelado) como contexto de solo lectura con copy de estado.
- [x] 5.3 Ajustar la condición del contenedor de "Toggles" para que se muestre en edición cuando corresponda.

## 6. Carga del edit context (web)

- [x] 6.1 `apps/web` `buildMovementEditContext` (`transactions/[txId]/edit` y su lib): consultar el reintegro vinculado del gasto/madre y proyectarlo al shape `MovementEditContext.reimbursement` (o `null`).
- [x] 6.2 Verificar que para una madre de cuotas se resuelve el reintegro vinculado a la madre (no a una hija).
- [x] 6.3 (QA) `buildMovementEditContext` devuelve la lista de cuentas (proyección del alta) y ambos hosts de edición (`/edit` page + drawer del detalle) la pasan al `MovementForm`. En edición se montaba con `accounts={[]}`, lo que dejaba el select "Acreditar en" vacío y `isCredit` en falso (ocultaba los radios resumen/cuenta). El contexto de cuenta sigue siendo read-only vía `contextRows`; la lista solo alimenta la sección de reintegro.

## 7. Server action web

- [x] 7.1 `apps/web/app/_actions/reimbursements.ts` (o el módulo de acciones que corresponda): nueva action que valida el input y llama `saveExpenseReimbursement`, con `revalidateAfterReimbursementMutation`.
- [x] 7.2 Cablear la action al mutator `saveExpenseReimbursement` en el binding de `Mutators` que el `MovementForm` web recibe.

## 8. i18n

- [x] 8.1 `packages/i18n-messages`: reutilizar `transactions.reimbursement`; agregar solo el copy nuevo necesario para el estado read-only (recibido/cancelado) en `es.json` y `en.json`.

## 9. Verificación

- [x] 9.1 `pnpm typecheck` y lint verdes en los paquetes tocados y en `apps/web`.
- [ ] 9.2 QA manual (drawer/página de edición): agregar reintegro a un gasto simple sin reintegro (pendiente y ya recibido); editar el monto de uno pendiente; quitar uno pendiente; ver read-only en uno recibido y en uno cancelado.
- [ ] 9.3 QA manual tarjeta y cuotas: agregar reintegro en compra simple y en cuotas (link a la madre; "en resumen" cae en el período de la 1ª cuota).
- [ ] 9.4 QA manual compartido (hogar de 2): el reintegro hereda el split; descompartir el gasto en la misma edición deja el reintegro sin split; verificar la deuda derivada.
- [x] 9.5 Confirmar que no hace falta migración (esquema/triggers ya soportan el modelo).

## 10. Handoff mobile (lo lleva el tech lead)

La capa compartida quedó lista y el binding nativo del mutator ya está hecho para
no romper el typecheck; falta SOLO la UI nativa de edición. Contratos ya disponibles:
`EditableFields.reimbursement` (`@grana/money-logic`), `MovementEditContext.reimbursement`
(`@grana/movement-form`), `Mutators.saveExpenseReimbursement`, y el orquestador
`saveExpenseReimbursement` (`@grana/transactions-mutations`). El `submitEdit` del hook
compartido (`useMovementForm`) YA llama al mutator — mobile solo tiene que setear el
estado del reintegro desde su UI.

- [ ] 10.1 `apps/mobile/lib/transactions/mutators.ts`: **YA HECHO** — `saveExpenseReimbursement` está bindeado al orquestador compartido (espejo de `registerCardPurchase`). Sin trabajo pendiente acá salvo QA.
- [ ] 10.2 Edit-context nativo: cargar el reintegro vinculado del gasto/madre y proyectarlo a `MovementEditContext.reimbursement` (`{ id, status, target, amount, accountId, cardPeriodId } | null`). Espejo de `apps/web/lib/transactions/edit-context.ts` (query `type='reimbursement'` + `linked_transaction_id`, elegir el pendiente y si no hay, el recibido/cancelado para read-only).
- [ ] 10.3 Pasar la **lista de cuentas** al form de edición nativo (la sección de reintegro la necesita para "Acreditar en" y para derivar `isCredit`/target). En web esto era el bug `accounts={[]}`; verificar que el form de edición mobile ya reciba las cuentas.
- [ ] 10.4 `apps/mobile/components/transactions/MovementForm.tsx`: renderizar la sección de reintegro cuando `edit.editableFields.reimbursement` sea true — toggle + monto + target account/statement (solo tarjeta) + cuenta de acreditación + "ya me lo acreditaron". Estado **read-only** cuando `edit.reimbursement.status !== 'pending'` (recibido/cancelado): mostrar sin controles, con copy de estado. Espejo de la sección web (`movement-form.tsx`, gate `showReimbursementToggleEdit`).
- [ ] 10.5 QA nativo: agregar (pendiente y recibido), editar monto de un pendiente, quitar, read-only en recibido/cancelado; tarjeta + cuotas (link a la madre, "en resumen" en período de 1ª cuota); compartido (herencia de split, descompartir deja sin split).

Decisión de producto ya tomada (mantener en mobile): un reintegro **recibido o cancelado** es **read-only** desde la edición del gasto; se modifica/elimina desde el detalle propio del reintegro. El "Acreditar en" web es un `<select>` nativo sin avatares (consistente con el alta); mobile usa su propio control.
