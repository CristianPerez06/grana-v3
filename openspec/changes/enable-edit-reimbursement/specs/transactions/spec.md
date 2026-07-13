## ADDED Requirements

### Requirement: El usuario puede agregar, editar o quitar un reintegro al editar un gasto

Al editar un gasto, el usuario SHALL poder gestionar su reintegro vinculado mediante el mismo bloque "Tiene reintegro" del alta (monto esperado, helper de %/tope, subtipo *a cuenta* / *en resumen*, cuenta de acreditación y "ya me lo acreditaron"). El bloque SHALL estar disponible para los mismos tipos de gasto que el alta: gasto simple (efectivo/banco), compra de tarjeta de un solo pago y compra en cuotas.

Las operaciones disponibles dependen del estado del reintegro vinculado:

- Si el gasto **no tiene** reintegro, el usuario SHALL poder **agregar** uno (pendiente o ya recibido), como en el alta.
- Si el gasto tiene un reintegro **pendiente** (`received_at IS NULL` y `cancelled_at IS NULL`), el usuario SHALL poder **editar** su monto, subtipo, cuenta de acreditación y estado (marcarlo como recibido), o **quitarlo**.
- Si el gasto tiene un reintegro **recibido** (`received_at` seteado) o **cancelado** (`cancelled_at` seteado), la sección SHALL mostrarse **read-only**: el sistema NO SHALL permitir editarlo ni quitarlo desde el formulario de edición, porque esas transiciones ya impactaron saldo/resumen y se gestionan desde sus flujos propios (confirmar / cancelar / reabrir).

El reintegro en una compra en cuotas SHALL vincularse a la **madre** (no a una cuota hija); con subtipo "en resumen" SHALL imputarse al período de la **primera cuota**, sin selector de período, en paridad con el alta.

Cuando el gasto es **compartido**, el reintegro agregado o editado SHALL heredar el mismo split del hogar en una única fila, de modo que la deuda derivada lo netee. Si en la misma edición cambia el estado de compartido del gasto, el reintegro vinculado SHALL reflejar ese cambio (heredar el split al compartir, dejar de tenerlo al descompartir).

La edición del reintegro y la del gasto SHALL ser consistentes: si la aplicación del reintegro falla, el sistema SHALL informar el error sin dejar el par gasto/reintegro en un estado inconsistente.

#### Scenario: Agregar un reintegro pendiente a un gasto que no tenía

- **WHEN** el usuario abre la edición de un gasto sin reintegro y activa "Tiene reintegro" con un monto y subtipo "a cuenta", sin marcarlo como recibido
- **THEN** el sistema crea un reintegro pendiente vinculado al gasto
- **AND** el monto no entra a ningún cálculo hasta que se confirme como recibido

#### Scenario: Agregar un reintegro ya recibido en la edición

- **WHEN** el usuario edita un gasto sin reintegro, activa "Tiene reintegro" y marca "ya me lo acreditaron"
- **THEN** el reintegro se crea con `received_at` seteado y entra en los cálculos como un hecho real, sin pasar por el estado pendiente

#### Scenario: Editar el monto de un reintegro pendiente

- **WHEN** el usuario edita un gasto cuyo reintegro está pendiente y cambia el monto esperado
- **THEN** el reintegro vinculado queda con el nuevo monto esperado
- **AND** sigue pendiente (no se marca como recibido por el solo hecho de editar el monto)

#### Scenario: Quitar un reintegro pendiente

- **WHEN** el usuario edita un gasto con un reintegro pendiente y desactiva "Tiene reintegro"
- **THEN** el sistema elimina el reintegro vinculado
- **AND** el gasto queda sin reintegro, sin afectar su propio monto ni su categoría

#### Scenario: Un reintegro recibido se muestra read-only

- **WHEN** el usuario edita un gasto cuyo reintegro ya está recibido (`received_at` seteado)
- **THEN** la sección de reintegro se muestra como contexto de solo lectura
- **AND** el sistema no ofrece editar el monto/subtipo/cuenta ni quitar el reintegro desde este formulario

#### Scenario: Un reintegro cancelado se muestra read-only

- **WHEN** el usuario edita un gasto cuyo reintegro está cancelado (`cancelled_at` seteado)
- **THEN** la sección de reintegro se muestra como contexto de solo lectura, sin permitir editarlo ni quitarlo desde este formulario

#### Scenario: Agregar un reintegro a una compra en cuotas se vincula a la madre

- **WHEN** el usuario edita una compra en cuotas (madre) y agrega un reintegro
- **THEN** el reintegro se vincula a la **madre** de la compra, no a una cuota hija

#### Scenario: Reintegro en resumen sobre cuotas cae en el período de la primera cuota

- **WHEN** el usuario agrega, al editar una compra en cuotas, un reintegro con subtipo "en resumen"
- **THEN** el reintegro se imputa al período de la **primera cuota** (el de la fecha de compra), sin pedir un período

#### Scenario: El reintegro de un gasto compartido hereda el split

- **WHEN** el usuario agrega o edita un reintegro sobre un gasto compartido de su hogar
- **THEN** el reintegro hereda el mismo split del hogar en una única fila, para que la deuda derivada lo netee

#### Scenario: Descompartir el gasto quita el split del reintegro

- **WHEN** el usuario, en la misma edición, descomparte un gasto que tenía un reintegro pendiente compartido
- **THEN** el reintegro deja de tener el split heredado, en consistencia con el gasto ya no compartido
