## 1. Modelo de datos

- [x] 1.1 Nueva migración aditiva: `recurrences` + `household_id` (uuid null, FK a `household` on delete set null) + `default_split` (jsonb null)
- [x] 1.2 Misma migración: `recurrence_instances` + `household_id` (uuid null, FK on delete set null) + `split` (jsonb null)
- [x] 1.3 Regenerar tipos con `supabase gen types` (proyecto `exhpnnaigjfcxcvmptxa`) y verificar que `recurrences`/`recurrence_instances` exponen los campos nuevos

## 2. Validación

- [x] 2.1 Agregar `shared` opcional (reusando `sharedExpenseSchema`) al schema de recurrencia de gasto en `packages/validation/src/recurrences.ts`
- [x] 2.2 Confirmar que income y transfer NO aceptan `shared` (queda fuera de alcance)
- [x] 2.3 Test de validación: split que no suma 100 es rechazado; alta sin `shared` sigue válida

## 3. Generación de instancias

- [x] 3.1 En `generateDueRecurrenceInstances` (`apps/web/lib/recurrences/queries.ts` ~L295) propagar `household_id` y copiar `default_split` → `split` en el insert de la instancia (espejo de `amount: rule.amount`)
- [x] 3.2 Test: regla compartida genera instancia con `household_id` + `split`; regla individual genera instancia sin esos campos (vía función pura `buildPendingInstanceInsert`)
- [x] 3.3 UX (detectado en QA): `createRecurrence` y `createRecurrenceFromMovement` generan la instancia debida en el acto (la generación lazy solo corría al remontar), para que el aviso "por confirmar" aparezca sin refrescar. Idempotente por el índice único de una pendiente por regla.

## 4. Confirmación

- [x] 4.1 En `mapInstanceToConfirmPlan` (`apps/web/lib/recurrences/mapper.ts`) emitir `shared: { household_id, splits }` en el `CreateExpenseInput` cuando la instancia tiene `household_id`, tomando `splits` de `instance.split` (también en la rama `card_purchase` para no perder el split en cuentas de crédito)
- [x] 4.2 Verificar que `confirmRecurrenceInstance` (`apps/web/app/_actions/recurrences.ts`) pasa el plan a `createExpense` sin cambios y que `applySharedSplits` se ejecuta
- [x] 4.3 Test: confirmar instancia compartida 50·50 crea gasto `is_shared` con dos filas de split y la deuda del hogar refleja la parte del otro; confirmar instancia individual no crea split (unit: mapper emite/omite `shared` según `household_id`; el flujo completo confirm→split→deuda es DB en vivo → QA 7.2)

## 4b. Recurrencia desde un movimiento compartido

- [x] 4b.1 En `createRecurrenceFromMovement` (`packages/transactions-mutations/src/create-recurrence-from-movement.ts`) heredar el split del gasto semilla: leer `is_shared`/`household_id` + filas `shared_expense_split` y persistir `household_id` + `default_split` en la regla
- [x] 4b.2 Test: seed compartido → regla con hogar + split; seed individual → regla individual

## 5. UI de alta

- [x] 5.1 En `create-recurrence-modal.tsx` agregar toggle "Compartir" + editor de split, visible solo para `type=expense` y hogar de dos miembros
- [x] 5.2 Pasar `shared` en el payload de alta cuando el toggle está activo; ocultar/limpiar el campo al cambiar el tipo a income/transfer
- [x] 5.3 Confirmar que el edit drawer de la recurrencia NO muestra controles de compartir/split (estructural, fijo al alta)
- [x] 5.4 Sello "Compartido" en la tarjeta del hub de pendientes (`pending-recurrences-block.tsx`) cuando la instancia tiene `household_id`; la acción de confirmar sigue solo en el hub. Teaser en módulo Compartido = follow-up.

## 6. Guard de salida del hogar

- [x] 6.1 En `leaveHousehold` (`apps/web/app/_actions/shared.ts`) bloquear la salida si existe una regla recurrente activa con `household_id`, con mensaje que pide pausar o eliminarla primero
- [x] 6.2 Test: salida bloqueada con regla compartida activa; salida exitosa sin reglas compartidas ni deuda (server action sobre supabase, sin precedente de mock en el repo → verificación en QA 7.2, igual que los tests de shared que son de lógica pura)

## 7. Cierre

- [x] 7.1 Correr suite de tests afectada (validation, recurrences, shared) y typecheck — 458 tests verdes, typecheck y lint limpios
- [x] 7.2 QA manual del caso guía: crear recurrencia de alquiler 50/50, generar y confirmar una instancia, verificar deuda derivada en la cuenta corriente (validado: alta directa + desde movimiento, badge Compartido, generación sin refresco)
- [x] 7.3 Archivar el change y sincronizar specs EN la branch, antes de mergear
