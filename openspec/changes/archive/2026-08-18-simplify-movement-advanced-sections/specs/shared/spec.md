## MODIFIED Requirements

### Requirement: El usuario puede marcar un gasto como compartido con un split por porcentaje

El sistema SHALL permitir, mediante un toggle en el formulario de gasto, marcar un `expense` (cuenta cash/bank o tarjeta de crédito) como compartido. Un gasto compartido es una transacción **real** que impacta el saldo de quien paga, persistida con `is_shared = true` y `household_id`, más un reparto en `shared_expense_split` (una fila por miembro con su porcentaje y su monto asignado). El toggle solo está disponible si el usuario tiene un hogar activo con dos miembros. Los porcentajes SHALL sumar exactamente 100, cada uno SHALL estar entre **0 y 100**, y todos los miembros del hogar SHALL estar listados. Un porcentaje de **0** para un miembro es válido y significa que el gasto corresponde **íntegramente al otro miembro** (el pagador lo adelanta): no genera consumo propio del pagador y el otro le queda debiendo el total.

El control de reparto SHALL ofrecer los repartos frecuentes como **atajos de un gesto** —**Mitad** (50/50), **70/30**, **75/25** (los porcentajes son *tu parte*) y **Todo suyo** (el gasto es íntegramente del otro; fija `{pagador: 0, otro: 100}`)— más un disparador **"Otro"** que revela un editor de **porcentaje libre** (tu parte editable con el teclado del sistema; la del otro se calcula sola y se muestra no editable). El caso "lo pagué yo pero es 100% del otro" SHALL alcanzarse mediante el atajo **"Todo suyo"**: NO SHALL existir un toggle dedicado aparte para ese caso. NO SHALL ofrecerse un atajo "todo mío" (100% del pagador): un gasto 100% propio no se marca como compartido (se alcanza con "Otro" si hiciera falta). En **mobile**, el reparto SHALL visualizarse con una **barra proporcional Vos / [otro integrante]** —el nombre lo trae el registro de Hogar, no se escribe—, que puede mostrar porcentajes o montos. Los atajos y el editor SHALL estar disponibles tanto en el alta como en la edición. La presentación mobile de este control y su paridad entre web-mobile y nativo la fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile» de la capability `transactions`.

El split **por defecto del hogar** NO forma parte de esta relajación: su editor SHALL seguir acotado a `1..99` (el 0/100 es una decisión por-gasto, no la norma del hogar) y NO SHALL exponer el atajo "Todo suyo".

#### Scenario: Gasto compartido cash creado con split

- **WHEN** un usuario con hogar activo registra un gasto cash y activa "Compartir" con un split (ej. 50·50)
- **THEN** el sistema inserta la transacción con `type='expense'`, `is_shared=true` y `household_id`, impacta el saldo de la cuenta del pagador, e inserta una fila por miembro en `shared_expense_split`
- **AND** la suma de `amount_assigned` de los splits es igual al `amount` de la transacción

#### Scenario: Gasto que paga el usuario pero corresponde 100% al otro

- **WHEN** un usuario registra un gasto compartido y toca el atajo "Todo suyo"
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
- **AND** no se ofrece el atajo "Todo suyo" (0/100) en esa superficie
