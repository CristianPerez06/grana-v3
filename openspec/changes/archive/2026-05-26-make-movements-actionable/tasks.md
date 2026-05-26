## 1. Acciones globales: factorizar y montar (D1)

- [x] 1.1 Extraer el bloque de acciones (botones Editar/Eliminar + `handleDelete` por tipo) de `TransactionDetailHeader` a un componente reutilizable que reciba `transaction`, `accountId` y `returnHref`. → `lib/transactions/components/transaction-actions.tsx`.
- [x] 1.2 Reemplazar el bloque inline de `TransactionDetailHeader` por el componente factorizado (sin cambiar su comportamiento actual en el detalle en-cuenta).
- [x] 1.3 Montar el componente de acciones en `global-transaction-detail.tsx` con `returnHref="/transactions"`, derivando `accountId` del movimiento.
- [x] 1.4 Verificar que eliminar desde el detalle global pide confirmación, recalcula saldos y vuelve a `/transactions`. (Implementado; QA runtime en 7.2.)

## 2. Edición global reusando la ruta existente (D2)

- [x] 2.1 En el detalle global, "Editar" navega a `/accounts/[id]/transactions/[txId]/edit?from=transactions` derivando `accountId` del movimiento.
- [x] 2.2 Asegurar que el back-nav de la ruta de edición respeta `from=transactions` y vuelve al módulo global. (Página de edición lee `from`; back-link y redirect post-guardado van a `/transactions/[txId]`.)

## 3. Compra en cuotas accionable (D2/D3)

- [x] 3.1 En `global-transaction-detail.tsx`, para la madre (`is_parent=true`, `account_id=NULL`) derivar el `accountId` de una hija (`installmentSiblings[0].account_id`).
- [x] 3.2 Exponer Editar/Eliminar en el detalle global de la madre (deja de ser dead-end). Editar reusa la ruta de edición; eliminar vía `deleteInstallmentParent` (solo si todas pending). Backend ya existía, no estaba expuesto.
- [x] 3.4 (QA A1) Regla de monto corregida: el monto es editable salvo compra/consumo de tarjeta **pagado**. En compra en cuotas no pagada, editar el monto **re-divide las N cuotas** (`updateInstallmentParent` extendido). Gate por "pagado" en el form + refuerzo server-side en `updateTransaction` (bloquea monto/fecha si `status='paid'`). Consumos de tarjeta no disparan el aviso de saldo negativo.
- [x] 3.3 Verificar que intentar eliminar con alguna cuota `paid` se rechaza con el mismo criterio que en-cuenta. (Guarda server-side en `deleteInstallmentParent`; error mostrado en `TransactionActions`.)

## 4. Registrar movimiento desde el módulo global (D4)

- [x] 4.1 Agregar acción "Registrar movimiento" en `apps/web/app/(app)/transactions/page.tsx`.
- [x] 4.2 (QA x2) Form unificado v2-style `movement-form.tsx` (`MovementForm`): **tipo arriba, cuenta como campo debajo**; gasto incluye tarjetas con cuotas/cotización inline; branching a las acciones existentes; **redirect a `/transactions`** tras guardar. Reemplaza el wrapper `register-movement-form.tsx` (borrado). Flujos por-cuenta intactos. → `app/(app)/transactions/new/`.
- [x] 4.3 Verificar que el movimiento creado por este flujo aparece en el listado global. (Reusa el alta existente, que ya aparece en `/transactions`; QA runtime en 7.2.)

## 5. Aviso de saldo negativo (D5)

- [x] 5.1 Crear un helper puro (en `apps/web/lib/transactions/` apoyado en `@grana/money-logic`) que, dado el `disponible` actual de la cuenta+moneda y la salida proyectada, indique si la operación deja el saldo en negativo. Aritmética solo con `Money`/decimal.js. → `lib/transactions/negative-balance-warning.ts` (`checkNegativeBalance`).
- [x] 5.2 Proveer al formulario el `disponible` actual por moneda de la cuenta origen (reusando `lib/transactions/balance.ts` vía `getAccountDetail`/`getAccounts`); en el registro global, al elegir la cuenta.
- [x] 5.3 Crear un componente de aviso no bloqueante (advertencia, distinto del error de v2) con copy que aclare que se puede registrar igual. → `lib/transactions/components/negative-balance-notice.tsx`.
- [x] 5.4 Integrar el aviso en el formulario de gasto. (alta: `transaction-form.tsx`.)
- [x] 5.5 Integrar el aviso en transferencia saliente (evalúa la cuenta origen). (alta: `transaction-form.tsx`.)
- [x] 5.6 Integrar el aviso en ajuste negativo (dirección "Resta"). (alta: `transaction-form.tsx`.)
- [x] 5.7 Integrar el aviso en confirmar instancia recurrente. (`pending-recurrences-block.tsx` + balances desde `/transactions`.)
- [x] 5.8 Integrar el aviso en pago de resumen de tarjeta (usa `balanceARS` de la cuenta de pago, ya provisto).
- [x] 5.9 En edición, comparar contra el `disponible` proyectado excluyendo el efecto del movimiento que se edita. (`edit-transaction-form.tsx`.)
- [x] 5.10 Verificar que los consumos de tarjeta (cuenta `credit`) NO disparan el aviso. (Por construcción: las tarjetas usan `RegisterCardPurchaseForm`, sin aviso; el helper recibe outflow solo para cash/bank.)

## 6. Duplicar movimiento (opcional — confirmar alcance)

- [x] 6.1 Definir si Duplicar entra en esta Fase. **DECISIÓN: se DIFIERE** (el usuario eligió diferir para mantener Fase 1 enfocada). 6.2–6.4 quedan fuera de alcance.
- [~] 6.2 (DIFERIDO) Implementar acción `duplicateTransaction` que reusa el alta con `date=getTodayAR()`, copiando cuenta, moneda, monto, categoría, descripción y tipo.
- [~] 6.3 (DIFERIDO) Exponer "Duplicar" en el detalle global (y/o en-cuenta) del movimiento.
- [~] 6.4 (DIFERIDO) Verificar que el duplicado es independiente del original y que ambos impactan el saldo.

## 7. Tests y cierre

- [x] 7.1 Tests del helper de saldo negativo (positivos, negativos, exactos, decimales, outflow no positivo). → `__tests__/negative-balance-warning.test.ts` (7 tests). Suite completa: 131/131 OK.
- [x] 7.2 QA runtime de accionabilidad global: editar/eliminar/registrar desde `/transactions`, incl. caso madre de cuotas, aviso de saldo negativo, y form unificado v2-style. Probado en la app por el usuario (A2–A6, B4/B5, B-card2, C1–C3, D5/D6/D8 y resto OK).
- [x] 7.3 Ejecutar `pnpm lint` (0 errores) y la verificación de specs. NOTA: `pnpm openspec:check` falla en Windows porque el script es bash y pnpm lo corre con cmd.exe (no es un problema de specs). Chequeo equivalente corrido vía bash: sin placeholders `TBD`; `openspec validate` OK. (Deuda menor: hacer el script cross-platform.)
- [ ] 7.4 Archivar el change y aplicar deltas al master spec `openspec/specs/transactions/spec.md` (checklist de CLAUDE.md), como último commit de la rama antes del merge `--ff-only`. (PENDIENTE: hacer tras la QA runtime.)
