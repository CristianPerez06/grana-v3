## ADDED Requirements

### Requirement: El usuario puede declarar un reintegro al registrar un gasto

Al registrar un gasto, el usuario SHALL poder declarar opcionalmente que ese gasto tiene un reintegro asociado, mediante un bloque "Tiene reintegro". Al activarlo, el usuario SHALL indicar el **monto esperado**, el **subtipo** (a cuenta / en resumen) y si el reintegro **ya fue recibido** o queda pendiente. El sistema SHALL crear el gasto y el reintegro en una **operación atómica**: si la creación del reintegro falla, el gasto tampoco se crea.

El subtipo "en resumen" SHALL ofrecerse únicamente cuando el gasto es sobre una tarjeta de crédito; "a cuenta" SHALL estar disponible para cualquier medio de pago, y SHALL ser el default. La disponibilidad del subtipo NO SHALL depender del modo de usuario.

Para el subtipo "a cuenta", la cuenta de acreditación SHALL prerellenarse con una cuenta del **mismo banco/institución** que la cuenta del gasto, cuando exista (refleja el comportamiento real); el usuario puede cambiarla.

#### Scenario: Declarar un reintegro pendiente a cuenta

- **WHEN** el usuario registra un gasto y activa "Tiene reintegro" con un monto, subtipo "a cuenta", sin marcarlo como recibido
- **THEN** el sistema crea el gasto y un reintegro pendiente vinculado al gasto, en una sola operación atómica
- **AND** si la creación del reintegro falla, el gasto tampoco se crea

#### Scenario: "En resumen" sólo está disponible en gastos de tarjeta

- **WHEN** el gasto es sobre una cuenta cash o débito
- **THEN** sólo está disponible el subtipo "a cuenta"
- **AND** cuando el gasto es sobre una tarjeta de crédito, se ofrecen ambos subtipos

#### Scenario: La cuenta de acreditación se prerellena por institución

- **WHEN** el usuario activa el reintegro "a cuenta" sobre un gasto pagado con una tarjeta del banco X
- **THEN** la cuenta de acreditación se prerellena con una cuenta del banco X, si existe

#### Scenario: Declarar un reintegro ya recibido en el mismo alta

- **WHEN** el usuario registra el gasto y marca "Ya me lo acreditaron"
- **THEN** el reintegro se crea con `received_at` seteado y entra en los cálculos como un hecho real, sin pasar por el estado pendiente

---

### Requirement: El reintegro es un tipo de movimiento propio vinculado al gasto

El sistema SHALL modelar el reintegro como un movimiento de tipo propio `reimbursement` —NO como `income` ni como `adjustment`— vinculado al gasto origen mediante `linked_transaction_id`. El gasto origen NO SHALL modificarse al crear el reintegro.

El reintegro SHALL heredar la categoría del gasto origen: el sistema deriva la categoría desde el gasto vinculado en lectura y NO SHALL almacenar una categoría propia. El reintegro NO SHALL contarse como ingreso genérico en ningún total de "lo que entró".

El `linked_transaction_id` SHALL apuntar a un gasto (`type='expense'`) del mismo usuario; el sistema SHALL rechazar vincular un reintegro a un movimiento de otro usuario o que no sea un gasto. Un mismo gasto SHALL poder tener **N reintegros** asociados; el sistema NO SHALL imponer unicidad sobre `linked_transaction_id`.

#### Scenario: El reintegro hereda la categoría del gasto

- **WHEN** un gasto categorizado como "Supermercado" tiene un reintegro asociado
- **THEN** el reintegro se muestra con la categoría "Supermercado" derivada del gasto

#### Scenario: El reintegro no es ingreso genérico

- **WHEN** el sistema calcula "lo que entró" del mes
- **THEN** los reintegros no se cuentan como ingreso

#### Scenario: El vínculo respeta el dueño y el tipo

- **WHEN** se intenta vincular un reintegro a una transacción de otro usuario o a un movimiento que no es un gasto
- **THEN** el sistema rechaza la operación

---

### Requirement: Un reintegro pendiente no impacta saldos y se muestra separado del historial

En un reintegro pendiente (`received_at` sin setear), el campo `amount` representa el **monto estimado vigente** y NO SHALL impactar ningún cálculo (saldo, saldo corriente, total de resumen ni neto). Recién cuando `received_at` está seteado, `amount` representa el **monto real reconciliado** y entra en saldos, resumen de tarjeta o analytics.

Los reintegros pendientes NO SHALL aparecer en el historial cronológico de movimientos: SHALL listarse en un bloque **"Reintegros a confirmar"** arriba del listado (en el módulo global y en el detalle de la cuenta de acreditación), separando la expectativa del hecho. Sólo los reintegros **recibidos** SHALL aparecer en el historial; los cancelados no aparecen en ninguno.

El sistema SHALL conservar un `estimated_amount` **inmutable** con lo que el usuario esperaba, para auditar la diferencia entre lo esperado y lo recibido.

#### Scenario: Un reintegro pendiente no suma al saldo ni aparece en el historial

- **WHEN** existe un reintegro pendiente "a cuenta" de $20.000
- **THEN** el saldo de la cuenta no incluye los $20.000
- **AND** el reintegro no aparece en el historial cronológico, sino en el bloque "Reintegros a confirmar"

#### Scenario: El monto estimado se conserva al reconciliar

- **WHEN** un reintegro se declaró con $20.000 esperados y se confirma con $18.000 reales
- **THEN** `amount` pasa a $18.000 y `estimated_amount` sigue siendo $20.000

---

### Requirement: El usuario confirma un reintegro reconciliando monto, fecha y destino

Confirmar un reintegro SHALL ser una **reconciliación**: al recibirlo, el usuario SHALL poder ajustar el **monto real** y la **fecha**. El sistema setea `received_at` al confirmar y NO SHALL alterar `estimated_amount`.

Para el subtipo "en resumen", el sistema SHALL determinar el **período de tarjeta** a partir de la fecha (que por defecto es la del consumo y el usuario puede cambiar), y NO SHALL permitir confirmarlo contra un período **ya pagado**.

#### Scenario: Reconciliar con un monto distinto al esperado

- **WHEN** el usuario confirma un reintegro esperado de $20.000 indicando que recibió $18.000
- **THEN** el reintegro queda recibido con `amount` $18.000 y entra en los cálculos por ese valor

#### Scenario: El período "en resumen" se deriva de la fecha

- **WHEN** el usuario confirma un reintegro "en resumen"
- **THEN** el sistema lo asigna al período de tarjeta que cubre la fecha indicada
- **AND** si ese período ya fue pagado, la confirmación se rechaza

---

### Requirement: El reintegro "a cuenta" recibido impacta el saldo de la cuenta

Un reintegro de subtipo "a cuenta" recibido SHALL sumar al saldo (y al saldo corriente) de la cuenta cash/bank donde se acreditó, como un movimiento entrante, manteniendo la categoría derivada del gasto. La cuenta de acreditación SHALL poder ser distinta de la cuenta del gasto (p. ej. una compra con tarjeta cuyo reintegro entra a una caja de ahorro).

#### Scenario: El reintegro recibido aumenta el saldo de la cuenta

- **WHEN** un reintegro "a cuenta" de $20.000 sobre la caja de ahorro pasa a recibido
- **THEN** el saldo de la caja de ahorro aumenta en $20.000

---

### Requirement: El reintegro "en resumen" recibido reduce el total del período de tarjeta

Un reintegro de subtipo "en resumen" recibido SHALL reducir el total a pagar del período de tarjeta donde aparece, restándose de la suma de consumos del período, y SHALL mostrarse en el resumen como un crédito. Mientras la tarjeta no se pague, el reintegro NO SHALL impactar el `disponible` (sigue off-ledger); sólo el pago del resumen —ya reducido— lo hace. Los reintegros pendientes o cancelados NO SHALL reducir el período ni aparecer en el resumen.

#### Scenario: El reintegro en resumen reduce lo que se paga

- **WHEN** un período tiene $100.000 de consumos y un reintegro "en resumen" recibido de $20.000
- **THEN** el total a pagar del período es $80.000
- **AND** el `disponible` no cambia hasta que el usuario paga el resumen

---

### Requirement: El usuario puede cancelar un reintegro que nunca llegó

El usuario SHALL poder cancelar un reintegro pendiente que nunca se recibió, seteando `cancelled_at`, para no dejar pendientes eternos. Un reintegro NO SHALL estar recibido y cancelado a la vez. Un reintegro cancelado NO SHALL impactar saldos, resumen ni neto, ni aparecer en el historial.

#### Scenario: Cancelar un pendiente que no se acreditó

- **WHEN** el usuario cancela un reintegro pendiente desde el bloque "Reintegros a confirmar"
- **THEN** el reintegro queda cancelado y no impacta ningún cálculo

#### Scenario: Recibido y cancelado son mutuamente excluyentes

- **WHEN** se intenta cancelar un reintegro ya recibido
- **THEN** la operación se rechaza

---

### Requirement: La edición y el borrado del gasto origen protegen el vínculo del reintegro

El gasto origen de un reintegro NO SHALL poder cambiar de cuenta (medio de pago) ni de moneda —en v3 esos campos son inmutables tras la creación de cualquier movimiento—, lo que preserva la semántica del vínculo. Al eliminar un gasto con reintegros asociados, sus reintegros SHALL eliminarse junto con él (`ON DELETE CASCADE`).

#### Scenario: Borrar el gasto elimina sus reintegros

- **WHEN** el usuario elimina un gasto que tiene reintegros asociados
- **THEN** esos reintegros se eliminan junto con el gasto

---

### Requirement: El detalle de un reintegro muestra el gasto vinculado

El detalle de un reintegro SHALL mostrar a qué gasto está asociado: una referencia al gasto origen (descripción o categoría y monto) que enlaza a su detalle, además del subtipo, el estado (esperado/recibido/cancelado) y la categoría derivada. Cuando el monto recibido difiere del esperado, el detalle SHALL mostrar también el monto esperado.

#### Scenario: El detalle enlaza al gasto origen

- **WHEN** el usuario abre el detalle de un reintegro
- **THEN** ve una referencia clic­keable al gasto origen con su monto
- **AND** ve el subtipo, el estado y la categoría derivada del gasto

---

### Requirement: La categoría de sistema "Reintegros / Cashback" se retira

Dado que el reintegro es un tipo de movimiento propio que hereda la categoría del gasto, la categoría de sistema de ingreso "Reintegros / Cashback" SHALL retirarse marcándola `is_active = false` (no se elimina, para preservar el historial). Los selectores de categoría NO SHALL ofrecer categorías inactivas en cargas nuevas; los movimientos históricos que ya la referencian SHALL permanecer intactos.

#### Scenario: La categoría retirada no se ofrece en cargas nuevas

- **WHEN** el usuario abre el selector de categorías al registrar un movimiento
- **THEN** "Reintegros / Cashback" no aparece entre las opciones
