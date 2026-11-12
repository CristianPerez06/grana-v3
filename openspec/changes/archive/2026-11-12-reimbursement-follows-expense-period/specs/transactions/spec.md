## MODIFIED Requirements

### Requirement: El usuario puede declarar un reintegro al registrar un gasto

Al registrar un gasto, el usuario SHALL poder declarar opcionalmente que ese gasto tiene un reintegro asociado, mediante un bloque "Tiene reintegro". Al activarlo, el usuario SHALL indicar el **monto esperado**, el **subtipo** (a cuenta / en resumen) y si el reintegro **ya fue recibido** o queda pendiente. El sistema SHALL crear el gasto y el reintegro en una **operación atómica**: si la creación del reintegro falla, el gasto tampoco se crea.

El subtipo "en resumen" SHALL ofrecerse únicamente cuando el gasto es sobre una tarjeta de crédito; "a cuenta" SHALL estar disponible para cualquier medio de pago, y SHALL ser el default.

Para el subtipo "a cuenta", la cuenta de acreditación SHALL prerellenarse con una cuenta del **mismo banco/institución** que la cuenta del gasto, cuando exista (refleja el comportamiento real); el usuario puede cambiarla.

El bloque "Tiene reintegro" SHALL estar disponible tanto en una compra de un solo pago como en una compra **en cuotas**. En una compra en cuotas, el reintegro SHALL vincularse a la **madre** de la compra (`linked_transaction_id = id de la madre`, un `expense` off-ledger con `is_parent = true`), no a una cuota hija; la atomicidad SHALL abarcar madre, cuotas y reintegro (si el reintegro falla, no se crea nada). Para el subtipo "en resumen" sobre una compra en cuotas, el reintegro SHALL imputarse al período de la **primera cuota** (el período de la fecha de compra), sin ofrecer un selector de período; el usuario reconcilia el período real al confirmarlo. Cuando la compra en cuotas es **compartida**, el reintegro SHALL heredar el mismo split del hogar en una única fila, de modo que la deuda derivada lo netee correctamente.

**Fecha contable del reintegro.** La fecha del reintegro declarado SHALL tomar por default la **fecha del gasto que le dio origen**, nunca el día de carga. Un reintegro pendiente reconcilia su fecha real al confirmarlo; uno recibido queda con la fecha del gasto salvo que el usuario indique otra. Si más tarde se edita la fecha del gasto, el sistema SHALL propagar la nueva fecha a los reintegros vinculados **cuya fecha todavía coincidía con la fecha anterior del gasto** (los que la venían siguiendo por default), dejando intactos los que tienen una fecha de acreditación distinta puesta a mano. No propagar esto dejaba al reintegro varado en el día de carga, desalineado del gasto. Lo mismo vale para el **resumen**: si el cambio de fecha mueve un consumo de tarjeta a otro resumen, el sistema SHALL mover también a los reintegros "en resumen" vinculados que lo venían siguiendo —los que estaban en el **mismo resumen y con la misma fecha** que el gasto antes del cambio—, dejando intactos los que el usuario imputó a mano a otro resumen o con otra fecha. Sin esto, el gasto caía en el resumen correcto y su reintegro quedaba descontando en el viejo: un resumen inflado y el otro con un crédito que no le correspondía.

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

#### Scenario: Editar la fecha del gasto arrastra la del reintegro que la seguía

- **WHEN** el usuario cambia la fecha de un gasto de `2026-08-03` a `2026-07-15`, y el gasto tiene un reintegro vinculado cuya fecha era `2026-08-03` (la que venía siguiendo del gasto)
- **THEN** el reintegro pasa a fecha `2026-07-15`
- **AND** un reintegro del mismo gasto con una fecha de acreditación distinta puesta a mano NO se modifica

#### Scenario: Editar la fecha de un consumo de tarjeta mueve de resumen al reintegro que lo seguía

- **WHEN** el usuario carga un consumo de tarjeta con fecha `2026-11-12` y un reintegro "en resumen" que queda en el mismo resumen (el que cierra el `2026-11-20`), y después cambia la fecha del consumo a `2026-09-30`, que cae en el resumen que cerró el `2026-10-22`
- **THEN** el consumo y el reintegro pasan los dos al resumen que cerró el `2026-10-22`, y su total muestra el gasto neto del reintegro
- **AND** un reintegro "en resumen" del mismo gasto que el usuario había imputado a otro resumen, o con otra fecha, NO cambia de resumen

#### Scenario: Declarar un reintegro a cuenta en una compra en cuotas

- **WHEN** el usuario registra una compra en cuotas y activa "Tiene reintegro" con subtipo "a cuenta"
- **THEN** el sistema crea la madre, las N cuotas y un reintegro vinculado a la **madre**, en una sola operación atómica
- **AND** si la creación del reintegro falla, no se crea ni la madre ni ninguna cuota

#### Scenario: Reintegro en resumen sobre una compra en cuotas cae en el período de la primera cuota

- **WHEN** el usuario registra una compra en cuotas sobre una tarjeta y declara un reintegro "en resumen"
- **THEN** el reintegro se imputa al período de la **primera cuota** (el período de la fecha de compra), sin pedirle al usuario que elija un período
- **AND** al confirmarlo el usuario puede reconciliar el período real donde efectivamente se acreditó

#### Scenario: El reintegro de una compra en cuotas compartida hereda el split

- **WHEN** el usuario registra una compra en cuotas **compartida** (split 50/50) por $60.000 y declara un reintegro recibido de $12.000
- **THEN** el reintegro se crea con el mismo split del hogar en una única fila
- **AND** la deuda derivada del otro miembro refleja su parte del gasto menos su parte del reintegro (p. ej. +$30.000 de las cuotas − $6.000 del reintegro = $24.000)

