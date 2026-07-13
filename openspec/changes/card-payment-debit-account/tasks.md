## 1. Default por banco (pay flow)

- [x] 1.1 `pay/page.tsx`: calcular `defaultPaymentAccountId` = primera cuenta cash/bank activa con ARS cuya `institution.id === cardDetail.institution?.id`; fallback a `paymentAccounts[0]?.id`. Pasarlo como prop.
- [x] 1.2 `pay-card-period-form.tsx`: recibir `defaultPaymentAccountId` y usarlo como estado inicial de `paymentAccountId` (fallback a `paymentAccounts[0]?.id`).

## 2. EditableFields.account (money-logic)

- [x] 2.1 `packages/money-logic/src/movements.ts`: agregar `account?: boolean` a `EditableFields`; en `getEditableFields`, `true` solo para el pago de resumen (`isCardPayment`), ausente/false en el resto.
- [x] 2.2 Tests de `getEditableFields` para la nueva columna `account` (true en statement payment, false/ausente en el resto).

## 3. Mutación (validation + thin-mutation)

- [x] 3.1 `packages/validation`: `updateTransactionSchema` acepta `account_id` uuid opcional.
- [x] 3.2 `packages/transactions-mutations` `updateTransaction`: cuando llega `account_id`, aplicar el cambio SOLO si la transacción existente tiene `card_period_id IS NULL`; validar que la cuenta nueva tenga la moneda de la transacción activa y no sea de crédito; incluir `account_id` en el UPDATE. Rechazos con `formError` claro.
- [x] 3.3 Tests del thin-mutation: cambia la cuenta de un pago (card_period_id null) OK; rechaza en consumo (card_period_id no null); rechaza cuenta sin la moneda / de crédito.

## 4. Hook submitEdit (movement-form)

- [x] 4.1 `packages/movement-form/src/use-movement-form.ts`: en la rama `updateTransaction` de `submitEdit`, enviar `account_id: accountId` cuando `editable?.account` y el account cambió respecto de `edit.accountId`.

## 5. UI web (movement-form)

- [x] 5.1 `apps/web/.../movement-form.tsx`: cuando `isEdit && editable?.account`, excluir la cuenta de `contextRows` y renderizar un picker de cuentas de débito (reusar `renderAccountPicker`, lista = cash/bank con la moneda del pago activa) con `setAccountId`.

## 6. Verificación

- [x] 6.1 `pnpm typecheck` (web + mobile) y lint verdes.
- [x] 6.2 Tests de paquetes tocados verdes.
- [ ] 6.3 QA manual: al pagar un resumen, la cuenta por defecto es la del banco de la tarjeta; editar un pago y cambiar la cuenta recalcula saldos y deja el período pagado; un consumo de tarjeta no ofrece cambiar la cuenta.
- [x] 6.4 Confirmar que no hace falta migración.
