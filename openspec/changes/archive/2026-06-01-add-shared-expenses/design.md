## Context

v3 todavía no tiene ningún concepto de multi-usuario colaborativo: todas las tablas son `user_id = auth.uid()` y toda RLS es estrictamente por dueño. El módulo de Economía Familiar de v2 (relevado el 2026-05-31) resolvía gastos compartidos entre dos personas con deuda bilateral derivada. Este change porta esa capacidad a v3 alineándola con sus pilares (accounting trust, balances derivados, bimoneda por defecto, `Money`/`decimal.js`), descartando deliberadamente el enfoque de "ledger paralelo" tipo Splitwise.

Decisiones de producto ya cerradas con el usuario (2026-05-31):
- Nombre de la capability: **Compartido** (`shared`).
- **Dos miembros** por hogar en Fase 1, con schema extensible a N.
- Fase 1 **incluye cuotas de tarjeta** compartidas.
- Liquidación con **handshake liviano** (sin aceptar/rechazar).
- Fase 1 **incluye reintegros compartidos** (ambos subtipos, modelo justo: hereda split y baja la deuda por la parte del otro).
- Fuera de Fase 1: 3+ participantes, negociación de split.

## Goals / Non-Goals

**Goals:**
- Un gasto compartido es una transacción real en el ledger de quien paga; nada vive en un universo contable aparte.
- La deuda neta es función pura de splits + liquidaciones, por moneda, recalculada en cada lectura.
- La lógica de deuda y reparto vive en `packages/money-logic` como funciones puras (reutilizables web + mobile, testeables).
- El schema admite extender a N participantes sin reescritura (junction `household_member`, no columnas `user_a`/`user_b`).
- Primer patrón de RLS de lectura cruzada en v3, acotado y auditado.

**Non-Goals:**
- No soportar 3+ participantes en esta fase (sí dejar el schema preparado).
- No negociación/propuestas de split entre miembros.
- No conversión automática ARS↔USD (jamás).
- No persistir saldos de deuda.

## Decisions

### D1 — Gasto compartido = transacción real + splits (no tabla paralela)

Un `expense` con `is_shared = true` + `household_id`, más filas en `shared_expense_split`. El gasto impacta el `disponible` de quien paga como cualquier expense.

**Por qué:** es el pilar #1 de v3 (accounting trust, balances derivados). Si pagaste $100, salieron $100 de tu cuenta — un ledger paralelo lo rompería. Alternativa considerada y descartada: tabla `shared_expenses` desacoplada de `transactions` (estilo Splitwise) — viola accounting trust y duplica el modelo de movimientos.

### D2 — Deuda neta derivada en `packages/money-logic`, nunca persistida

Función pura `computeHouseholdDebt(splits, settlements, currency) → DebtByCurrency`. La invocan las queries tras leer de Supabase.

**Por qué:** consistente con "derived balances, never persisted" (`AGENTS.md:202`). Evita el riesgo de divergencia entre un valor cacheado y la realidad. Alternativa descartada: columna `net_debt` materializada — fuente de inconsistencias, como en cualquier saldo cacheado.

### D3 — Schema extensible a N: `household` + `household_member`

`household(id, name, is_active, default_split jsonb, created_by)` + `household_member(household_id, user_id, joined_at)`. La Fase 1 enforza máximo 2 miembros con un constraint/validación, pero la forma del modelo no presupone exactamente dos.

**Por qué:** el usuario prefería N; acordamos 2 por simplicidad. La junction permite que N sea una fase futura, no un rewrite. `default_split` como JSONB `[{user_id, percentage}]` (igual que v2) evita una tabla extra para 2 filas.

### D4 — Liquidación: handshake liviano con tabla `settlement`

`settlement(id, household_id, payer_id, payer_movement_id, receiver_id, receiver_movement_id nullable, amount, currency_code, status)`. Flujo:
1. Quien paga registra → se crea un movimiento `settlement` real en su cuenta (su `disponible` baja) + fila `settlement` con `status='pending_receipt'` y `receiver_movement_id = NULL`.
2. Quien recibe asigna cuenta → se crea su movimiento `settlement` real (su `disponible` sube), se setea `receiver_movement_id`, `status='completed'`.
3. Corrección por edición/eliminación **mientras está pendiente** (no hay accept/reject). Ver D10 para la reversión post-completado.

**Las dos patas son movimientos de tipo `settlement` (ver D11), no `expense`/`income` categorizados.** Cada pata se orquesta a nivel server action con rollback manual (ver D12), no con RPC.

**Por qué:** la plata realmente entró a la cuenta del receptor; para reflejarlo fielmente, el receptor debe decir *en qué cuenta* (no podemos adivinar su cuenta). Eso obliga a una intervención mínima del receptor, pero no a una máquina de estados de 3 estados. Alternativas consideradas:
- **Handshake completo (v2):** accept/reject + reversión. Más fiel ante "envié por error", pero la reversión ya la cubre el editar/eliminar en estado pendiente; los 3 estados son sobrecarga.
- **Directo a cuenta default:** crear el movimiento automáticamente en la cuenta principal del receptor. Descartado: mete un movimiento en la cuenta de otro sin su intervención y puede no reflejar dónde llegó realmente.

### D10 — Reversión de una liquidación: libre en pendiente, privilegiada en completada

Mientras `status='pending_receipt'`, solo existe la pata del pagador (su propio movimiento): puede editarla/eliminarla libremente. Una vez `status='completed'`, la pata del receptor es un movimiento **de otro usuario**, y la RLS de escritura es estrictamente owner-only — el pagador NO puede borrar el movimiento del receptor desde el cliente. Deshacer una liquidación completada SHALL hacerse mediante una función `SECURITY DEFINER` acotada (revierte ambas patas de forma atómica, validando pertenencia al hogar) o requiriendo la acción del receptor.

**Por qué:** la verificación del código confirmó que en v3 todas las policies de escritura son `user_id = auth.uid()` y no hay escritura cross-user. Pretender que el pagador borre el income del receptor desde el action fallaría silenciosamente. La función privilegiada es el único punto donde se permite tocar ambas patas, y queda auditada y acotada al hogar.

### D11 — Las liquidaciones usan un tipo de movimiento propio `settlement`

La verificación confirmó que `transactions.category_id` es NOT NULL y que la validación Yup exige categoría para `expense` e `income`. Una liquidación de deuda **no es un gasto/ingreso categorizable** y no debe contaminar los analytics de "en qué se fue" ni "lo que entró". Por eso se introduce un tipo de movimiento `settlement` (vía `ALTER TYPE transaction_type ADD VALUE 'settlement'`), sin categoría, que **sí impacta el `disponible`** de la cuenta pero **se excluye** de los totales de gasto/ingreso y de los desgloses por categoría.

**Por qué:** es exactamente el precedente de v3 con `reimbursement` y `exchange` (tipos propios para no ensuciar totales). Alternativa considerada: una categoría de sistema "Saldar deuda" reusando `expense`/`income` — descartada porque seguiría apareciendo como gasto/ingreso en los análisis salvo que la excluyamos por categoría caso por caso (más frágil que un tipo propio). Costo asumido: hay que actualizar los guards exhaustivos de `packages/money-logic/src/balance.ts` para manejar el nuevo tipo (el compilador lo obliga, lo cual es bueno).

**Dirección de cada pata (resuelto en implementación, 2026-06-01).** Una liquidación son **dos filas** `settlement` de dos usuarios distintos (no una fila de dos patas como `transfer`, porque cruzan la frontera de RLS). `balance.ts` es puro y procesa una fila por vez, así que cada fila debe auto-describir su signo. Se agrega una columna nullable `settlement_direction text` con `CHECK (settlement_direction IN ('out','in'))`, seteada solo en filas `type='settlement'`: `'out'` (pata del pagador) resta del saldo, `'in'` (pata del receptor) suma. Mantiene `amount > 0` (sin relajar `chk_amount_positive`) y replica cómo `reimbursement` agregó sus columnas nullables. Nota: `category_id` ya es **nullable a nivel DB** (el pago de resumen inserta `category_id=null`); la obligación de categoría vive solo en el Yup de income/expense, así que `settlement` no requiere cambios de constraint de categoría.

### D12 — Atomicidad por orquestación en el server action, no por RPC

Toda operación multi-tabla (gasto + splits; gasto + reintegro compartido; liquidación + movimiento) se orquesta en el server action: insertar, capturar el id, insertar lo dependiente, y **rollback manual** (borrar lo insertado) si un paso posterior falla.

**Por qué:** es el patrón dominante y deliberado de v3 (ver `apps/web/app/_actions/_lib/reimbursements.ts` y `accounts.ts`); el change de reintegros lo documentó explícitamente para no reimplementar los caminos de creación en PL/pgSQL. La excepción es D10 (reversión cross-user), que sí requiere `SECURITY DEFINER` por la frontera de RLS.

### D5 — Cuotas compartidas: splits en las hijas

Para un consumo compartido en N cuotas, los `shared_expense_split` se asocian a cada cuota hija; la madre no lleva splits. El cálculo de deuda excluye cuotas con `due_date` posterior al cierre del mes corriente.

**Por qué:** así cada cuota aporta su deuda en su mes de vencimiento, coherente con cómo v3 ya modela cuotas (off-ledger hasta el pago del resumen). La exclusión de cuotas futuras debe vivir en un único lugar (la función pura de deuda) para no duplicarse.

### D6 — Monedas: ARS + USD por defecto, sin tabla de config por hogar

Se elimina el `household_currencies` de v2. La deuda se calcula por moneda; no hay intersección que computar.

**Por qué:** v3 es bimoneda por defecto (`AGENTS.md:200`): todos tienen ARS+USD. La intersección de v2 era siempre `{ARS, USD}`. Una tabla de config sería ceremonia muerta.

### D7 — RLS de lectura cruzada acotada

`transactions`: SELECT permite `user_id = auth.uid()` **OR** (`is_shared = true` AND `household_id` ∈ hogares del usuario). INSERT/UPDATE/DELETE siguen siendo solo del dueño. Tablas del módulo: lectura por pertenencia al hogar. Cuentas del partner: lectura acotada para el selector de liquidación.

**Por qué:** es el primer caso de lectura cruzada en v3 y hay que minimizar superficie. La escritura nunca se comparte (nadie edita el gasto de otro). Helper SQL `is_household_member(household_id)` con índice `transactions(household_id) WHERE is_shared` para que la policy no sea cara.

### D8 — Toggle de "Compartir" reusa el form de gasto existente

No hay un form nuevo de "gasto compartido": es un toggle + panel de split dentro del form de gasto actual, visible solo con hogar de 2 miembros.

**Por qué:** el gasto compartido **es** un gasto; un form separado duplicaría lógica. Coherente con el form único de movimientos de v3.

### D9 — Reintegro compartido = movimiento compartido con signo invertido en la deuda

Cuando un gasto compartido tiene un `reimbursement` asociado, el reintegro se marca también `is_shared = true` + `household_id` y recibe filas en `shared_expense_split` **heredadas** del gasto origen (mismos porcentajes; para cuotas, heredadas de la cuota hija correspondiente). La función de deuda suma los splits de `expense` en positivo y los de `reimbursement` en **negativo**, de modo que la deuda es un único sumatorio:

> deuda(B→A, moneda) = Σ(split de B en expenses que pagó A) − Σ(split de B en reimbursements que recibió A) − liquidaciones

Solo cuenta el reintegro **recibido** (con `received_at`); el pendiente no entra (consistente con v3). El subtipo afecta solo el ledger personal de quien lo recibió (ya resuelto por v3): "a cuenta" suma a su cuenta; "en resumen" reduce el período de tarjeta. Para la **deuda compartida**, ambos subtipos se comportan igual (bajan la deuda por la parte del otro); la diferencia es el **momento**: "a cuenta" cuenta al setear `received_at`, "en resumen" alinea su efecto con el período de tarjeta del consumo que reduce.

**Por qué:** es el modelo justo (el beneficio del reintegro se reparte como el costo). Como un solo sumatorio firmado, reusa toda la infra de splits y no agrega una segunda fórmula. Mejora la fragilidad de v2 (donde el "signo invertido del cashback" era código aparte y poco obvio): acá el signo lo determina el `type` del movimiento. Restricción heredada de v3 que simplifica: un reintegro solo se vincula a un gasto **del mismo usuario** (spec `transactions`), así que el reintegro siempre lo recibe quien pagó → siempre reduce la deuda que el otro le debe.

## Risks / Trade-offs

- **[RLS cross-user mal diseñada filtra datos] →** Policies explícitas, helper `is_household_member`, e índice parcial; tests con dos usuarios reales que verifiquen que un extraño no ve nada y que la escritura cruzada se rechaza.
- **[Performance de la policy de `transactions`] →** Índice `WHERE is_shared = true`; la mayoría de las transacciones no son compartidas, así que el OR-branch toca pocas filas.
- **[Liquidación huérfana si el partner sale a mitad de camino] →** `salir del hogar` se bloquea si hay deuda viva; además validar que no queden `settlement` en `pending_receipt` antes de permitir la salida.
- **[Borrar un gasto compartido con liquidaciones asociadas deja deuda inconsistente] →** Definir el borrado: al eliminar un gasto compartido se eliminan sus splits (cascade) y la deuda se rederiva; documentar el efecto en la UI antes de confirmar.
- **[Eliminar una liquidación ya completada cruza la frontera de usuario] →** La pata del receptor es un movimiento de otro `user_id` y la RLS de escritura es owner-only; el pagador no puede borrarla desde el cliente. Se resuelve con la función `SECURITY DEFINER` de D10 (revierte ambas patas, acotada al hogar). Libre edición/borrado solo mientras la liquidación está pendiente.
- **[Nuevo tipo `settlement` mal integrado en los analytics] →** Cubrir en los guards de `balance.ts` que `settlement` impacta `disponible` pero NO suma a gasto/ingreso ni a desgloses por categoría; tests que verifiquen la exclusión (precedente: `reimbursement`).
- **[Cuotas futuras "aparecen" en la deuda al cambiar el mes] →** Comportamiento intencional (la deuda futura no es obligación hoy); surfacear en UI para que no sorprenda.
- **[Reintegro "en resumen" compartido sobre una compra en cuotas es el cruce más complejo] →** El reintegro hereda el split de la cuota a la que aplica y baja la deuda en el período de esa cuota; los pendientes nunca cuentan. Concentrar toda la lógica en la función pura de deuda (un solo sumatorio firmado) y cubrir con tests el combo en-resumen + cuotas + split. Tratar el matching reintegro↔cuota/período como punto de diseño de implementación.
- **[Editar/borrar un reintegro compartido recibido cambia la deuda] →** Al rederivarse la deuda en cada lectura, no hay valor cacheado que corregir; pero si el borrado del reintegro deja al otro debiendo más de golpe, surfacearlo en UI.
- **[Trade-off del handshake liviano] →** No hay un "rechazar" explícito; si el pagador se equivocó, la corrección es editar/eliminar. Aceptable porque la reversión por borrado cubre el caso y evita una máquina de estados.

## Migration Plan

1. **Migración `0022_settlement_type.sql`** (solo el enum, igual que `0017` separó el valor `reimbursement`): `ALTER TYPE transaction_type ADD VALUE 'settlement'`. Va en su propia migración porque Postgres no permite usar un valor de enum recién agregado en la misma transacción que lo crea.
2. **Migración `0023_shared.sql`:**
   - Tablas `household`, `household_member`, `household_invite`, `shared_expense_split`, `settlement`.
   - Columnas en `transactions`: `is_shared boolean not null default false`, `household_id uuid references household(id)`, y `settlement_direction text` con `CHECK (settlement_direction IN ('out','in'))` (ver D11). No hace falta tocar `category_id` (ya nullable en DB).
   - Helper `is_household_member(uuid)` `SECURITY DEFINER` (patrón NUEVO en v3: hoy no hay ningún helper de pertenencia ni lectura cross-user); RLS en tablas nuevas; modificación de la policy SELECT de `transactions`.
   - Función `SECURITY DEFINER` para revertir una liquidación completada (ambas patas, acotada al hogar; ver D10).
   - Índice parcial `transactions(household_id) where is_shared = true`.
3. **Guards de `packages/money-logic/src/balance.ts`:** manejar el nuevo tipo `settlement` (impacta `disponible` según `settlement_direction`, se excluye de sumas de gasto/ingreso y de desgloses por categoría). El switch exhaustivo obliga a cubrirlo.
4. **Atomicidad por server action con rollback manual** (no RPC; ver D12), salvo la reversión cross-user (D10).
5. **Rollback de la migración:** las tablas/columnas nuevas son aditivas; revertir = drop. El `ADD VALUE` del enum no es reversible sin recrear el tipo — asumible porque no hay datos `settlement` previos. No hay backfill.
6. Regenerar tipos Supabase (`supabase gen types`, proyecto `exhpnnaigjfcxcvmptxa`) y correr `supabase/validate_schema.sql` tras aplicar.

## Open Questions

- ¿El borrado de un gasto compartido requiere confirmación reforzada si ya influyó en una liquidación registrada, o basta con rederivar? (Inclinación: rederivar + aviso.)
- ¿La invitación admite deep link (`/invite/[code]`) en Fase 1 o solo código manual? (Inclinación: código manual primero, deep link es incremental.)
- ¿Liquidación parcial habilitada en Fase 1 o solo total? (Inclinación: permitir parcial, el monto ya valida ≤ deuda.)
