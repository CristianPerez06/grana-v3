## 1. OpenSpec y contrato

- [x] 1.1 Documentar que recurrencias no reutilizan `transactions.status`.
- [x] 1.2 Documentar soporte inicial para ingresos, gastos cash/bank, consumos simples de tarjeta y transferencias.
- [x] 1.3 Documentar que compras en cuotas y ajustes quedan fuera del alcance inicial.
- [x] 1.4 Documentar sugerencias de recurrencia por patrones repetidos.
- [x] 1.5 Cerrar decisiones PO: monto editado actualiza regla, sugerencias on-the-fly con descartes persistentes, pausar/reactivar y eliminar.

## 2. Schema

- [x] 2.1 Crear tabla `recurrences` con RLS por `user_id`.
- [x] 2.2 Crear tabla `recurrence_instances` con RLS por `user_id`.
- [x] 2.3 Agregar FK opcional desde `recurrence_instances.confirmed_transaction_id` a `transactions`.
- [x] 2.4 Agregar FK opcional desde `recurrences.created_from_transaction_id` a `transactions`.
- [x] 2.5 Agregar indice/constraint que impida mas de una instancia `pending` por regla.
- [x] 2.6 Crear persistencia de descartes de sugerencias por fingerprint.
- [x] 2.7 Actualizar tipos Supabase para las tablas nuevas.

## 3. Validacion y dominio

- [x] 3.1 Definir schemas de regla recurrente por tipo.
- [x] 3.2 Definir helper de proxima fecha: semanal, quincenal, mensual con clamp de fin de mes, anual con 29/02.
- [x] 3.3 Definir mapper de instancia pendiente a input de creacion real.
- [x] 3.4 Definir regla de actualizacion de monto: editar monto de instancia actualiza tambien la regla.

## 4. Actions y queries

- [x] 4.1 `createRecurrenceFromMovement` para regla creada al registrar.
- [x] 4.2 `getRecurrences`.
- [x] 4.3 `getRecurrenceDetail`.
- [x] 4.4 `generateDueRecurrenceInstances` lazy, idempotente.
- [x] 4.5 `getPendingRecurrenceInstances`.
- [x] 4.6 `confirmRecurrenceInstance`, delegando en flujos existentes segun tipo.
- [x] 4.7 `skipRecurrenceInstance`.
- [x] 4.8 `updateRecurrence`.
- [x] 4.9 `pauseRecurrence` y `resumeRecurrence`.
- [x] 4.10 `deleteOrDeactivateRecurrence`.
- [x] 4.11 `getRecurrenceSuggestions`.
- [x] 4.12 `acceptRecurrenceSuggestion`.
- [x] 4.13 `dismissRecurrenceSuggestion`.

## 5. UI

- [x] 5.1 Toggle "Recurrente" en registro de ingreso/gasto/transferencia/consumo de tarjeta.
- [x] 5.2 Bloque "Pendientes recurrentes" arriba del historial de `/transactions`.
- [x] 5.3 Confirmar, editar y omitir instancia desde el bloque.
- [x] 5.4 Badge/link de regla recurrente en detalle de movimiento confirmado.
- [x] 5.5 Pantalla `/transactions/recurring` con reglas activas.
- [x] 5.6 Detalle/edicion de regla recurrente con pausar/reactivar y eliminar.
- [x] 5.7 Surface de sugerencia: "Parece que esto se repite".

## 6. Tests criticos

- [x] 6.1 Instancia pendiente no crea fila en `transactions`.
- [x] 6.2 Instancia pendiente no impacta saldos.
- [x] 6.3 Confirmar gasto cash/bank crea `status=NULL` e impacta saldo.
- [x] 6.4 Confirmar consumo de tarjeta crea `status='pending'`, `card_period_id` y no impacta saldo cash/bank.
- [x] 6.5 Confirmar transferencia impacta origen y destino.
- [x] 6.6 Confirmar consumo de tarjeta en periodo pagado falla.
- [x] 6.7 No se genera mas de una instancia pendiente por regla.
- [x] 6.8 Omitir instancia no crea transaccion.
- [x] 6.9 Regla con `end_date` se desactiva al superar fecha final.
- [x] 6.10 Sugerencia descartada no vuelve a mostrarse para el mismo patron.

### Cobertura de cada invariante

El repo no tiene infra de tests de integracion contra Supabase (CLAUDE.md: "Supabase is online-only"). Cada invariante se garantiza via funciones puras testeadas, constraints DB-level verificadas con smoke tests, o ambas. Mapa:

| # | Garantia |
|---|----------|
| 6.1 | DB `chk_recurrence_instances_pending_unresolved` (verified in `lib/recurrences/__tests__/migration.test.ts`) — una pending NO puede linkear a una transaction. Las pending viven solo en `recurrence_instances`. |
| 6.2 | Derivada de 6.1: `lib/transactions/balance.ts` calcula saldos sobre la tabla `transactions`; las pending no estan ahi. |
| 6.3 / 6.4 / 6.5 | `lib/recurrences/__tests__/mapper.test.ts` — el mapper produce el input correcto segun `movement_type` + `accountType`. La action `confirmRecurrenceInstance` delega a la action existente (`createIncome` / `createExpense` / `createTransfer` / `registerCardPurchase`), heredando sus garantias de shape. |
| 6.6 | `registerCardPurchase` valida `period.has_payment` y devuelve `formError`. `confirmRecurrenceInstance` propaga ese error con `delegated.ok || delegated.id` check. |
| 6.7 | `lib/recurrences/__tests__/generator.test.ts` "skips when has_pending" + DB `recurrence_instances_one_pending_per_rule` UNIQUE INDEX (verified en `migration.test.ts`). |
| 6.8 | `skipRecurrenceInstance` solo hace `UPDATE recurrence_instances` (revision de codigo). DB `chk_recurrence_instances_pending_unresolved` impide que una `skipped` tenga `confirmed_transaction_id`. |
| 6.9 | `lib/recurrences/__tests__/generator.test.ts` "skips when next date is past end_date". |
| 6.10 | `lib/recurrences/__tests__/suggestions.test.ts` "excludes streams whose fingerprint was dismissed" + DB `UNIQUE(user_id, fingerprint)` (verified en `migration.test.ts`). |
