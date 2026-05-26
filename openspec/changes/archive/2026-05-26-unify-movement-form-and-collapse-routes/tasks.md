## 1. Lógica pura de editabilidad (`@grana/money-logic`)

- [x] 1.1 Definir `MovementEditInput` (`type`, `status`, `isParent`, `isCardPayment`, `hasPaidInstallment`) y `EditableFields` (`amount`, `date`, `category`, `subcategory`, `description`, `adjustmentDirection`, `destinationAmount`) en `packages/money-logic/src/movements.ts`; implementar `getEditableFields(input)` puro con las reglas actuales (sin cambios de comportamiento). Exportado vía `index.ts` (`export * from './movements'`). (`category=false` ⇒ campo oculto, cubre el pago de resumen; tipo/moneda/cuenta no van en el descriptor: son contexto inmutable.)
- [x] 1.2 Tests exhaustivos de `getEditableFields` (`apps/web/lib/transactions/__tests__/editable-fields.test.ts`): ingreso, gasto cash/bank, transfer, ajuste, cambio, consumo `pending`, consumo `paid`, pago de resumen (sin categoría), madre con `hasPaidInstallment=false` (monto editable) y `=true` (monto/fecha bloqueados) + invariantes. 14 tests, suite verde (183).

## 2. Modo edición del formulario único (`MovementForm`)

- [x] 2.1 `MovementForm` acepta `edit?: MovementEditContext` (+ `preselectAccountId`/`createReturnHref` para el alta). Sin `edit` → modo creación (comportamiento intacto, detrás de `!isEdit`). Con `edit` → modo edición.
- [x] 2.2 Modo edición: oculta tabs y controles propios del alta (recurrencia, cuotas nuevas, fx, selector de cuenta/moneda/destino); bloque de contexto inmutable (tipo/moneda/cuenta(s)/cuotas); campos gateados por `editableFields`; prefill desde la transacción (monto abs, dirección de ajuste, dos montos del cambio, categoría/subcategoría/descripción/fecha).
- [x] 2.3 Submit en edición: enruta a `updateTransaction`/`updateTransfer`/`updateAdjustment`/`updateExchange`/`updateInstallmentParent` según tipo/`isParent`, enviando sólo los campos editables; vuelve a `returnHref`. Aviso de saldo negativo con baseline que excluye el efecto propio (y saltea consumos de tarjeta off-ledger vía `status`).
- [x] 2.4 Saldo por moneda en el selector de cuenta (alta): cada cuenta cash/bank muestra su saldo por moneda; tarjetas sin saldo.

## 3. Rutas canónicas

- [x] 3.1 Nueva ruta `apps/web/app/(app)/transactions/[txId]/edit/page.tsx`: carga transacción + categorías + balances (+ familia de cuotas para `hasPaidInstallment`/cuenta-hija si es madre), arma `MovementEditContext` con `getEditableFields`, computa `returnHref` desde `?from=`, monta `MovementForm` en modo edición.
- [x] 3.2 `/transactions/new/page.tsx`: lee `?account=<id>` (pre-selección; el form fuerza tab Gasto si es tarjeta) y `?from=<origen>` (`resolveReturnHref` → cuenta/tarjeta/lista). Pasa `preselectAccountId` y `createReturnHref`.
- [x] 3.3 Detalle global: "Editar" → `/transactions/[txId]/edit?from=...` (preserva perspectiva); quitado el enlace "ver en cuenta" scoped; `from` propagado desde la page; back-nav de la detail-page extendido a `card:<id>`.

## 4. Recableo de enlaces y actions

- [x] 4.1 CTA de alta → `/transactions/new?account=<id>&from=...`: `accounts/[id]/page.tsx` (`from=account:`), `cards/[id]/page.tsx` y `payment-cta-block.tsx` (`from=card:`).
- [x] 4.2 Filas/enlaces de detalle → `/transactions/[txId]?from=...`: `cards/[id]/page.tsx` y `cards/[id]/periods/[periodId]/page.tsx` (`from=card:`). La lista de la cuenta (`/accounts/[id]`) ya enlazaba canónico con `from=account:` desde el Change 1.
- [x] 4.3 Actions: `revalidatePath('/accounts/${accountId}/transactions/${id}')` (×4 en `transactions.ts`) → `revalidatePath('/transactions')` + `revalidatePath('/transactions/${id}')`. (No había equivalentes en `credit-cards`.)

## 5. Borrado del árbol scoped

- [x] 5.1 Borrado `apps/web/app/(app)/accounts/[id]/transactions/` completo (new/[txId]/[txId]/edit + `_components`: `transaction-form`, `register-card-purchase-form`, `edit-transaction-form`, `edit-exchange-form`, `transaction-detail-header`, páginas).
- [x] 5.2 Sin imports ni `href` a `/accounts/[id]/transactions/*` en código fuente (grep limpio; sólo quedan artefactos en `.next/`, regenerados por el build).

## 6. Verificación

- [x] 6.1 `pnpm build` (web) verde (corre lint + type-check de rutas); `typecheck` de fuente limpio; suite de tests verde (183, incluye `getEditableFields`). Las rutas del build confirman `/transactions/[txId]/edit` y la desaparición de `/accounts/[id]/transactions/*`.
- [x] 6.2 Verificación en navegador (por el usuario): app levantada, todo OK. alta desde `/transactions` y pre-seleccionando cuenta/tarjeta (`?account=`); saldo por moneda en el selector; edición de cada tipo (ingreso, gasto, transfer, ajuste, cambio, consumo pending/paid, madre con/sin cuota paga) con los campos correctos bloqueados; retorno correcto vía `?from=`; sin enlaces rotos a rutas scoped; recurrencia/review/cuotas intactos.

## 7. Archive (último commit de la rama, antes del merge `--ff-only`)

- [ ] 7.1 Aplicar los deltas (`ADDED`/`MODIFIED`) al master `openspec/specs/transactions/spec.md` (sin secciones delta), mover el change a `openspec/changes/archive/YYYY-MM-DD-unify-movement-form-and-collapse-routes/`, correr el merge-gate (grep vía Bash, no `pnpm openspec:check` en Windows). CLAUDE.md no requiere cambios (no es módulo nuevo).
