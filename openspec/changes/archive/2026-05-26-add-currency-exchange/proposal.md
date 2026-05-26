## Why

Grana es una app bimoneda para Argentina, pero hoy **no puede registrar la operación bimoneda más común: comprar o vender dólares**. La transferencia actual es mono-moneda (un solo `currency_code`, un solo monto, misma moneda en las dos puntas). No hay forma de decir "salieron $150.000 ARS y entraron US$100". Es un hueco en el centro del dominio.

Modelar esto como un gasto + un ingreso sería **incorrecto contablemente**: inflaría las métricas de gasto/ingreso del mes con plata que ni se gastó ni entró — solo cambió de moneda. Hace falta una operación propia que diga la verdad: *no ganaste ni perdiste, cambiaste de moneda*.

No viola el principio "Bimoneda: nunca convertir automáticamente": el usuario ingresa los **dos montos reales** (hecho consumado); la cotización se **deriva** (`monto_origen / monto_destino`), no se aplica una cotización de mercado.

## What Changes

- **Nuevo tipo de movimiento `exchange`** (en pantalla: "Cambio"). 5º tipo, junto a income/expense/transfer/adjustment.
- Un exchange tiene **dos patas**: origen (cuenta + monto + moneda) y destino (cuenta + monto + moneda). Ambos montos son reales; **las monedas deben ser distintas** (ARS ≠ USD).
- **Cuenta origen y destino pueden ser la misma o distintas** — soporta cambio intra-cuenta (una billetera con ARS+USD) y entre cuentas (Galicia ARS → Caja USD).
- La **cotización se deriva y NO se persiste** (como los saldos; regla "derived balances, never persisted").
- **Impacta saldos por moneda**: resta el monto origen del ledger de la moneda origen y suma el monto destino al ledger de la moneda destino. Una transacción que toca dos ledgers de monedas distintas.
- NO es ingreso ni gasto: **no ensucia las métricas** de gasto/ingreso.
- Se crea desde el **formulario unificado de Movimientos** (Fase 1) como una pestaña/tipo más. Cuentas elegibles: `cash`/`bank` (las tarjetas de crédito no aplican — son off-ledger).
- El **aviso de saldo negativo** (Fase 1) cubre la pata de origen del exchange.
- **Sin recurrencia** (como el ajuste): un cambio de moneda es ad-hoc.

## Capabilities

### Modified Capabilities
- `transactions`: agrega el tipo `exchange` (registro, impacto en saldos por moneda, no-ingreso/no-gasto, aviso de saldo negativo en la pata de origen, edición/eliminación).

## Impact

- **Migración** (`supabase/migrations/`): `ALTER TYPE transaction_type ADD VALUE 'exchange'`; columnas nuevas `destination_amount NUMERIC(18,2)` y `destination_currency TEXT`; reuso de `transfer_destination_account_id` como cuenta destino del exchange; CHECK constraints (exchange ⟹ ambas patas presentes, monedas distintas; relajar `source ≠ dest` para permitir intra-cuenta; no-exchange ⟹ columnas destino NULL).
- **`@grana/money-logic`** (`balance.ts`): `calculateTransactionSums` debe manejar `exchange` (resta origen en `currency_code`, suma destino en `destination_currency`). Hoy asume misma moneda en las dos patas de un transfer.
- **`@grana/validation`**: schema `createExchangeSchema` (+ update).
- **Web**: server action `createExchange` (+ update/delete); pestaña "Cambio" en `movement-form.tsx`; mapeo `FinancialMovement` (kind `exchange`); render en listado y detalle global; filtro por tipo.
- **Sin cambios en mobile** (transactions aún no está en mobile). Sin tocar el regenerado `packages/supabase/src/types.ts` hasta aplicar la migración online.
