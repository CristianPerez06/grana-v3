## Why

El alta mobile (`/transactions/new`) es hoy **create-parcial**: ofrece Gasto / Ingreso / Transferencia (con la familia credit completa: consumo, cuotas, reintegro y split), pero le faltan las dos tabs restantes del form unificado — **Ajuste** de saldo y **Cambio** de moneda — y el toggle **Repetir** (recurrencia) que web ofrece sobre gasto/ingreso/transferencia. Es el último hueco para cerrar la paridad de *creación* antes de encarar detalle/edición (change C).

Lo importante: **el hook `useMovementForm` ya soporta las tres cosas end-to-end**. `submitCreate` ya rutea `tab === 'adjustment'` → `createAdjustment`, `tab === 'exchange'` → `createExchange`, y dispara `createRecurrenceFromMovement` cuando `isRecurrent`. Todo el estado (`adjustmentDirection`, `destinationAmount`, `exchangeDestCurrency`, `isRecurrent`, `frequency`, `intervalCount`, `intervalUnit`, `recurrenceEndDate`) ya lo expone el hook y los mutators nativos ya están bindeados. Este change es **puro pintado**: sólo falta la UI mobile.

## What Changes

- **Tabs Ajuste y Cambio**: se agregan `'adjustment'` y `'exchange'` a `TABS` en `MovementForm.tsx` (labels ya en i18n vía `transactions.types.*`).
- **Ajuste**: toggle de dirección Suma/Resta (`Segmented`, 2 opciones cortas), banner informativo, preview "Saldo quedará" (`current → next` con `Money.add/subtract`), y la descripción re-etiquetada como "Motivo del ajuste". Sin categoría (ya oculta fuera de gasto/ingreso).
- **Cambio**: picker de cuenta destino (reusa `AccountSelectField` sobre `form.cashBankAccounts`), card de **monto recibido** (segundo `MoneyAmountInput`, moneda destino derivada `exchangeDestCurrency`), hint de tasa implícita, y el hint "esa cuenta no tiene otra moneda" cuando el destino no la habilita (el hook ya bloquea el submit en ese caso).
- **Recurrencia**: card "Repetir" (`Switch` + chips de frecuencia semanal/quincenal/mensual/anual/personalizado, interval custom con `count` + chip-row de unidad día/semana/mes/año, y `DateField` de "repetir hasta" opcional), gateada por el hook a gasto-no-cuotas / ingreso / transferencia.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement **"La app nativa expone la pantalla de alta de movimiento `/transactions/new`"** se amplía de create-parcial a create-completo — la pantalla SHALL ofrecer las **cinco** tabs (agrega Ajuste y Cambio) y el toggle de **recurrencia**, con paridad web; sólo queda fuera la edición (change C).

## Impact

- **Packages**: sin cambios. No toca `@grana/*`, ni el hook, ni los mutators — el submit de ajuste/cambio/recurrencia ya está implementado en `useMovementForm`. Sólo presentación mobile.
- **Web**: sin cambios.
- **Mobile**: `apps/mobile/components/transactions/MovementForm.tsx` (único archivo tocado — pinta las tres piezas nuevas y expande `TABS`). Sin deps nuevas, sin rutas nuevas.
- **i18n**: **cero keys nuevas** — todas las que se usan (`tabs/types.adjustment|exchange`, `directions.*`, `drawer.adjust_*`, `drawer.balance_will_be`, `labels.exchange_received`, `exchange.no_other_currency_hint`, `labels.make_recurrent`, `drawer.repeat_*`, `frequencies.*`, `recurrences.custom_interval.*`) ya existen en `@grana/i18n-messages` (web las renderiza) y el catálogo mobile las carga entero.
- **Sin cambios de datos/API/RLS**.
- **Dependencias entre changes**: requiere `mobile-movement-form-credit` y `mobile-select-field` (ambos mergeados). Independiente del change C.

### Fuera de scope

- **Edición** de movimientos (`/transactions/[txId]` + edit) → change C.
- **Calculadora en money-fields** (web-only por ahora, `evaluateMoneyExpression` en `@grana/validation`) → gap de paridad separado.
- **Swap de cuentas** en transferencia (botón de intercambio web) → gap pre-existente de la tab Transferencia, no se agrega acá.
