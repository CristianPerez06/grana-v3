# shared-recurrences Specification

## Purpose
TBD - created by archiving change add-shared-recurrences. Update Purpose after archive.
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

