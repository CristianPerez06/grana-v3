## ADDED Requirements

### Requirement: Vincular un movimiento a una regla compartida no altera la deuda en silencio

Cuando la regla es compartida, vincular un movimiento existente puede cambiar la deuda entre los
miembros del hogar. El sistema NO SHALL hacerlo de forma implícita. SHALL distinguir tres casos, y
sólo dos SHALL aceptarse:

- **El movimiento ya tiene un reparto compatible** con el de la regla — mismo hogar y mismos
  porcentajes por miembro. SHALL vincularse directamente, sin tocar el reparto.
- **El movimiento es personal**, sin reparto. El sistema SHALL explicar que va a convertirse en gasto
  compartido con el reparto de la regla y SHALL pedir **confirmación explícita** antes de hacerlo. Sin
  esa confirmación NO SHALL vincularse ni convertirse.
- **El movimiento ya es compartido con otro hogar o con otro reparto.** NO SHALL ofrecerse como
  candidato.

El tercer caso se excluye en vez de convertirse porque reemplazar un reparto existente destruye una
deuda que el otro miembro ya ve, y deshacer eso exigiría persistir y restaurar un estado compartido
arbitrario. Excluirlo cuesta un candidato menos en una lista. Si el usuario realmente quiere ese
movimiento ahí, SHALL poder corregir su reparto primero y vincularlo después.

**La conversión y la vinculación SHALL ser una sola operación atómica.** Un movimiento convertido a
compartido pero no vinculado deja la deuda del hogar movida por algo que el usuario no aprobó. La
atomicidad SHALL darla la base de datos, no una secuencia de pasos que se compensan al fallar: una
compensación también puede fallar, y el estado que deja es precisamente el que esta requirement
prohíbe.

El sistema SHALL registrar si la vinculación **convirtió** el movimiento, porque de eso depende qué
hace desvincular y ese dato no se puede reconstruir después.

#### Scenario: Un reparto compatible se vincula sin tocar nada

- **WHEN** el usuario vincula a una regla compartida un movimiento que ya está compartido en el mismo
  hogar y con los mismos porcentajes
- **THEN** la ocurrencia queda resuelta
- **AND** el reparto del movimiento no cambia
- **AND** la deuda del hogar no cambia

#### Scenario: Convertir un movimiento personal pide confirmación explícita

- **WHEN** el usuario elige un movimiento personal como candidato de una regla compartida
- **THEN** el sistema explica que el movimiento va a pasar a ser compartido con el reparto de la regla
- **AND** no lo convierte ni lo vincula hasta que el usuario lo confirma

#### Scenario: Cancelar la conversión no deja nada a medias

- **WHEN** el usuario no confirma la conversión
- **THEN** el movimiento sigue siendo personal
- **AND** la ocurrencia sigue sin resolver

#### Scenario: Un movimiento compartido con otro reparto no se ofrece

- **WHEN** existe un movimiento compartido con un reparto distinto al de la regla, dentro de la
  ventana de candidatos
- **THEN** ese movimiento no aparece en la lista de candidatos

### Requirement: Desvincular revierte la conversión a compartido, o no hace nada

Desvincular un movimiento de una ocurrencia compartida SHALL deshacer también la conversión,
**cuando la vinculación la produjo**: el movimiento SHALL volver a ser personal y la deuda del
hogar SHALL volver a donde estaba. Si el movimiento **ya era compartido** antes de vincularse,
la conversión no ocurrió y desvincular SHALL limitarse a romper el vínculo.

**LAS DOS COSAS VAN JUNTAS O NO VA NINGUNA.** Romper el vínculo y revertir la conversión SHALL
completarse en una sola operación atómica. Si la reversión no se puede realizar, el sistema NO
SHALL romper el vínculo igual: SHALL dejar el estado **exactamente como estaba** y explicar qué
hay que resolver primero.

Un deshacer parcial es peor que no deshacer. La vinculación equivocada convirtió un gasto
personal en deuda para el otro miembro del hogar; soltar el vínculo y dejar el gasto compartido
corrige lo que el usuario ve y conserva lo que le cuesta plata a otra persona, sin que nadie
vuelva a mirarlo. El usuario cree que deshizo y no deshizo.

**LO QUE PUEDE IMPEDIR LA REVERSIÓN ES UNA LIQUIDACIÓN VIGENTE, Y SÓLO ESA.** El sistema impide
devolver a personal un gasto compartido cubierto por una liquidación posterior del hogar, porque
esa liquidación se calculó sobre un saldo que lo incluía.

**EL MENSAJE SHALL NOMBRAR LA ACCIÓN QUE REALMENTE ESTÁ DISPONIBLE**, que no es la misma en los
dos estados y NO SHALL decirse siempre «revertir»:

- Una liquidación **pendiente de asignación** se **cancela**: sólo existe la pata del pagador, que
  es su propio movimiento, y borrarla retira la liquidación entera. El sistema SHALL indicar
  cancelarla.
- Una liquidación **completada** se **revierte** con un contraasiento, porque la pata del receptor
  es un movimiento de otro usuario. El sistema SHALL indicar revertirla.

Decir «revertí esa liquidación» sobre una pendiente manda al usuario a una operación que el
sistema no ofrece para ese estado.

**Cancelar una liquidación pendiente SHALL ser potestad de quien la registró.** Cuando la que
bloquea es una pendiente registrada por el **otro** miembro, el sistema NO SHALL pedirle al
usuario que haga algo que no puede hacer: SHALL decir que esa liquidación tiene que cancelarla
quien la registró.

**Cuando bloquea más de una, el sistema SHALL decirlo.** Resolver una y volver a chocar con la
siguiente, sin aviso, se lee como que la primera no sirvió de nada.

El consejo, sea cual sea, SHALL ser cierto: una liquidación correctamente revertida NO SHALL
seguir impidiendo la operación (ver la capability `shared`), y una cancelada desaparece con su
fila. El sistema NO SHALL ofrecer una salida que deje al usuario en el mismo lugar después de
seguirla.

Cuando la situación ya es conocida al momento de vincular —existe una liquidación vigente que
cubriría la fecha del movimiento—, la pantalla que pide confirmación para convertir SHALL
advertirlo antes, nombrando también ahí la acción que corresponde a su estado.

#### Scenario: Desvincular un movimiento convertido lo devuelve a personal

- **WHEN** el usuario desvincula un movimiento que la vinculación había convertido en compartido,
  sin liquidaciones vigentes que lo cubran
- **THEN** el movimiento vuelve a ser personal, sin reparto
- **AND** la deuda del hogar vuelve a lo que era antes de vincular
- **AND** el movimiento sigue existiendo
- **AND** la ocurrencia queda *sin resolver*

#### Scenario: Desvincular un movimiento que ya era compartido no toca el reparto

- **WHEN** el usuario desvincula un movimiento que ya era compartido antes de vincularse
- **THEN** el vínculo se rompe
- **AND** el movimiento conserva su reparto y la deuda del hogar no cambia

#### Scenario: Una liquidación vigente conserva el estado anterior por completo

- **WHEN** el usuario desvincula un movimiento convertido y existe una liquidación **vigente** del
  hogar en esa moneda con fecha igual o posterior a la del movimiento
- **THEN** el movimiento sigue compartido **y el vínculo sigue en pie**
- **AND** la ocurrencia sigue resuelta
- **AND** NO deja el movimiento compartido con el vínculo roto

#### Scenario: Una liquidación completada se indica revertir

- **WHEN** la liquidación que bloquea está **completada**
- **THEN** el sistema indica revertir esa liquidación
- **AND** NO indica cancelarla

#### Scenario: Una liquidación pendiente propia se indica cancelar

- **WHEN** la liquidación que bloquea está **pendiente de asignación** y la registró el propio
  usuario
- **THEN** el sistema indica cancelar esa liquidación
- **AND** NO indica revertirla

#### Scenario: Una liquidación pendiente del otro miembro se explica sin pedir lo imposible

- **WHEN** la liquidación que bloquea está pendiente de asignación y la registró el **otro** miembro
  del hogar
- **THEN** el sistema explica que esa liquidación tiene que cancelarla quien la registró
- **AND** NO le pide al usuario que la cancele ni que la revierta

#### Scenario: Con varias liquidaciones bloqueando, el sistema lo dice

- **WHEN** más de una liquidación vigente cubre la fecha del movimiento
- **THEN** el sistema explica que hay más de una y que resolver una sola no alcanza

#### Scenario: Resolver la liquidación destraba la desvinculación

- **WHEN** el usuario revierte la liquidación completada —o cancela la pendiente propia— que impedía
  desvincular, y vuelve a intentarlo
- **THEN** la desvinculación se completa: el movimiento vuelve a ser personal y el vínculo se rompe

#### Scenario: La conversión avisa cuando ya hay una liquidación que la cubriría

- **WHEN** el usuario va a convertir un movimiento personal cuya fecha ya está cubierta por una
  liquidación vigente del hogar
- **THEN** la pantalla de confirmación advierte que para deshacer esa conversión va a tener que
  resolver esa liquidación primero
- **AND** nombra la acción que corresponde a su estado
