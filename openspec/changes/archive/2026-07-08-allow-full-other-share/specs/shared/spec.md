## MODIFIED Requirements

### Requirement: El usuario puede marcar un gasto como compartido con un split por porcentaje

El sistema SHALL permitir, mediante un toggle en el formulario de gasto, marcar un `expense` (cuenta cash/bank o tarjeta de crédito) como compartido. Un gasto compartido es una transacción **real** que impacta el saldo de quien paga, persistida con `is_shared = true` y `household_id`, más un reparto en `shared_expense_split` (una fila por miembro con su porcentaje y su monto asignado). El toggle solo está disponible si el usuario tiene un hogar activo con dos miembros. Los porcentajes SHALL sumar exactamente 100, cada uno SHALL estar entre **0 y 100**, y todos los miembros del hogar SHALL estar listados. Un porcentaje de **0** para un miembro es válido y significa que el gasto corresponde **íntegramente al otro miembro** (el pagador lo adelanta): no genera consumo propio del pagador y el otro le queda debiendo el total.

Para el caso extremo "lo pagué yo pero es 100% del otro", el formulario SHALL ofrecer un **toggle dedicado** (rotulado en términos de la acción, ej. "Lo pagué yo, pero es 100% de {nombre}") que fija el split en `{pagador: 0, otro: 100}` y oculta el campo de porcentaje libre; al desactivarlo, vuelve el editor de reparto normal (`1..99`). El toggle SHALL estar disponible tanto en el alta como en la edición.

El split **por defecto del hogar** NO forma parte de esta relajación: su editor SHALL seguir acotado a `1..99` (el 0/100 es una decisión por-gasto, no la norma del hogar).

#### Scenario: Gasto compartido cash creado con split

- **WHEN** un usuario con hogar activo registra un gasto cash y activa "Compartir" con un split (ej. 50·50)
- **THEN** el sistema inserta la transacción con `type='expense'`, `is_shared=true` y `household_id`, impacta el saldo de la cuenta del pagador, e inserta una fila por miembro en `shared_expense_split`
- **AND** la suma de `amount_assigned` de los splits es igual al `amount` de la transacción

#### Scenario: Gasto que paga el usuario pero corresponde 100% al otro

- **WHEN** un usuario registra un gasto compartido y activa el toggle "es 100% de {nombre}"
- **THEN** el split queda `{pagador: 0%, otro: 100%}`, el saldo de la cuenta del pagador baja por el total, y se inserta la fila del otro con `amount_assigned` = total (y la del pagador con `0`)
- **AND** la deuda derivada refleja que el otro le debe el total al pagador
- **AND** el gasto NO aparece en el desglose "en qué se fue" del pagador (su parte es 0) y SÍ aparece completo en el del otro miembro

#### Scenario: Toggle oculto sin hogar de dos miembros

- **WHEN** un usuario sin hogar, o con un hogar de un solo miembro, abre el formulario de gasto
- **THEN** el toggle "Compartir" no se ofrece

#### Scenario: Porcentajes inválidos son rechazados

- **WHEN** el usuario confirma un gasto compartido cuyos porcentajes no suman exactamente 100, o algún porcentaje es negativo o mayor a 100
- **THEN** el sistema rechaza el input con error de validación

#### Scenario: El split por defecto del hogar no admite 0/100

- **WHEN** un usuario edita el split por defecto del hogar en `/shared/settings`
- **THEN** el editor lo mantiene acotado a `1..99` (el complemento del otro entre `99..1`)
