## ADDED Requirements

### Requirement: Los splits de un gasto compartido respetan un invariante simétrico con is_shared

El sistema SHALL garantizar en la base un invariante **simétrico** entre `transactions.is_shared` y las filas `shared_expense_split`, evaluado **por `transaction_id`** y **diferido a fin de transacción** (los splits se insertan/borran fila por fila):

- Una transacción **compartida** (`is_shared = true`) **que porta splits** SHALL tener la suma de `amount_assigned` de sus splits **exactamente igual** a su `amount`.
- Una transacción **no compartida** (`is_shared = false`) NO SHALL conservar **ningún** split.

El invariante SHALL implementarse con dos guardas complementarias, de modo que ninguna variante incompleta pase inadvertida:

- Un chequeo que se dispara al mutar splits (INSERT/UPDATE/DELETE de `shared_expense_split`) y valida el **estado final** de la transacción (no un early-return): si es compartida, los splits suman; si no, no debe quedar ninguno.
- Un chequeo diferido sobre la transición `transactions.is_shared → false` que captura el caso de "cambié el flag pero no borré los splits" (donde ninguna fila de split cambió y el primer chequeo no se enteraría).

La transacción **madre** de una compra en cuotas es compartida pero **no porta splits propios** (viven en las cuotas hijas); queda naturalmente exenta del chequeo de suma (ninguna fila de split la referencia). La transición `is_shared = true → false` acompañada del borrado de todos los splits en la **misma transacción** SHALL pasar el invariante (al commit ya no quedan splits).

#### Scenario: Splits que no cubren el total son rechazados

- **WHEN** al cierre de una transacción los splits de un gasto compartido suman un monto distinto al `amount` de la transacción
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Reparto válido pasa el invariante

- **WHEN** un gasto de `$100,01` se reparte 50·50 en `$50,01` + `$50,00`
- **THEN** la suma es exactamente `$100,01` y el invariante se satisface

#### Scenario: Una transacción no compartida no puede conservar splits

- **WHEN** al cierre de una transacción con `is_shared = false` aún existen filas en `shared_expense_split` para su `transaction_id`
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Insertar un split sobre una transacción no compartida es rechazado

- **WHEN** se intenta insertar (o actualizar) un `shared_expense_split` cuya transacción tiene `is_shared = false`, sin ningún UPDATE de la transacción
- **THEN** al cierre la base lo rechaza con error de invariante

#### Scenario: La madre de cuotas compartida sin splits propios no viola el invariante

- **WHEN** una compra compartida en cuotas tiene la madre `is_shared = true` sin splits propios y las cuotas hijas con sus splits que suman su monto
- **THEN** el invariante se satisface (la madre no es evaluada por suma; cada hija suma su `amount`)

### Requirement: No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior

El sistema SHALL impedir **tanto el borrado como la descompartición** (`is_shared = true → false`) de un movimiento compartido cuando exista una liquidación (`settlement`) **en el mismo hogar, en la misma moneda, con fecha igual o posterior** a la fecha de impacto del movimiento (`coalesce(due_date, date)`), porque en el extracto (cuenta corriente) esa liquidación quedó calculada sobre un saldo que incluía ese movimiento: borrarlo o descompartirlo reescribiría en silencio un saldo ya liquidado. La fecha de la liquidación es la de su movimiento de pagador (`payer_movement_id`). Recíprocamente, un movimiento **posterior a toda liquidación** de su moneda SHALL poder borrarse/descompartirse libremente (no afecta lo ya saldado), y una liquidación en una moneda NO SHALL bloquear un movimiento de la otra.

Ambas guardas SHALL vivir en la base: un trigger `BEFORE DELETE` y un trigger `BEFORE UPDATE` (acotado a la transición de `is_shared` a `false`) sobre `transactions`, evaluados **por fila**, de modo que solo se guarden las filas que **portan splits** (cada cuota hija por su propia fecha de impacto; la madre de cuotas y las patas `settlement`, que no portan splits, quedan exentas). Las guardas SHALL lanzar un `SQLSTATE` distinguible (`GRN01`) que la capa de aplicación mapea a un mensaje explicativo indicando revertir esa liquidación primero.

#### Scenario: Borrado bloqueado por una liquidación posterior en la misma moneda

- **WHEN** un usuario intenta borrar un gasto compartido y existe una liquidación en la misma moneda con fecha igual o posterior a la del gasto
- **THEN** la base rechaza el borrado (SQLSTATE `GRN01`) y la aplicación explica que primero debe revertir esa liquidación

#### Scenario: Descompartir bloqueado por una liquidación posterior en la misma moneda

- **WHEN** un usuario intenta descompartir un gasto compartido y existe una liquidación en la misma moneda con fecha igual o posterior a la del gasto
- **THEN** la base rechaza la transición `is_shared → false` (SQLSTATE `GRN01`) y la aplicación muestra el mensaje explicativo

#### Scenario: Movimiento posterior a toda liquidación se puede descompartir/borrar

- **WHEN** un usuario descomparte o borra un gasto compartido cuya fecha es posterior a la de toda liquidación de esa moneda en el hogar
- **THEN** la operación procede y la deuda derivada se recalcula sin ese gasto (la liquidación anterior no lo cubría)

#### Scenario: Una liquidación en otra moneda no bloquea

- **WHEN** existe una liquidación en ARS y el usuario descomparte/borra un gasto en USD (o viceversa)
- **THEN** la guarda no se dispara (la moneda no coincide)

#### Scenario: Revertir una liquidación no queda bloqueado por las guardas

- **WHEN** una operación privilegiada revierte una liquidación borrando o contra-asentando sus patas `settlement`
- **THEN** las guardas no se disparan (las patas son `is_shared = false`, no portan splits) y la reversión procede

### Requirement: Descompartir un gasto es una operación atómica sin splits huérfanos

El sistema SHALL reconciliar la descompartición de un gasto (toggle "Compartir" → off sobre un gasto ya compartido) mediante una **única operación atómica** (RPC) que, en la misma transacción de base, marca las transacciones afectadas como `is_shared = false` / `household_id = null` y borra sus `shared_expense_split`. NO SHALL usarse el patrón cliente de `DELETE` de splits seguido de `UPDATE` del flag en llamadas separadas, que deja splits huérfanos al disparar el invariante diferido.

La operación SHALL derivar **server-side** el conjunto completo de transacciones afectadas a partir de un **único id raíz**: el gasto raíz, sus **cuotas hijas** (si es una compra en cuotas), y los **reintegros vinculados** a cualquiera de ellos. NO SHALL aceptar una lista arbitraria de ids provista por el cliente.

La operación SHALL correr con privilegios del invocador (`SECURITY INVOKER`) y validar **explícitamente** que hay un usuario autenticado y que la raíz pertenece al caller (porque las transacciones compartidas tienen lectura cross-user, un intento ajeno resultaría de otro modo en un UPDATE de cero filas y un "éxito" silencioso). SHALL bloquear las filas afectadas (`FOR UPDATE`) en orden determinista y estar acotada con `REVOKE EXECUTE FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated`.

Al completarse, NO SHALL quedar ningún split sobre las transacciones descompartidas (garantizado por el invariante simétrico), y la operación SHALL estar sujeta a la guarda de liquidaciones (ver el requisito de la guarda temporal).

#### Scenario: Descompartir un gasto simple limpia sus splits atómicamente

- **WHEN** un usuario descomparte un gasto compartido simple (sin cuotas)
- **THEN** en una sola transacción la base marca el gasto `is_shared = false` / `household_id = null` y borra sus splits
- **AND** no queda ninguna fila en `shared_expense_split` para ese gasto
- **AND** la deuda derivada del hogar ya no incluye ese gasto

#### Scenario: Descompartir una compra en cuotas limpia los splits de las hijas

- **WHEN** un usuario descomparte una compra compartida en cuotas desde su transacción madre
- **THEN** la base marca la madre y todas las cuotas hijas como `is_shared = false` / `household_id = null` y borra los splits de las hijas
- **AND** no queda ningún split huérfano en ninguna cuota

#### Scenario: Descompartir arrastra los reintegros vinculados

- **WHEN** un usuario descomparte un gasto compartido que tiene un reintegro compartido vinculado
- **THEN** el reintegro también queda `is_shared = false` / `household_id = null` y sus splits se borran, en la misma operación

#### Scenario: Un usuario ajeno no puede descompartir un movimiento que no es suyo

- **WHEN** un usuario invoca la operación de descompartir sobre una transacción de otro miembro del hogar (que puede leer por RLS)
- **THEN** la operación falla con un error explícito de ownership (no un "éxito" de cero filas)

#### Scenario: Descompartir es atómico ante fallo

- **WHEN** la operación de descompartir no puede completar el borrado de todos los splits afectados
- **THEN** ni el flag `is_shared` ni los splits quedan en un estado intermedio (la transacción de base se revierte entera)

## MODIFIED Requirements

### Requirement: La deuda neta del hogar se deriva por moneda y nunca se persiste

El sistema SHALL calcular la deuda neta entre los dos miembros como función pura de los splits y las liquidaciones registradas, separada por moneda (ARS y USD nunca se agregan). No existe columna de saldo de deuda cacheada; la deuda se recalcula en cada lectura. La convención de signo indica quién le debe a quién por moneda.

La derivación de deuda SHALL considerar **únicamente** splits de transacciones **compartidas** (`is_shared = true`): un split extraviado o legacy sobre una transacción no compartida NO SHALL contribuir a la deuda derivada. Esta restricción es defensiva y complementa el invariante que garantiza que una transacción no compartida no conserva splits.

#### Scenario: Deuda derivada de un único gasto compartido

- **WHEN** A paga un gasto de `$100 ARS` compartido 50·50 con B, y no hay liquidaciones
- **THEN** el sistema deriva que B le debe `$50 ARS` a A, sin persistir ese número

#### Scenario: Deuda separada por moneda

- **WHEN** hay gastos compartidos en ARS y en USD
- **THEN** el sistema reporta una deuda neta por cada moneda, nunca una suma combinada

#### Scenario: Deudas menores al centavo se descartan

- **WHEN** la deuda neta resultante en una moneda es menor a un centavo
- **THEN** el sistema la reporta como "están al día" en esa moneda

#### Scenario: Un split sobre una transacción no compartida no contamina la deuda

- **WHEN** existe una fila `shared_expense_split` cuyo `household_id` es el del hogar pero cuya transacción tiene `is_shared = false`
- **THEN** la deuda derivada la ignora (no aporta a ninguna moneda)

## REMOVED Requirements

### Requirement: Los splits de un gasto compartido suman exactamente su monto

**Reason**: Reemplazado por el invariante **simétrico** con `is_shared` (ver el requisito agregado "Los splits de un gasto compartido respetan un invariante simétrico con is_shared"), que además de exigir la suma exacta en las compartidas garantiza que una transacción no compartida no conserve splits.

**Migration**: Ninguna acción de datos; la migración `0048` redefine `trg_fn_splits_sum_total` in place y limpia huérfanos preexistentes.

### Requirement: No se puede borrar un gasto compartido con una liquidación viva en el hogar

**Reason**: Reemplazado por la guarda **temporal + por moneda** que cubre borrado y descompartición (ver "No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior"). La regla amplia ("cualquier liquidación congela todo") era un falso positivo para gastos posteriores a la liquidación.

**Migration**: La migración `0049` redefine `trg_fn_block_shared_delete_with_settlement` (y agrega el gemelo de descompartir) a la forma temporal.
