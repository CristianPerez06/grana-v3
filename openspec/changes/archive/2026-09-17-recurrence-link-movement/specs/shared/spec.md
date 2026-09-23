## MODIFIED Requirements

### Requirement: No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior

El sistema SHALL impedir **tanto el borrado como la descompartición** (`is_shared = true → false`) de un movimiento compartido cuando exista una liquidación (`settlement`) **vigente en el mismo hogar, en la misma moneda, con fecha igual o posterior** a la fecha de impacto del movimiento (`coalesce(due_date, date)`), porque en el extracto (cuenta corriente) esa liquidación quedó calculada sobre un saldo que incluía ese movimiento: borrarlo o descompartirlo reescribiría en silencio un saldo ya liquidado. La fecha de la liquidación es la de su movimiento de pagador (`payer_movement_id`). Recíprocamente, un movimiento **posterior a toda liquidación** de su moneda SHALL poder borrarse/descompartirse libremente (no afecta lo ya saldado), y una liquidación en una moneda NO SHALL bloquear un movimiento de la otra.

**SÓLO UNA LIQUIDACIÓN VIGENTE PROTEGE ALGO.** Las guardas SHALL considerar vigentes las liquidaciones `completed` y `pending_receipt` —en esta última la plata ya salió de la cuenta del pagador aunque el receptor todavía no haya asignado la suya—, y NO SHALL considerar vigentes ni una liquidación **correctamente revertida** (`reversed`, con su contraasiento presente) ni la fila `contra` que la neutraliza.

Una liquidación revertida no saldó nada: junto con su contraasiento suma cero. Seguir bloqueando por ella no protege ningún saldo y, peor, **convierte en falso el consejo que las guardas obligan a dar**. Revertir conserva la original y agrega un contraasiento fechado el día de la reversión, así que con el predicado anterior revertir no destrababa nada y además agregaba un bloqueo más nuevo que cualquier movimiento pasado: al usuario se le pedía hacer algo irreversible que lo dejaba igual de trabado, o peor. Una salida que no funciona es peor que no ofrecer ninguna.

Esto NO SHALL cambiar **cómo se calcula la deuda**: el original revertido y su contraasiento siguen contando los dos y siguen cancelándose entre sí. Lo único que cambia es qué considera la guarda que hay para proteger.

El mensaje que la aplicación muestra al dispararse una guarda SHALL nombrar **la acción disponible para el estado de la liquidación que bloquea**, y NO SHALL decir siempre «revertir»: una liquidación **completada** se revierte con un contraasiento; una **pendiente de asignación** se cancela, borrando la pata del pagador —su propio movimiento—, lo que retira la fila entera. La operación de reversión sólo acepta liquidaciones completadas, de modo que indicar «revertir» sobre una pendiente manda al usuario a algo que el sistema no ofrece para ese estado.

Cancelar una pendiente SHALL ser potestad de quien la registró. Cuando la que bloquea la registró el otro miembro, el mensaje SHALL decir que tiene que cancelarla esa persona, y NO SHALL pedirle al usuario una acción que no puede ejecutar.

Cuando más de una liquidación vigente bloquea, el mensaje SHALL decirlo, para que resolver una y volver a chocar con la siguiente no se lea como que la primera no sirvió.

En todos los casos el consejo SHALL ser cierto: la acción indicada SHALL destrabar efectivamente la operación. El sistema NO SHALL indicar una salida que deje al usuario en el mismo lugar después de seguirla.

Ambas guardas SHALL vivir en la base: un trigger `BEFORE DELETE` y un trigger `BEFORE UPDATE` (acotado a la transición de `is_shared` a `false`) sobre `transactions`, evaluados **por fila**, de modo que solo se guarden las filas que **portan splits** (cada cuota hija por su propia fecha de impacto; la madre de cuotas y las patas `settlement`, que no portan splits, quedan exentas). Las guardas SHALL lanzar un `SQLSTATE` distinguible (`GRN01`) que la capa de aplicación mapea al mensaje explicativo descripto arriba, resuelto según el estado de la liquidación que bloquea.

Las dos guardas SHALL compartir el mismo criterio de vigencia. Corregir una sola dejaría el sistema contestando distinto a dos preguntas que este requirement define juntas.

#### Scenario: Borrado bloqueado por una liquidación posterior en la misma moneda

- **WHEN** un usuario intenta borrar un gasto compartido y existe una liquidación en la misma moneda con fecha igual o posterior a la del gasto
- **THEN** la base rechaza el borrado (SQLSTATE `GRN01`) y la aplicación explica qué hay que hacer con esa liquidación según su estado

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

#### Scenario: Una liquidación revertida deja de bloquear

- **WHEN** la única liquidación que cubría un gasto compartido fue revertida y su contraasiento existe, y el usuario intenta descompartir o borrar ese gasto
- **THEN** la guarda no se dispara y la operación procede

#### Scenario: El contraasiento no bloquea por su propia fecha

- **WHEN** el contraasiento de una liquidación revertida está fechado hoy, y el usuario intenta descompartir un gasto compartido anterior
- **THEN** la guarda no se dispara por esa fila `contra`

#### Scenario: Una liquidación pendiente de asignación sigue bloqueando

- **WHEN** existe una liquidación `pending_receipt` en la misma moneda con fecha igual o posterior a la del gasto, y el usuario intenta descompartirlo
- **THEN** la guarda se dispara: la plata ya salió de la cuenta del pagador

#### Scenario: Una liquidación completada sigue bloqueando

- **WHEN** existe una liquidación `completed` en la misma moneda con fecha igual o posterior a la del gasto, y el usuario intenta descompartirlo
- **THEN** la guarda se dispara igual que antes de esta corrección

#### Scenario: Revertir una de dos liquidaciones no destraba si la otra sigue vigente

- **WHEN** dos liquidaciones cubren la fecha del gasto, el usuario revierte una y la otra sigue `completed`
- **THEN** la guarda se sigue disparando
- **AND** el mensaje dice que hay más de una liquidación bloqueando

#### Scenario: El mensaje nombra revertir ante una liquidación completada

- **WHEN** la guarda se dispara por una liquidación `completed`
- **THEN** el mensaje indica revertir esa liquidación

#### Scenario: El mensaje nombra cancelar ante una liquidación pendiente propia

- **WHEN** la guarda se dispara por una liquidación `pending_receipt` registrada por el propio usuario
- **THEN** el mensaje indica cancelar esa liquidación, no revertirla

#### Scenario: El mensaje no pide cancelar una liquidación pendiente ajena

- **WHEN** la guarda se dispara por una liquidación `pending_receipt` registrada por el otro miembro del hogar
- **THEN** el mensaje dice que esa liquidación tiene que cancelarla quien la registró

#### Scenario: Cancelar una liquidación pendiente destraba sin tocar el predicado

- **WHEN** el pagador cancela la liquidación `pending_receipt` que bloqueaba y vuelve a intentar la operación
- **THEN** la guarda no se dispara, porque la fila de liquidación ya no existe
