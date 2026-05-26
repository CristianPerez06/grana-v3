## Context

La transferencia de v3 es mono-moneda: `transactions` tiene `transfer_destination_account_id` pero un solo `amount` + `currency_code`, y `calculateTransactionSums` (en `@grana/money-logic`) resta/suma el mismo monto y moneda en las dos patas. El enum `transaction_type` es `('income','expense','transfer','adjustment')` (se extiende con `ALTER TYPE ... ADD VALUE`). Fase 1 ya dejó el formulario unificado `movement-form.tsx` (tipo arriba → cuenta → campos) y el aviso no bloqueante de saldo negativo (`checkNegativeBalance` + `NegativeBalanceNotice`).

grana-v2 resolvió la compra de dólares con `transfer` + `destination_amount` + `destination_currency` (rate derivado). En v3 elegimos un camino más nítido (ver D1).

## Goals / Non-Goals

**Goals:**
- Registrar compra/venta de moneda de forma honesta (dos montos reales, rate derivado), sin ensuciar gasto/ingreso.
- Soportar intra-cuenta y entre cuentas con un modelo uniforme.
- Reusar la infra de Fase 1 (form unificado, aviso de saldo negativo, motor de saldos).

**Non-Goals:**
- Traer cotizaciones de mercado / API de dólar (el usuario ingresa los montos).
- Tarjetas de crédito como pata de un exchange (off-ledger).
- Recurrencia de exchanges.
- Mobile.

## Decisions

### D1 — Tipo nuevo `exchange` (no reusar `transfer`)
Un `exchange` es un tipo propio, no un `transfer` con campos opcionales. Razones (v3-specific):
- **Invariantes nítidos**: `exchange ⟺ dos monedas, dos montos, monedas distintas`; `transfer` queda mono-moneda e **intacto** (cero regresión al path testeado).
- **Modelo de contador**: una operación de cambio es su propia línea en el libro, distinta de una transferencia.
- **Costo extra chico**: las columnas del segundo monto/moneda hacen falta igual; lo único exclusivo es un valor más en el enum.
- Encaja en el `FinancialMovement` (union) como un `kind` nuevo, legible como "Cambio".

### D2 — Dos patas; monedas distintas; cuentas iguales o distintas
- Origen: `account_id` + `amount` + `currency_code`. Destino: `transfer_destination_account_id` + `destination_amount` + `destination_currency`.
- Constraint: `currency_code <> destination_currency`. La cuenta destino puede ser igual a la origen (intra-cuenta) o distinta (entre cuentas).
- Se relaja `chk_transfer_different_accounts` para que aplique solo a `transfer` (el exchange permite misma cuenta).

### D3 — El usuario ingresa los dos montos; el rate se deriva y NO se persiste
Los dos montos son los hechos reales (lo que entró/salió de las cuentas). La cotización = `amount / destination_amount` se calcula al vuelo para mostrar; no se guarda (regla "derived, never persisted"). Distinto de `fx_rate_to_ars` de tarjetas (ahí hay un solo monto y el rate sí se guarda).

### D4 — Schema
- `ALTER TYPE transaction_type ADD VALUE 'exchange'`.
- Columnas nuevas: `destination_amount NUMERIC(18,2)`, `destination_currency TEXT` (FK lógica a currencies; ARS/USD).
- Reuso de `transfer_destination_account_id` como cuenta destino del exchange (ya existe, FK + índice). Nota de naming: la columna es "transfer_*" pero sirve de cuenta destino para transfer y exchange.
- CHECK: `type='exchange'` ⟹ `transfer_destination_account_id`, `destination_amount` (>0), `destination_currency` NOT NULL y `currency_code <> destination_currency`; `amount > 0`. `type NOT IN ('transfer','exchange')` ⟹ destino y `destination_*` NULL.

### D5 — Motor de saldos (`calculateTransactionSums`)
Para `exchange`: `account[currency_code] -= amount` y `account_destino[destination_currency] += destination_amount`. Maneja el caso misma cuenta (dos buckets de moneda del mismo account). El exchange queda excluido del cálculo de "gasto/ingreso del mes".

### D6 — Aviso de saldo negativo (Fase 1) en la pata de origen
La pata de origen reduce un ledger cash/bank → reusar `checkNegativeBalance` contra `disponible[currency_code]` de la cuenta origen. Las tarjetas no son elegibles, así que no hay caso off-ledger.

### D7 — Display
- Listado: una fila `kind='exchange'`, sin signo único (como transfer), mostrando ambas patas de forma compacta (ej. `−$150.000 ARS → +US$100`) y subtítulo con las cuentas.
- Detalle: las dos patas (cuenta/monto/moneda de origen y destino) + la cotización derivada como dato informativo.

### D8 — Form, cuentas elegibles, edición
- En `movement-form.tsx`: pestaña "Cambio" → cuenta origen, monto+moneda origen, cuenta destino, monto+moneda destino. Cuentas elegibles: `cash`/`bank`.
- Sin recurrencia (como ajuste).
- Edición: montos editables (recalcula saldos de ambos ledgers); cuentas/monedas inmutables vía edición (como transfer). Eliminación: recalcula ambos ledgers.

## Risks / Trade-offs

- **[Migración de enum toca varios lugares]** → Es aditivo (nuevo valor + nuevas ramas); el `transfer` mono queda intacto.
- **[Intra-cuenta exige relajar la constraint source≠dest]** → Se acota a `exchange`; transfer sigue exigiendo cuentas distintas.
- **[Rate derivado con redondeo]** → Solo es display; los montos reales son la fuente de verdad, no se computa ningún monto a partir del rate.
- **[Una transacción toca dos ledgers de monedas distintas]** → Es la naturaleza del exchange; el motor de saldos ya indexa por cuenta+moneda, así que el cambio es acotado.

## Open Questions

- Formato exacto de la fila en el listado (¿las dos patas?, ¿cuál "primaria"?). D7 propone un default.
- ¿El alta de exchange va solo en el form global, o también en el flujo por-cuenta? (Propuesta: empezar por el global.)
- Etiqueta/i18n de "Cambio" (el repo ya está i18n-izado tras el merge de i18n; las strings nuevas deben ir a `packages/i18n-messages`).
