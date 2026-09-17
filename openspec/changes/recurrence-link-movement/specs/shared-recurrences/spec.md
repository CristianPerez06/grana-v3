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

### Requirement: Desvincular revierte la conversión a compartido, y cuando no puede lo dice

Desvincular un movimiento de una ocurrencia compartida SHALL deshacer también la conversión, **cuando
la vinculación la produjo**: el movimiento SHALL volver a ser personal y la deuda del hogar SHALL
volver a donde estaba. Si el movimiento **ya era compartido** antes de vincularse, la conversión no
ocurrió y desvincular SHALL limitarse a romper el vínculo. La reversión y la desvinculación SHALL ser
atómicas, con la misma garantía de base de datos que su operación inversa.

**DESVINCULAR NUNCA DEJA AL USUARIO SIN SALIDA.** El sistema impide devolver a personal un gasto
compartido cubierto por una liquidación posterior del hogar, porque esa liquidación se calculó sobre
un saldo que lo incluía. Cuando esa guarda rechaza la reversión, el sistema SHALL **romper el vínculo
igual** y dejar el movimiento compartido, explicando que sigue siéndolo porque la deuda que generó ya
fue saldada. La ocurrencia SHALL volver a *sin resolver* en ese caso igual que en cualquier otro: es
lo que el usuario fue a buscar, y negárselo por completo lo dejaría con un vencimiento resuelto por un
movimiento que sabe que no corresponde.

Esta rama existe con independencia de lo que se valide al vincular: la liquidación puede registrarse
**después** de la vinculación, de modo que ninguna comprobación previa puede evitarla.

El sistema NO SHALL indicarle al usuario que revierta esa liquidación para destrabar la operación,
salvo que revertirla efectivamente la destrabe. Una salida que no funciona es peor que no ofrecer
ninguna: manda al usuario a hacer algo irreversible que lo deja igual de trabado.

Cuando la situación ya es conocida al momento de vincular —existe una liquidación que cubriría la
fecha del movimiento—, la pantalla que pide confirmación para convertir SHALL advertirlo antes, de
modo que el usuario sepa que esa conversión no se va a poder revertir.

#### Scenario: Desvincular un movimiento convertido lo devuelve a personal

- **WHEN** el usuario desvincula un movimiento que la vinculación había convertido en compartido, sin
  liquidaciones posteriores en el hogar
- **THEN** el movimiento vuelve a ser personal, sin reparto
- **AND** la deuda del hogar vuelve a lo que era antes de vincular
- **AND** el movimiento sigue existiendo

#### Scenario: Desvincular un movimiento que ya era compartido no toca el reparto

- **WHEN** el usuario desvincula un movimiento que ya era compartido antes de vincularse
- **THEN** el vínculo se rompe
- **AND** el movimiento conserva su reparto y la deuda del hogar no cambia

#### Scenario: Una liquidación posterior deja el movimiento compartido, sin trabar la desvinculación

- **WHEN** el usuario desvincula un movimiento convertido y existe una liquidación del hogar en esa
  moneda con fecha igual o posterior a la del movimiento
- **THEN** el vínculo se rompe y la ocurrencia queda *sin resolver*
- **AND** el movimiento sigue existiendo y sigue siendo compartido
- **AND** el sistema explica que sigue compartido porque la deuda que generó ya fue saldada
- **AND** NO le indica al usuario revertir esa liquidación

#### Scenario: La conversión avisa cuando ya se sabe que no va a poder revertirse

- **WHEN** el usuario va a convertir un movimiento personal cuya fecha ya está cubierta por una
  liquidación del hogar
- **THEN** la pantalla de confirmación advierte que esa conversión no se va a poder revertir
