# Proposal: exclude-future-dated-from-balance

## Why

Una transacción fechada en el futuro (un gasto común cargado con fecha posterior a hoy, o el movimiento semilla que crea el toggle "Recurrente" del form) impacta el Disponible y el saldo de la cuenta **hoy**, porque ningún read de saldo — ni el RPC `get_account_balance_sums` ni sus espejos TS — recorta por fecha. El defecto quedó visible tras `fix(balance)` (0051): antes el truncado silencioso de PostgREST enmascaraba filas recientes. Además, el modelo mental del usuario para recurrencias ("nada es real hasta que lo apruebo") se rompe cuando el form crea la semilla como transacción real con fecha futura.

## What Changes

- **Corte temporal en el saldo**: el saldo derivado de cada `(cuenta, moneda)` — y por composición el Hero/Disponible, "Dónde está", listado y detalle de cuentas — pasa a sumar solo transacciones con `date <= hoy` (fecha financiera AR, `America/Argentina/Buenos_Aires`). Una transacción futura existe, se ve en listados, pero entra al saldo recién cuando su fecha llega.
- **Migración `0052`**: `create or replace` de `get_account_balance_sums` agregando el predicado de fecha con timezone AR explícito; self-check incluido.
- **Espejos TS**: `calculateTransactionSums` (fuente de verdad de reglas de signo + test de paridad SQL↔TS) recibe `todayISO` inyectado y aplica el mismo corte; el test de paridad incorpora filas future-dated. `computeRunningBalances` NO cambia: el saldo corriente por fila es una proyección cronológica y las filas futuras muestran su saldo proyectado.
- **Form tweak (recurrente + fecha futura)**: si el usuario activa "Recurrente" con `date > hoy`, el form NO crea el movimiento semilla; crea la regla por el camino de creación directa (`created_from_transaction_id = NULL`, `last_generated_date = NULL`, `start_date =` la fecha elegida), de modo que la primera instancia pendiente cae en esa fecha y pasa por el gate de aprobación existente. Con `date <= hoy` el flujo actual (semilla + regla) no cambia.
- Sin cambios en las lentes de período (`summarizePeriod`, `buildMonthBalanceSeries`): siguen operando sobre la ventana del mes.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `accounts`: el requirement "El sistema computa el saldo de cada cuenta en cada moneda derivado de las transacciones" incorpora el corte `date <= hoy(AR)` en cada sumatoria.
- `transactions`: (1) "El saldo de la cuenta refleja las transacciones en tiempo real" incorpora el corte temporal; (2) "El usuario puede registrar un gasto" califica el "impacta saldo inmediatamente" con el corte; (3) "El usuario puede crear una regla recurrente al registrar un movimiento" agrega la rama fecha-futura sin semilla.
- `web-data-access`: el requirement "Los reads que alimentan un saldo o un agregado monetario son completos por construcción" suma el corte temporal al contrato RPC↔TS y al test de paridad (hoy AR inyectado en TS, timezone explícito en SQL).

## Impact

- `supabase/migrations/0052_balance_temporal_cut.sql` (nueva).
- `packages/money-logic/src/balance.ts` (`BalanceTransactionRow` gana `date`; `calculateTransactionSums` gana parámetro `todayISO`).
- `packages/movement-form/src/use-movement-form.ts` + mutators (`createRecurrenceFromMovement` vs creación directa) — capa compartida, mobile la hereda cuando consuma el form.
- Tests: paridad SQL↔TS (`apps/web/lib/accounts/__tests__/balance-sums-migration.test.ts`), `packages/dashboard/__tests__/balance-read-path.test.ts`, tests del hook del form.
- UX: el saldo "salta" solo el día en que una transacción futura entra en vigencia; el detalle de cuenta puede mostrar saldo de header ≠ saldo corriente de la fila superior cuando hay filas futuras (proyección) — documentado en design.
