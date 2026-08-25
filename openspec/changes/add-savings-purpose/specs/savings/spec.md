## ADDED Requirements

### Requirement: El guardado puede llevar un propósito, y el propósito es solo una etiqueta

El sistema SHALL permitir asociar cada decisión de guardar o volver a usar a un **propósito**: un
nombre y un ícono, propiedad del usuario, registrados en `savings_purpose` con RLS por `user_id`.

Un propósito NO SHALL tener monto objetivo, fecha ni progreso: eso es una **meta** y no pertenece a
esta capability todavía. Un propósito NO SHALL tener moneda — la tienen las reservas que cuelgan de
él, y un mismo propósito SHALL poder acumular en ARS y en USD sin que esas cifras se sumen nunca.

El propósito NO SHALL participar de ningún número del dashboard. `get_available_sums` y
`get_reserve_flow_sums` SHALL devolver exactamente lo mismo con propósitos que sin ellos.

#### Scenario: El propósito no mueve ningún número

- **WHEN** el usuario etiqueta un guardado de $200.000 como "Japón"
- **THEN** el disponible, el guardado total y el flujo del mes quedan sin cambios
- **AND** ningún saldo de cuenta cambia

#### Scenario: Un propósito acumula en dos monedas sin sumarlas

- **WHEN** el usuario guarda $300.000 y US$ 500 en el propósito "Japón"
- **THEN** el detalle muestra $300.000 en la vista de pesos y US$ 500 en la de dólares
- **AND** en ningún lugar aparece un único total que combine las dos

---

### Requirement: Las reservas sin propósito son un grupo con las mismas reglas

El sistema SHALL tratar `purpose_id = NULL` como el grupo **«Sin destino»**, no como una ausencia de
dato. Ese grupo SHALL estar sujeto al mismo piso que cualquier propósito.

Las reservas creadas antes de esta capability SHALL quedar con `purpose_id` en nulo y SHALL leerse
como «Sin destino», sin backfill ni valor por defecto inventado. El sistema NO SHALL obligar al
usuario a elegir un propósito para guardar.

#### Scenario: Lo guardado antes de los propósitos sigue leyéndose

- **WHEN** el usuario tenía $190.000 guardados sin propósito
- **THEN** el detalle los muestra agrupados como «Sin destino»
- **AND** el total guardado sigue siendo $190.000

---

### Requirement: El piso de volver a usar es por propósito y moneda

El sistema SHALL impedir que el guardado de un propósito quede **negativo**, aunque el total guardado
de esa moneda cubra el monto pedido. El límite SHALL leerse del servidor **dentro de la mutación**,
desde una definición única en SQL (`get_purpose_sums`), y NO SHALL recomponerse sumando filas en el
cliente.

El **tope de guardar** NO SHALL volverse por propósito: sigue siendo el disponible de la moneda. Un
propósito no tiene objetivo, así que no hay contra qué toparlo.

Cuando el rechazo sea por el piso de un propósito con nombre, el mensaje SHALL **nombrar el propósito**
y decir su monto — el usuario está mirando un total mayor en la misma pantalla, y un mensaje genérico
se lee como un error del sistema.

#### Scenario: El total alcanza pero el propósito no

- **GIVEN** "Emergencia" con $150.000 y «Sin destino» con $40.000
- **WHEN** el usuario intenta volver a usar $60.000 desde «Sin destino»
- **THEN** la operación se rechaza indicando el límite de $40.000
- **AND** no se registra ninguna fila

#### Scenario: El mensaje nombra el propósito

- **WHEN** el usuario intenta volver a usar $200.000 desde "Emergencia", que tiene $150.000
- **THEN** el mensaje dice que no puede volver a usar más de lo que tiene guardado **en Emergencia**,
  con el monto

#### Scenario: Guardar no se topea por propósito

- **GIVEN** "Emergencia" con $150.000 y un disponible de $4.000.000
- **WHEN** el usuario guarda $3.000.000 en "Emergencia"
- **THEN** la operación se acepta

---

### Requirement: Borrar un propósito no cambia ningún número

El sistema SHALL devolver a «Sin destino» las reservas de un propósito borrado. Borrar un propósito NO
SHALL borrar ninguna reserva, NO SHALL modificar el total guardado y NO SHALL modificar el disponible.

Antes de borrar, el sistema SHALL informar cuánto dinero se reasigna, **por moneda**.

#### Scenario: La plata sobrevive al borrado de su etiqueta

- **GIVEN** el propósito "Japón" con $300.000 guardados
- **WHEN** el usuario borra el propósito
- **THEN** los $300.000 pasan a «Sin destino»
- **AND** el total guardado y el disponible quedan sin cambios

#### Scenario: El borrado se avisa con el número

- **WHEN** el usuario pide borrar un propósito que tiene plata
- **THEN** se le informa el monto por moneda y que esa plata vuelve a «Sin destino»

---

### Requirement: Los nombres de propósito no se repiten dentro de un usuario

El sistema SHALL rechazar un propósito cuyo nombre coincida con otro del mismo usuario ignorando
mayúsculas y espacios de borde. Dos usuarios distintos SHALL poder tener cada uno un propósito con el
mismo nombre. El sistema SHALL rechazar un nombre vacío.

#### Scenario: El mismo nombre en otra caja no crea un segundo propósito

- **GIVEN** el usuario ya tiene "Emergencia"
- **WHEN** intenta crear "emergencia" o "  EMERGENCIA  "
- **THEN** la operación se rechaza

---

### Requirement: Los propósitos sugeridos no son filas del sistema

El sistema SHALL ofrecer propósitos sugeridos como **copy**, no como filas compartidas. Elegir una
sugerencia SHALL crear un propósito **propiedad del usuario**, renombrable y borrable, con el nombre
precargado y editable en el momento.

El sistema NO SHALL ofrecer una sugerencia cuyo nombre el usuario ya tiene.

#### Scenario: Una sugerencia elegida es del usuario

- **WHEN** el usuario toca la sugerencia "Viaje"
- **THEN** se crea un propósito suyo llamado "Viaje", con el nombre editable
- **AND** puede renombrarlo a "Japón" sin restricciones

#### Scenario: No se sugiere lo que ya existe

- **GIVEN** el usuario ya tiene un propósito llamado "Viaje"
- **WHEN** abre el selector de propósitos
- **THEN** "Viaje" no aparece entre las sugerencias

---

### Requirement: El propósito de origen se hereda del contexto

Al volver a usar plata desde un propósito, el sistema NO SHALL pedir que se elija el origen: SHALL
heredarlo del grupo desde el que se abrió la operación.

Cuando la operación se abra desde el total y exista **más de un grupo con saldo**, el sistema SHALL
pedir primero de cuál sale, mostrando los montos. El sistema NO SHALL repartir el monto entre varios
propósitos automáticamente.

#### Scenario: Volver a usar desde un propósito no pregunta

- **WHEN** el usuario abre "Volver a usar" desde el grupo "Emergencia"
- **THEN** no se muestra ningún selector de propósito
- **AND** la fila registrada lleva el propósito "Emergencia"

#### Scenario: Desde el total con varios grupos, se elige

- **GIVEN** el usuario tiene saldo en "Emergencia" y en «Sin destino»
- **WHEN** abre "Volver a usar" desde el total
- **THEN** primero elige de qué grupo sale, con los montos a la vista

---

### Requirement: El propósito se reparte por monto, no se ata a un movimiento

El sistema SHALL permitir **destinar** un monto de lo guardado sin destino hacia un propósito, y
**quitarle el destino** para devolverlo al resto. NO SHALL asociar un propósito a una fila puntual del historial de
guardados: el dinero guardado es fungible y una reserva vieja puede haber sido usada en parte.

Destinar y quitar destino NO SHALL cambiar el total guardado, NO SHALL cambiar el disponible y NO SHALL mover
dinero entre cuentas: lo que entra en un grupo sale de otro.

El verbo de esta acción NO SHALL ser "apartar", que en la app ya significa **guardar**, ni ninguno que
sugiera que el dinero cambia de lugar.

«Sin destino» SHALL derivarse como **el resto** —lo guardado menos lo repartido— y NO SHALL
almacenarse.

#### Scenario: Repartir no mueve ningún total

- **GIVEN** $190.000 guardados, nada repartido
- **WHEN** el usuario destina $150.000 a "Japón"
- **THEN** el total guardado sigue siendo $190.000 y el disponible no cambia
- **AND** "Japón" muestra $150.000 y «Sin destino» $40.000

#### Scenario: Se puede repartir cualquier monto

- **GIVEN** un historial cuyos guardados fueron de $300.000, $600.000 y $200.000
- **WHEN** el usuario quiere decir que $150.000 son para "Japón"
- **THEN** puede hacerlo, sin depender de que exista un movimiento de ese monto

#### Scenario: Quitar el destino devuelve al resto sin sacar del guardado

- **WHEN** el usuario le quita el destino a $50.000 de "Japón"
- **THEN** «Sin destino» sube $50.000 y el total guardado no cambia
- **AND** el disponible no cambia

---

### Requirement: Lo repartido nunca supera lo guardado

El sistema SHALL garantizar, **en la base de datos**, que por moneda la suma repartida entre
propósitos nunca supere el total guardado, y que ningún propósito quede con un reparto negativo. La
garantía NO SHALL depender de que cada camino de escritura la recuerde.

La regla SHALL exigirse también cuando el usuario **vuelve a usar** dinero: retirar del guardado
puede romper el invariante sin tocar ninguna fila de reparto.

#### Scenario: No se puede apartar más de lo guardado

- **GIVEN** $190.000 guardados
- **WHEN** se intenta destinar $200.000 a un propósito
- **THEN** la operación se rechaza

#### Scenario: No se puede volver a usar lo que está repartido

- **GIVEN** $190.000 guardados, de los cuales $150.000 están apartados para "Japón"
- **WHEN** el usuario intenta volver a usar $100.000 sin tocar el reparto
- **THEN** la operación se rechaza
- **AND** volver a usar $40.000 sí se acepta

---

### Requirement: Guardar con un propósito es un solo acto

Cuando el usuario guarde indicando un propósito, el sistema SHALL registrar la reserva y su reparto
**de forma atómica**: o quedan las dos cosas, o no queda ninguna. NO SHALL quedar dinero guardado sin
el reparto que el usuario pidió.

#### Scenario: Si el reparto no se puede registrar, tampoco el guardado

- **WHEN** se guarda con un propósito que no pertenece al usuario
- **THEN** la operación se rechaza entera y no queda ninguna reserva registrada

---

### Requirement: Solo se puede repartir hacia un propósito propio

El sistema SHALL verificar contra la base que el propósito indicado pertenece al usuario, y NO SHALL
apoyarse únicamente en la validación de forma del identificador ni en el rol con el que se ejecute la
operación.

#### Scenario: Un propósito ajeno se rechaza

- **WHEN** se intenta guardar o repartir usando el propósito de otro usuario
- **THEN** la operación se rechaza y no se registra ninguna fila
