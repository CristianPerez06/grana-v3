## 1. Schema (migración online)

- [x] 1.1 Escribir migración en `supabase/migrations/`: `ALTER TYPE transaction_type ADD VALUE 'exchange'` + columnas `destination_amount NUMERIC(18,2)` y `destination_currency TEXT`. → `0014_transactions_exchange.sql`.
- [x] 1.2 CHECK constraints: exchange ⟹ destino + `destination_*` NOT NULL, `destination_amount>0`, `currency_code<>destination_currency`; `destination_*` NULL salvo exchange; `chk_non_transfer_no_destination` ampliado a transfer+exchange. (`chk_transfer_different_accounts` ya exime no-transfers → intra-cuenta pasa sin cambio.)
- [x] 1.3 Migración aplicada online por el usuario (summary todo `true`). Types: la CLI no está en este entorno → `packages/supabase/src/types.ts` **parcheado a mano** (columnas `destination_amount`/`destination_currency` en Row/Insert/Update + `exchange` en el enum union y el array de constantes). PENDIENTE menor: regenerar canónico con `supabase gen types` cuando esté la CLis (agrega el Relationship FK de `destination_currency`; diff inocuo).

## 2. Lógica pura de saldos

- [x] 2.1 `@grana/money-logic` (`balance.ts`): `BalanceTransactionRow` + `destination_amount`/`destination_currency` y rama `exchange` en `calculateTransactionSums` (resta origen en `currency_code`, suma destino en `destination_currency`, maneja misma cuenta). Wrapper web (`lib/transactions/balance.ts`) selecciona las columnas nuevas. (Exchange no es income/expense → no cuenta como gasto/ingreso.)
- [x] 2.2 Tests del cálculo (`__tests__/balance.test.ts`): exchange entre cuentas, intra-cuenta, decimal-safe. 6/6 OK.

## 3. Validación y server action

- [x] 3.1 `@grana/validation`: `createExchangeSchema` (monedas distintas obligatorio, sin test de "misma cuenta" → intra-cuenta permitido) + `updateExchangeSchema`; exportados desde el index.
- [x] 3.2 Server actions `createExchange`/`updateExchange`/`deleteExchange` en `app/_actions/transactions.ts` (verifican moneda activa en ambas patas, revalidan ambas cuentas + `/transactions`).

## 4. UI

- [x] 4.1 Pestaña "Cambio" en `movement-form.tsx`: cuenta+monto+moneda origen + cuenta destino (incl. misma cuenta) + monto recibido; moneda destino **derivada** (la opuesta que tenga la cuenta destino); cuentas `cash`/`bank`; sin recurrencia.
- [x] 4.2 Aviso de saldo negativo (Fase 1) en la pata de origen del exchange.
- [x] 4.3 `FinancialMovement` kind `exchange` + listado global (ícono `Coins`, subtítulo con monto recibido) + detalle global (cuentas, monto recibido, cotización derivada).
- [x] 4.4 Filtro por tipo "Cambio" (`MOVEMENT_TYPE_KEYS` + `movement_kinds.exchange`).
- [x] 4.5 Editor dedicado `EditExchangeForm` (montos editables, cuentas/monedas read-only, aviso de saldo negativo) + eliminación (`deleteExchange` en `TransactionActions`). La ruta de edición ramifica por tipo.
- [x] 4.6 i18n: `types.exchange`, `labels.exchange_received`, `movement_kinds.exchange` (es+en).
- [x] 4.7 (QA) Signos correctos: la pata origen se muestra **negativa** (sale plata) y la recibida **positiva** (`sign: '-'` en el movimiento; listado/detalle muestran ambas patas). Antes ambas salían positivas.
- [x] 4.8 (QA) Exchange en la **vista de cuenta**: `getRowMeta` (lista) ya no cae en el fallback de "Ajuste" — muestra "Cambio" con el signo/moneda correctos según la cuenta sea origen (−) o destino (+); el detalle en-cuenta muestra cuenta origen/destino, monto recibido y cotización.

## 5. Verificación y cierre

- [x] 5.1 `tsc --noEmit` (0) + `lint` (0 errores) + suite (134 tests).
- [x] 5.2 QA runtime: comprar USD entre cuentas e intra-cuenta, vender USD, tarjeta no elegible, aviso de saldo negativo, signos correctos, vista de cuenta, editar/eliminar. Probado por el usuario: todo OK.
- [x] 5.3 Archivar el change y aplicar el delta al master spec `openspec/specs/transactions/spec.md`.
