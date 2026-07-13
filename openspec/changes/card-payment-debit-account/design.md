## Context

Un pago de resumen (`payCardPeriod`) crea un gasto-débito desde una cuenta cash/bank, marca las transacciones del período como `paid`, e inserta `period_payments (period_id, transaction_id)`. La cuenta de débito es un puntero independiente: el monto, la moneda (ARS) y el período los fija el resumen; la cuenta no dispara ninguna cascada (a diferencia del alta de un gasto normal, donde la cuenta re-deriva moneda activa / elegibilidad tarjeta / período).

El form de edición (`MovementForm`) trata la cuenta como **contexto inmutable** en todos los tipos — una simplificación general para no reabrir esas cascadas en edición. El pago de resumen es la excepción limpia: su cuenta no tiene cascadas.

## Goals / Non-Goals

**Goals:**
- Default de cuenta de débito = misma institución que la tarjeta.
- Cuenta de débito editable en un pago de resumen ya creado.

**Non-Goals:**
- Arreglar el "Eliminar" de un pago (reversión del período) — followup.
- Hacer editable la cuenta de cualquier otro tipo de movimiento.
- Mobile UI (contratos compartidos listos; lo toma el tech lead).

## Decisions

### 1. Default por banco calculado server-side en la página de pago

`pay/page.tsx` ya tiene `cardDetail.institution` y las cuentas con su `institution`. Calcula `defaultPaymentAccountId` = primera cuenta cash/bank activa con ARS cuya `institution.id === cardDetail.institution?.id`; si no hay, `paymentAccounts[0]?.id`. Se pasa como prop y el form lo usa como estado inicial. No se toca el orden de la lista (para no confundir), solo la selección inicial.

### 2. `EditableFields.account`, true solo para el pago de resumen

Nuevo campo en `getEditableFields`. `true` únicamente cuando `isCardPayment` (gasto que paga un resumen, sin categoría). Para todo lo demás queda `false`/ausente — el invariante "cuenta inmutable" se mantiene salvo esta excepción. La cuenta de un consumo de tarjeta (que deriva el período) sigue inmutable.

### 3. Guarda de la mutación: `account_id` solo si `card_period_id IS NULL`

`updateTransaction` (thin) acepta `account_id` opcional. Defensa en profundidad además del gate de UI: solo aplica el cambio cuando la transacción existente tiene `card_period_id IS NULL` (i.e. NO es un consumo de tarjeta — el pago de resumen tiene `card_period_id` null, su vínculo es vía `period_payments`). Valida que la cuenta nueva tenga la moneda de la transacción activa y no sea de crédito. Un simple `UPDATE account_id`; el saldo es derivado, así que se recalcula solo. `period_payments` apunta a la transacción, no a la cuenta, y las cuotas siguen `paid` — nada más que tocar.

### 4. UI: picker de débito en edición reutilizando `renderAccountPicker`

En modo edición, cuando `editable?.account`, se excluye la cuenta de `contextRows` y se renderiza un picker (mismo `renderAccountPicker` del alta, con avatares) restringido a cuentas cash/bank con la moneda del pago activa. Usa el `setAccountId` del hook (sus cascadas son inocuas: la moneda no cambia porque la lista ya está filtrada a esa moneda). Aprovecha que la edición ahora recibe la lista de cuentas (fix previo `accounts=[]`).

## Risks / Trade-offs

- **[Excepción al invariante "cuenta inmutable"]** → Acotada por `EditableFields.account` (solo pago de resumen) + guarda de mutación (`card_period_id IS NULL`). No se filtra a otros tipos.
- **[Cambiar la cuenta de un pago mueve el débito histórico]** → Es el comportamiento deseado (corregir de qué cuenta salió). El saldo derivado se recalcula en ambas cuentas.
- **[El aviso de saldo negativo no se recomputa al cambiar la cuenta en edición]** → En edición el warning usa `edit.availableBalance` (la cuenta original). Menor; el cambio de cuenta de un pago rara vez deja negativo y no bloquea. Se puede refinar aparte.
- **[Default por banco con múltiples cuentas del mismo banco]** → Se elige la primera que matchea; el usuario puede cambiarla. Aceptable.
