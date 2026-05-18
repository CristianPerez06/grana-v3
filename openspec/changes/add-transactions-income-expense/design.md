## Context

Con el módulo `accounts` completo, el saldo de cada cuenta muestra solo `initial_balance` — un valor estático que no cambia con la actividad del usuario. Este change introduce la tabla `transactions` con soporte para ingresos y gastos, y reemplaza el placeholder de saldo derivado por la fórmula real: `initial_balance + Σ transacciones`.

Estado actual de v3 al entrar este change:
- `accounts` y `account_currencies` existen con RLS y trigger de Efectivo.
- `computeBalance` en `utils.ts` retorna `initial_balance` como saldo — placeholder documentado.
- `categories` y `subcategories` existen con sus RLS; disponibles para categorizar gastos.
- No existe `transactions` ni nada referente a movimientos.

Referencia v2: `D:/src/grana-v2/src/modules/transactions/` y `D:/src/grana-v2/docs/specs/transacciones/SPEC-TRANSACCIONES.md` — implementación madura con 77 tests aprobados. Este change es un slice de esa spec: solo `income` y `expense`.

## Goals / Non-Goals

**Goals:**

- Cerrar el modelo de datos de `transactions` para ingresos y gastos, de forma que los types futuros (`transfer`, `adjustment`) entren con un `ALTER TYPE ADD VALUE`.
- Que el saldo derivado sea correcto e inmediatamente consistente: insertar o borrar una transacción actualiza el balance visible sin cache ni columna derivada.
- Enforced en DB: `amount > 0`, FK a `accounts`, `categories` y `currencies`; RLS por `user_id`; índices para queries de saldo y lista paginada.
- Patrón de validación cross-platform en `@grana/validation`.

**Non-Goals:**

- Transferencias entre cuentas (`type='transfer'`) — `add-transactions-transfer`.
- Ajustes de saldo (`type='adjustment'`) — `add-transactions-adjustment`.
- Recurrencias — `add-recurrences`.
- Cuotas (`is_parent`, `parent_id`, `installments`) — `add-accounts-credit-cards`.
- Pago de resumen de tarjeta.
- Autocategorizador por historial o keywords.
- Filtros avanzados, búsqueda full-text, exportación.
- Soft delete: no hay restricciones referenciales en este slice, hard delete es suficiente.

## Decisions

### §1 · `transaction_type` enum extensible, no string libre

`CREATE TYPE transaction_type AS ENUM ('income', 'expense')`. Mismo patrón que `account_type`: se empieza con los dos valores del slice y se extiende con `ALTER TYPE ADD VALUE 'transfer'` cuando ese módulo aterrice.

**Alternativa rechazada:** `TEXT CHECK (type IN (...))` — el enum es más estricto y documentado. Ya está validado en accounts.

### §2 · `amount` siempre positivo; el signo lo da el tipo

`amount NUMERIC(18,2) NOT NULL CHECK (amount > 0)`. La dirección del movimiento la determina `type`: income suma al saldo, expense resta. Esto evita el foot-gun de amounts negativos en expenses y simplifica las queries de saldo.

`balance(account, currency) = initial_balance + SUM(amount) FILTER (WHERE type='income') - SUM(amount) FILTER (WHERE type='expense')`

Equivalente: `initial_balance + SUM(CASE WHEN type='income' THEN amount ELSE -amount END)`.

**Alternativa rechazada:** `amount` con signo (positivo para income, negativo para expense). Requiere que el frontend siempre recuerde negar el monto al crear un gasto — error frecuente en v2 early builds.

### §3 · Balance derivado se calcula en el servidor, no se cachea

No hay columna `balance` en ninguna tabla. La query de saldo hace un `SUM` sobre `transactions` filtrado por `(account_id, currency_code)`. Esta es la regla invariante del sistema (documentada en `CLAUDE.md`).

**Implementación concreta en v1:**

- `getAccountDetail(id)` incluye el balance calculado vía una segunda query agrupada por `(account_id, currency_code)` y se combina en el server component.
- `getAccounts()` (lista) hace la misma segunda query para todas las cuentas del usuario en una sola round-trip (`WHERE account_id = ANY(...)`) para evitar N+1.
- `computeBalance(account, txSums)` en `utils.ts` reemplaza al placeholder: recibe el map de sumas pre-calculadas y las suma al `initial_balance`.

**Alternativa rechazada:** Supabase RPC / Postgres function para calcular balance — agrega una capa de indirección sin ganancia real a este volumen de datos.

### §4 · `currency_code` en transactions debe coincidir con una `account_currencies` activa

La validación no se puede hacer con un CHECK constraint de DB fácilmente (requeriría una función o trigger). Se enforce en la server action: antes de insertar, verifica que exista una fila `account_currencies` con `account_id = ?`, `currency_code = ?`, `is_active = true`. Si no existe, la action retorna un error.

La FK `transactions.currency_code REFERENCES currencies(code)` garantiza que la moneda es válida en el sistema, pero no que está habilitada en la cuenta.

### §5 · `category_id` requerido para gastos, opcional para ingresos

Consistente con v2 y con la lógica del producto: los gastos necesitan categoría para el análisis; los ingresos son menos frecuentes y en muchos casos no se categorizan (sueldo, venta ocasional). Validado en el schema Yup con `.when('type', ...)`.

`subcategory_id` es siempre opcional — la subcategoría es un refinamiento, no un requerimiento.

### §6 · `date` como `DATE`, no `TIMESTAMPTZ`

El hecho financiero de una transacción es un día, no un instante. `DATE` evita el problema de timezone (un pago a las 23:50 AR = 02:50 UTC del día siguiente) y simplifica queries de rango.

El default en el formulario usa `getTodayAR()` para obtener la fecha del día en `America/Argentina/Buenos_Aires`.

### §7 · Hard delete sin soft delete en v1

En este slice no hay restricciones referenciales sobre `transactions` (no hay `shared_expenses`, `period_payments`, etc.). Un `DELETE` directo es la operación correcta.

Cuando `add-accounts-credit-cards` aterrice, las cuotas hijas de tarjeta no deben poder eliminarse directamente si el período fue pagado — esa restricción se agrega en ese change, no acá.

### §8 · La UI vive dentro del contexto de cuenta, no en una ruta global `/transactions`

`/accounts/[id]/transactions/new` en lugar de `/transactions/new?accountId=...`. Razones:
- El usuario siempre llega desde el detalle de la cuenta.
- La pantalla de detalle de cuenta muestra la lista de movimientos de esa cuenta — la navegación es natural.
- Una ruta global `/transactions` con selector de cuenta es el módulo Dashboard/lista global, fuera de scope de este change.

### §9 · `description` opcional, sin normalización en v1

`description TEXT` nullable. No se implementa el autocategorizador por keywords en este slice. Si el usuario no escribe descripción, la transacción queda sin ella. El historial de descripciones se puede usar en `add-recurrences` para el autocomplete.

## Risks / Trade-offs

**[Trade-off] Dos round-trips para la lista de cuentas con saldo real.**
`getAccounts()` hace: (1) SELECT accounts+currencies+institutions, (2) SELECT sumas de transactions agrupadas. Para el volumen esperado (<20 cuentas, <500 transacciones por usuario inicial) esto es aceptable. Si escala, se optimiza con una Postgres function o vista materializada.

**[Riesgo] `currency_code` en la transacción puede quedar desincronizado si se desactiva una moneda en la cuenta después de crear transacciones.**
Mitigación: `deactivateCurrencyFromAccount` ya bloquea si hay `initial_balance ≠ 0`. Cuando entre `transactions`, debe también chequear `SUM(transactions) ≠ 0`. Este check se agrega en este change: la action `deactivateCurrencyFromAccount` se actualiza para incluir el SUM real.

**[Riesgo] Borrar una transacción no tiene undo.**
Mitigación: Alert dialog de confirmación en la UI. Sin soft delete intencional en v1 — la complejidad de papelera no justifica el esfuerzo ahora.

**[Trade-off] `is_verified` incluido en el schema desde el inicio aunque la UI de v1 no lo muestra.**
El campo `is_verified` (para conciliación bancaria) vive en v2 y es útil en v3 cuando el módulo de importación de extractos llegue. Se agrega al schema pero no se expone en la UI de v1 (default `false`).
