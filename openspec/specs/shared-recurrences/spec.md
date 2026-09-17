# shared-recurrences Specification

## Purpose

Cubre las recurrencias de gasto compartidas con un hogar. Una regla de recurrencia de tipo `expense` puede pertenecer a un hogar de dos miembros y llevar un `default_split` por porcentaje (el "template" del reparto, cuyos porcentajes suman 100), definido **estructuralmente al alta** —como cuenta, categoría y tipo— y no editable desde el edit drawer. El estado compartido se hereda cuando la regla nace de un movimiento compartido (copia su `household_id` y arma el split desde las filas `shared_expense_split` del seed) y se propaga a cada instancia generada como snapshot (`split` propio, distinto del template, para habilitar override por instancia a futuro). Las instancias compartidas pendientes son **base caja**: no generan deuda en el hogar ni impactan el gasto hasta confirmarse; al confirmar, la instancia con `household_id` crea un gasto compartido reutilizando el alta de gasto compartido existente (`shared = { household_id, splits }`), de modo que la deuda del hogar se deriva como con cualquier gasto compartido manual. La confirmación vive únicamente en el hub de recurrencias —que sella las instancias compartidas pendientes con "Compartido"—; el módulo Compartido refleja el gasto recién al confirmar. Income y compras de tarjeta recurrentes quedan fuera de alcance.

## Requirements
### Requirement: Una regla de recurrencia de gasto puede ser compartida con un hogar

El sistema SHALL permitir que una regla de recurrencia de tipo `expense` pertenezca a un
hogar y lleve un split por porcentaje (el "template" del reparto). La regla SHALL
persistir `household_id` y un `default_split` (lista de `{ user_id, percentage }` cuyos
porcentajes suman 100). El estado compartido SHALL definirse al crear la regla y es
**estructural**: no se edita desde el edit drawer de la recurrencia (consistente con
cuenta, categoría y tipo, que ya son fijos al alta).

El toggle de compartir SHALL ofrecerse únicamente para reglas de tipo `expense` y solo
cuando el usuario pertenece a un hogar de dos miembros. Income y compras de tarjeta
recurrentes quedan fuera de alcance.

#### Scenario: Alta de regla recurrente compartida

- **WHEN** un miembro de un hogar de dos crea una recurrencia de gasto y activa "Compartir"
  con un split 50·50
- **THEN** la regla se guarda con `household_id` y `default_split = [50, 50]`

#### Scenario: Toggle de compartir oculto sin hogar de dos miembros

- **WHEN** un usuario sin hogar, o cuyo hogar tiene un solo miembro, crea una recurrencia
- **THEN** el toggle de compartir no se ofrece y la regla se crea individual

#### Scenario: Split que no suma 100 es rechazado

- **WHEN** se intenta crear una regla compartida con un split cuyos porcentajes no suman 100
- **THEN** el sistema rechaza el alta con un error de validación y no persiste la regla

#### Scenario: El estado compartido no se edita después del alta

- **WHEN** un usuario abre el edit drawer de una regla recurrente
- **THEN** los controles de compartir y de split no están presentes; el estado compartido
  permanece fijo según el alta

### Requirement: Una recurrencia creada desde un movimiento compartido hereda su split

El sistema SHALL, al crear una regla de recurrencia a partir de un movimiento existente
(seed), heredar el estado compartido del movimiento: si el movimiento es un gasto
compartido (`is_shared` con `household_id`), la regla SHALL copiar su `household_id` y
construir su `default_split` a partir de las filas `shared_expense_split` del movimiento.
Si el movimiento no es compartido, la regla SHALL quedar individual.

#### Scenario: Recurrencia desde un gasto compartido nace compartida

- **WHEN** un usuario marca un gasto como compartido 50·50 y luego lo hace recurrente
- **THEN** la regla queda con el `household_id` y el `default_split` del gasto, y cada
  instancia confirmada se registra como gasto compartido (no individual)

#### Scenario: Recurrencia desde un gasto individual queda individual

- **WHEN** un usuario hace recurrente un gasto NO compartido
- **THEN** la regla se crea sin `household_id` ni `default_split`

### Requirement: La instancia generada hereda el hogar y el split de la regla

El sistema SHALL propagar `household_id` y el split a cada instancia generada: al generar
una instancia, el `default_split` de la regla se copia como `split` de la instancia
(snapshot), de la misma forma que hoy se copia el `amount`. El modelo de datos de la
instancia SHALL soportar un `split` propio distinto del template para habilitar override
por instancia a futuro, aunque la UI para editarlo queda fuera de esta fase.

#### Scenario: Generación propaga hogar y split

- **WHEN** se genera la instancia de una regla recurrente compartida
- **THEN** la instancia queda con el mismo `household_id` y un `split` copiado del
  `default_split` de la regla

#### Scenario: Una regla individual genera instancias individuales

- **WHEN** se genera la instancia de una regla recurrente NO compartida
- **THEN** la instancia no tiene `household_id` ni `split`

### Requirement: La instancia pendiente compartida no genera deuda ni impacta el gasto

El sistema SHALL tratar las instancias recurrentes compartidas con base **caja**: mientras
una instancia esté pendiente no SHALL generar deuda en el hogar ni impactar el gasto,
idéntico al comportamiento de una recurrencia unipersonal pendiente. La deuda y el impacto
en el gasto SHALL nacer únicamente al confirmar la instancia.

#### Scenario: Instancia compartida pendiente no mueve la deuda

- **WHEN** existe una instancia recurrente compartida pendiente del mes en curso
- **THEN** la deuda del hogar no la incluye hasta que la instancia se confirme

### Requirement: Confirmar una instancia compartida crea un gasto compartido

El sistema SHALL, al confirmar una instancia recurrente con `household_id`, crear el
movimiento como gasto compartido reutilizando el alta de gasto compartido existente: el
plan de confirmación SHALL incluir `shared = { household_id, splits }` tomado del `split`
de la instancia, de modo que el movimiento resultante quede marcado `is_shared` con sus
filas de split, y la deuda del hogar se derive como con cualquier gasto compartido manual.

#### Scenario: Confirmación produce un gasto compartido con split

- **WHEN** un usuario confirma una instancia recurrente compartida 50·50 de $100.000
- **THEN** se crea un gasto `is_shared` con `household_id` y dos filas de split de $50.000
  cada una, y la deuda del hogar refleja la parte del otro miembro

#### Scenario: Confirmación de instancia individual no crea split

- **WHEN** un usuario confirma una instancia recurrente sin `household_id`
- **THEN** el gasto se crea individual, sin marca de compartido ni filas de split

### Requirement: El hub de recurrencias señala las instancias compartidas

El sistema SHALL marcar visualmente, en el hub de recurrencias pendientes ("por
confirmar"), las instancias compartidas con un sello "Compartido", de modo que el usuario
sepa antes de confirmar que el movimiento se va a repartir con el hogar. La acción de
confirmar SHALL seguir viviendo únicamente en el hub (no se fragmenta entre módulos); el
módulo Compartido refleja el gasto recién cuando la instancia se confirma (base caja).

#### Scenario: Instancia compartida pendiente muestra el sello

- **WHEN** el hub de recurrencias lista una instancia pendiente con `household_id`
- **THEN** la fila muestra un sello "Compartido"; una instancia individual no lo muestra

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
