## Context

El módulo `transactions` (v3) ya soporta ingresos y gastos. Quedan dos casos del slice básico de v2: **transferencias** entre cuentas propias del usuario y **ajustes** para reconciliar saldos. Sin estos dos casos, el usuario no puede modelar movimientos comunes (sacar plata del banco al efectivo) ni corregir desviaciones entre lo registrado y la realidad.

Referencia v2: `D:/src/grana-v2/docs/schema.sql` líneas 118–170 (modelo de `transactions`). Este change importa el patrón exacto de v2 para transferencias (una sola fila con `transfer_destination_account_id`) y para ajustes (`amount` con signo). El patrón v2 está probado en producción.

Estado actual al entrar este change:

- Migration `0008_transactions.sql` crea `transactions(... type, amount, ...)` con `chk_amount_positive` y enum `transaction_type AS ENUM ('income', 'expense')`.
- `getTransactionSums(accountIds)` en `apps/web/lib/transactions/balance.ts` calcula net por (cuenta, moneda) con solo income/expense.
- `getTransactions(accountId)` filtra por `account_id = accountId` — no contempla transferencias entrantes.
- Form de nueva transacción tiene 2 tabs (Ingreso, Gasto).
- `_actions/transactions.ts` expone `createIncome`, `createExpense`, `updateTransaction`, `deleteTransaction`.

## Goals / Non-Goals

**Goals:**

- Modelar transferencias como una operación atómica de una sola fila (no dos filas linkeadas).
- Modelar ajustes con `amount` con signo, sin agregar columnas extras de dirección.
- Mantener el balance derivado en el servidor sin cache; la fórmula se extiende de 2 a 4 ramas en `getTransactionSums`.
- Reusar el patrón validado en v2: `transfer_destination_account_id` para transferencias, `chk_amount_positive_non_adjustment` para ajustes.
- UI con 4 tabs en el form (Ingreso, Gasto, Transferencia, Ajuste) y diferenciación visual clara en la lista de movimientos.

**Non-Goals:**

- Transferencias con conversión de moneda (FX) — el modelo bimoneda exige misma moneda en origen y destino.
- Pago de resumen de tarjeta de crédito — requiere `account.type='credit'` que entra en `add-accounts-credit-cards`.
- Soft delete — sigue siendo hard delete en este slice (sin restricciones referenciales todavía).
- Reverso/undo automático — el alert dialog de confirmación es suficiente en v1.
- Auditoría histórica de ajustes (motivos, evidencia) — el campo `description` alcanza por ahora.

## Decisions

### §1 · Transferencia = una sola fila con `transfer_destination_account_id`

Una transferencia genera **una** fila en `transactions` con `type='transfer'`, `account_id=origen`, `transfer_destination_account_id=destino`. La columna `transfer_destination_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT` es nullable; solo se popula para transferencias.

**Por qué una fila y no dos linkeadas:**

- Atomicidad gratis: una sola INSERT es ya atómica. No hace falta orquestar dos filas con manejo de rollback.
- FKs simples: la cuenta destino es una FK directa, no un self-reference con `linked_transaction_id`.
- v2 lo modela así y está probado.

**Trade-off:** la query de la lista por cuenta ahora debe hacer `WHERE account_id = X OR transfer_destination_account_id = X` para que transferencias entrantes aparezcan en la lista del destino. Eso lo cubre el índice parcial `idx_transactions_destination` sobre `transfer_destination_account_id WHERE NOT NULL`.

**Alternativa rechazada:** Dos filas linkeadas via `linked_transaction_id`. Más complejo, duplica datos, requiere mantener consistencia entre las dos filas al editar el monto/fecha.

### §2 · Ajuste = `amount` con signo

Un ajuste es una fila con `type='adjustment'` donde `amount` puede ser **positivo** (suma al saldo) o **negativo** (resta). La constraint `chk_amount_positive` se reemplaza por `chk_amount_positive_non_adjustment` (`type = 'adjustment' OR amount > 0`).

**Por qué amount con signo y no una columna de dirección extra:**

- Es la convención de v2 (línea 6 de v2 `schema.sql`: "adjustment.amount con signo. Positivo = suma al saldo. Negativo = resta.").
- Una columna `adjustment_direction` agregaría redundancia: `amount * sign(direction) = effective_amount`.
- La fórmula del balance simplifica: ajuste = `SUM(amount)` directamente.

**Trade-off:** Mezclamos convenciones de signo dentro de la misma columna (positivo siempre para income/expense/transfer, signed para adjustment). Esto se atenúa con la constraint que enforza la regla en DB.

**Alternativa rechazada:** `adjustment_direction enum('increase','decrease')` + `amount` siempre positivo. Misma información, más columnas, más constraints.

### §3 · `currency_code` debe estar activa en **ambas** cuentas

Una transferencia ARS solo es válida si ambas cuentas tienen `account_currencies` activa con `currency_code='ARS'`. Se valida en la server action antes de insertar — no en DB, igual que se hace con el caso de income/expense.

**Por qué no se enforce en DB:** Requiere un trigger o función custom, que agrega complejidad sin valor inmediato. La validación en la action cubre el caso normal; un usuario que toque la DB directamente con un client autenticado no puede saltarse RLS pero podría saltearse esta regla — riesgo aceptable.

### §4 · Misma moneda obligatoria; sin FX

Una transferencia no convierte monedas. `currency_code` es uno solo, aplicado simétricamente a la salida y a la entrada. ARS → ARS o USD → USD, nunca ARS → USD.

**Por qué:** El modelo bimoneda de Grana define ARS y USD como ledgers separados; convertir automáticamente erosiona la trazabilidad. Si el usuario compra USD con ARS, eso es **dos** operaciones: un gasto en ARS y un ingreso en USD (o dos transacciones manuales por ahora).

**Futuro:** Cuando se agregue el módulo de operaciones FX, una "compra de USD" será modelada explícitamente con tipo de cambio registrado, no como un transfer ARS→USD.

### §5 · La fórmula del balance se extiende a 4 ramas

`getTransactionSums(accountIds)` ahora calcula, para cada cuenta `X` y moneda `C`:

```
balance_delta_X_C = 
    SUM(amount) WHERE type='income'     AND account_id=X                      AND currency_code=C
  − SUM(amount) WHERE type='expense'    AND account_id=X                      AND currency_code=C
  − SUM(amount) WHERE type='transfer'   AND account_id=X                      AND currency_code=C   -- saliente
  + SUM(amount) WHERE type='transfer'   AND transfer_destination_account_id=X AND currency_code=C   -- entrante
  + SUM(amount) WHERE type='adjustment' AND account_id=X                      AND currency_code=C   -- signed
```

La implementación carga todas las filas relevantes (mediante OR sobre `account_id` y `transfer_destination_account_id`) y agrupa en memoria — sigue siendo lineal y simple. El índice parcial `idx_transactions_destination` mantiene la query eficiente.

### §6 · `getTransactions(accountId)` retorna filas donde la cuenta es origen O destino

La lista de movimientos del detalle de cuenta debe mostrar transferencias en **ambos** sentidos. La query es:

```sql
SELECT * FROM transactions
WHERE account_id = $accountId
   OR transfer_destination_account_id = $accountId
ORDER BY date DESC, created_at DESC
```

En el render, el componente determina si la fila se ve como entrada o salida basándose en qué columna matchea el `accountId` actual. La UI muestra la cuenta contraparte siempre.

### §7 · `account_id` y `transfer_destination_account_id` son inmutables post-creación

Mover una transferencia a otra cuenta es semánticamente "borrar y crear de nuevo", no edición. Lo mismo con cambiar la moneda. La action `updateTransfer` rechaza estos campos vía el schema. Mutables: `amount`, `date`, `description`.

Mismo principio aplica a ajustes: `account_id` y `currency_code` son inmutables; mutables son `amount` (con signo), `date`, `description`.

### §8 · UI: 4 tabs en `transaction-form`

El form de "Nuevo movimiento" suma 2 tabs: **Transferencia** y **Ajuste**. Cada tab tiene su propio set de campos:

- **Transferencia**: cuenta destino (combobox de cuentas activas distintas a la actual), moneda (auto si ambas tienen una sola en común; selector si comparten varias), monto positivo, fecha, descripción opcional.
- **Ajuste**: moneda (selector si la cuenta tiene varias activas), dirección (radio: Suma / Resta) que internamente convierte a signo, monto positivo en el input, fecha, descripción opcional. Internamente al action se envía `amount * sign`.

**Por qué dirección como UI radio en vez de input con signo:** Más usable que escribir un número negativo. El input expone `monto` siempre positivo + un radio claro. La action recibe el `amount` ya con signo (calculado en el cliente).

### §9 · Lista de movimientos: diferenciación visual

- **Ingreso**: signo `+`, color verde, ícono opcional categoría.
- **Gasto**: signo `−`, color neutro, ícono opcional categoría.
- **Transferencia saliente** (`account_id = currentAccount`): signo `−`, ícono de flecha izquierda, texto secundario "→ {nombre cuenta destino}".
- **Transferencia entrante** (`transfer_destination_account_id = currentAccount`): signo `+`, ícono de flecha derecha, texto secundario "← {nombre cuenta origen}".
- **Ajuste positivo**: signo `+`, color verde tenue, ícono de ajuste, texto "Ajuste".
- **Ajuste negativo**: signo `−`, color neutro, ícono de ajuste, texto "Ajuste".

## Risks / Trade-offs

**[Trade-off] La query de la lista hace un OR sobre dos columnas.**
`WHERE account_id = X OR transfer_destination_account_id = X` no es tan eficiente como un equality match, pero el índice parcial `idx_transactions_destination` mantiene la query rápida para el caso de transferencia entrante. Para el volumen esperado (< 500 transacciones por usuario inicial) esto es aceptable.

**[Riesgo] Las constraints sobre `transfer_destination_account_id` deben ser bidireccionales.**
Hay que verificar tres cosas en DB: (a) si `type='transfer'`, hay destino; (b) si hay destino, `type='transfer'`; (c) destino ≠ origen. Sin (b), un usuario malicioso podría setear destino en un income, pero eso sería ignorado por la lógica de balance. Las tres constraints están en la migración.

**[Riesgo] Adjustments con amount negativo pueden romper código que asume `amount > 0`.**
El código v3 actual (en `getTransactionSums` y en la fórmula de balance) asume amount positivo y aplica signo según `type`. Para ajustes, el código nuevo debe sumar `amount` directamente (con su signo). Es un caso especial, hay que cubrirlo con cuidado en la fórmula.

**[Trade-off] La validación de "moneda activa en ambas cuentas" vive en la action, no en DB.**
Un cliente Supabase autenticado podría insertar una transferencia entre dos cuentas donde la moneda no está activa en una de ellas. RLS bloquea cross-user, pero no esta regla específica. Mitigación: la action `createTransfer` lo verifica; si en el futuro hace falta enforce duro, se agrega un trigger.

**[Trade-off] Editar una transferencia no permite cambiar las cuentas ni la moneda.**
Si el usuario eligió la cuenta equivocada, debe borrar y crear de nuevo. Esto es deliberado para evitar inconsistencias y se documenta en `transactions.readonly` i18n.

**[Riesgo] Borrar una transferencia o ajuste no tiene undo.**
Mitigación: alert dialog de confirmación como con income/expense. Sin soft delete intencional en v1.

## Migration Plan

1. Aplicar `supabase/migrations/0009_transactions_transfer_adjustment.sql` en el SQL Editor.
2. Regenerar tipos: `./node_modules/.bin/supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa > packages/supabase/src/types.ts`.
3. Verificar que `transfer_destination_account_id` aparece en `transactions` y que `transaction_type` enum incluye los 4 valores.
4. Deploy del código que usa las nuevas columnas (no es backward-compatible: la nueva fórmula de balance necesita la columna nueva, pero las filas viejas no la tienen seteada — por eso es nullable y solo se usa cuando `type='transfer'`).
5. Sin necesidad de backfill: todas las transacciones existentes son income/expense y la columna nueva queda NULL automáticamente.

**Rollback:** Si surge un bug crítico, se puede revertir el código sin necesidad de revertir la migración (la columna nueva queda NULL, las constraints solo se activan en filas con `type='transfer'` o `type='adjustment'`). Para revertir la migración: `ALTER TABLE transactions DROP COLUMN transfer_destination_account_id; ALTER TABLE transactions DROP CONSTRAINT chk_amount_positive_non_adjustment; ALTER TABLE transactions ADD CONSTRAINT chk_amount_positive CHECK (amount > 0);` — esto último solo es seguro si no hay ajustes con amount ≤ 0, así que en producción se borra primero esas filas.
