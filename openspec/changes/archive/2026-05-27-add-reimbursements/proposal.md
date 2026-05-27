## Why

Grana no tiene forma de registrar **reintegros/cashback**, y en Argentina son parte de la vida diaria: el banco devuelve un porcentaje a la cuenta, una billetera reintegra, una promo descuenta en el resumen de la tarjeta. Hoy el usuario no tiene cómo modelar "gasté $100.000 pero me devuelven $20.000", y termina cargándolo mal (como un ingreso suelto que ensucia "lo que entró", o no cargándolo).

grana-v2 tenía un cashback **a medias**: un toggle "Tiene reintegro" que creaba un ingreso espejo `pending`, pero **sin flujo de confirmación** (el ingreso quedaba pendiente para siempre o se editaba a mano) y **sin el caso "en resumen"** (reintegro que reduce la deuda de la tarjeta, no que entra a una cuenta). Este change reconstruye la funcionalidad **desde cero sobre las bases de v3**, resolviendo las dos cosas que a v2 le faltaban.

Además, hay un **conflicto ya presente** en v3: `0006_seed_categories.sql` seedea una categoría de **ingreso** llamada "Reintegros / Cashback". Eso contradice de frente el modelo de este change (el reintegro **no es ingreso** y **no tiene categoría propia**: hereda la del gasto). Si queda activa, invita a modelar el reintegro mal y rompe la analítica de neto. El change la retira.

El reintegro es un mecanismo de **control personal por declaración del usuario**: la app no valida promos ni calcula elegibilidad bancaria. Refleja cómo el usuario entiende el beneficio — **una reducción del gasto, no un ingreso independiente**.

## What Changes

**Modelo de datos (una sola entidad, dentro de `transactions`):**
- Nuevo `transaction_type = 'reimbursement'` — **tipo propio**, no `income`. Cada agregación queda obligada a decidir explícitamente qué hace con él (antídoto al bug silencioso de un ingreso disfrazado).
- Columnas nuevas en `transactions`: `linked_transaction_id` (self-FK al gasto origen), `reimbursement_target` (`'account' | 'statement'`), `received_at` (NULL = pendiente), `cancelled_at` (NULL = vigente), `estimated_amount` (inmutable, lo que el usuario esperaba).
- La **categoría se deriva** del gasto origen en lectura; el reintegro **no** guarda `category_id` propio.
- Constraints/trigger: exclusión mutua `received_at`/`cancelled_at`; el `linked_transaction_id` debe ser un `expense` del **mismo usuario**; `'statement'` sólo si el gasto origen es de tarjeta.

**Reglas contables:**
- **Pendiente no impacta nada.** En un reintegro pendiente, `amount` es el monto **estimado vigente** y no entra en ningún cálculo. Recién cuando `received_at` está seteado, `amount` es el **monto real reconciliado** y entra en saldos, resumen de tarjeta o analytics.
- **Confirmar = reconciliar:** al recibir, el usuario ajusta monto real, fecha y cuenta/período (el banco puede haber devuelto más o menos); `estimated_amount` no cambia (queda como referencia para auditar la diferencia esperado↔recibido).
- **`account` recibido** suma al saldo de la cuenta cash/bank elegida (como un ingreso real, pero no es ingreso genérico).
- **`statement` recibido** reduce el total a pagar del período de tarjeta donde **aparece** (que puede no ser el período de la compra); sigue off-ledger respecto del disponible hasta que se paga el resumen (ya reducido).
- **Neto por categoría:** bruto = gastos; reintegros = reintegros **recibidos** (misma categoría derivada); neto = bruto − recibidos; lo **esperado** se muestra aparte y tenue. Nunca cuenta como ingreso del mes.

**UX:**
- Bloque opcional "Tiene reintegro" en el alta del gasto: monto esperado (helper de % + tope, **UI-only**, no se persiste), subtipo, y estado inicial **pendiente** o **recibido ahora**.
- Subtipo visible según medio de pago: "a cuenta" siempre; "en resumen" sólo si el gasto es de tarjeta. Copy plano en novato ("El banco te deposita plata" / "Aparece descontado en la tarjeta"), técnico en experto.
- **N reintegros por gasto** (banco + billetera + comercio): sin `unique(linked_transaction_id)`.
- Cancelar un reintegro que nunca llegó (`cancelled_at`), para no dejar pendientes eternos.

**Infra:**
- Alta atómica (gasto + reintegro, o madre + N hijas + reintegro) vía función Postgres (RPC).
- Retiro de la categoría seed "Reintegros / Cashback" vía `is_active = false`.

## Capabilities

### Modified Capabilities
- `transactions`: agrega el reintegro como un tipo de movimiento propio vinculado al gasto, con estado pendiente/recibido/cancelado, dos materializaciones (a cuenta / en resumen de tarjeta), reglas de impacto sobre saldos y sobre el total del período de tarjeta, neto por categoría, y la protección del vínculo al editar/borrar el gasto origen. (El modelo de datos, el RPC atómico y los guards exhaustivos son implementación → van en `design.md`.)

## Impact

- **Migración** (`supabase/migrations/`): `ALTER TYPE transaction_type ADD VALUE 'reimbursement'`; columnas nuevas; CHECK de exclusión mutua; trigger de integridad del vínculo; función Postgres del alta atómica; `is_active = false` en la categoría seed. Self-check al final (estilo de las migraciones de v3).
- **`@grana/money-logic`**: el reintegro entra en `calculateTransactionSums` y `computeRunningBalances` (`balance.ts`) **con guard exhaustivo (`assertNever`)** para que el compilador obligue a manejarlo (y al próximo tipo). Nuevo cálculo puro de neto por categoría (bruto / recibido / esperado / neto) y de la reducción del total del período por reintegros `statement` recibidos.
- **`packages/supabase/src/types.ts`**: regenerar tipos contra el proyecto remoto tras aplicar la migración.
- **Web — actions**: crear gasto-con-reintegro (vía RPC), confirmar/reconciliar, cancelar, editar/eliminar reintegro; guardas de edición del gasto origen (bloquear cuenta/moneda si tiene reintegros).
- **Web — UI**: bloque "Tiene reintegro" en `movement-form.tsx`; la fila del reintegro bajo el gasto en el listado/detalle; pantalla de confirmar; el neto por categoría.
- **i18n** (`@grana/i18n-messages`): claves del bloque, subtipos, estados, copy por modo, motivo de cancelación.
- **Sin `shared`/mobile**: la lógica pura queda en `money-logic` y los contratos en `ui-contracts` listos para que mobile espeje; el esquema no impide splittear a futuro (módulo `shared`).
- **Fuera de alcance V1**: validación de promos bancarias, split/`shared`, reintegros multi-moneda (se impone misma moneda que el gasto), conciliación bancaria automática, cálculo de elegibilidad.
