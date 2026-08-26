## ADDED Requirements

### Requirement: El ahorro tiene un módulo propio, con entrada de navegación

El sistema SHALL exponer **«Ahorro e inversión»** como destino de navegación propio, alcanzable desde
el menú, con ruta propia y linkeable.

El módulo SHALL ser la **casa de la operatoria**: guardar, volver a usar, destinar, quitar destino,
crear/editar/borrar propósitos. Ninguna otra superficie SHALL alojar esos formularios.

Otras superficies SHALL poder **leer** del módulo —mostrar un número, invitar a entrar— y NO SHALL
operar sobre él. Un módulo sin ese límite no se puede ocultar, apagar ni empaquetar, y el límite se
pierde de a una fila por vez.

#### Scenario: Se llega por navegación, no por un número

- **WHEN** el usuario abre el menú
- **THEN** existe una entrada **Ahorro e inversión** que lleva al módulo
- **AND** la ruta es linkeable y recargable sin pasar por el dashboard

#### Scenario: La operatoria vive en un solo lugar

- **WHEN** el usuario quiere guardar, volver a usar o destinar
- **THEN** el formulario se abre desde el módulo
- **AND** ninguna otra pantalla ofrece esos formularios

### Requirement: El módulo muestra la foto por moneda y el bloque de guardado

El módulo SHALL mostrar, **por moneda y sin sumar ARS con USD**, una foto simple con **Para gastar** y
**Guardado**, y el bloque de guardado completo: el total, el desglose **¿Para qué?** con los
propósitos, **«Sin destino»** como resto derivado, y las acciones de guardar, volver a usar y
destinar.

El módulo NO SHALL mostrar bloques, CTAs deshabilitados ni placeholders de funcionalidad que todavía
no existe.

#### Scenario: Las dos monedas no se suman

- **GIVEN** el usuario tiene $180.000 y US$ 10 guardados
- **WHEN** abre el módulo
- **THEN** cada moneda se lee por separado
- **AND** no existe ningún total que las combine

#### Scenario: No se promete lo que no hay

- **WHEN** el usuario abre el módulo antes de que exista el plazo fijo
- **THEN** no se dibuja ningún bloque de inversiones, ni activo ni apagado
- **AND** no hay ningún control deshabilitado esperando una fase futura

## MODIFIED Requirements

### Requirement: La fila de Guardado del dashboard explica el disponible y lleva al módulo

La card de saldo SHALL conservar la fila **Guardado** en el mes corriente: es un término de la
identidad `Tenías + Entró − Se fué − Guardado = Para gastar`, y sin ella la card deja de cerrar
contra el número que tiene arriba.

La fila SHALL llevar **al módulo** y NO SHALL abrir el detalle ni los formularios. El dashboard
explica; el módulo opera.

La **tira de sugerencia post-ingreso** SHALL permanecer fuera del módulo: su valor es aparecer en el
momento en que hay plata nueva, y es una lectura que invita, no una casa.

#### Scenario: La card sigue cerrando

- **WHEN** el usuario suma los montos de la card
- **THEN** el resultado es el número de la zona oscura
- **AND** la fila de Guardado sigue siendo uno de los sumandos

#### Scenario: Tocar la fila lleva al módulo

- **WHEN** el usuario toca la fila de Guardado
- **THEN** navega al módulo **Ahorro e inversión**
- **AND** no se abre ningún overlay de detalle sobre el dashboard

### Requirement: Cuentas y Movimientos no alojan operatoria de ahorro

El detalle de una cuenta SHALL seguir contestando **ubicación**: saldo de esa cuenta y sus
movimientos. NO SHALL mostrar «Guardado» ni «disponible para gastar» atribuidos a la cuenta —una
reserva no vive en ninguna cuenta, y repartirla por banco sería inventar una imputación— ni alojar
formularios de ahorro.

Guardar y destinar SHALL seguir fuera del ledger: NO SHALL aparecer en Movimientos.

#### Scenario: La cuenta no habla de guardado

- **WHEN** el usuario abre el detalle de una cuenta
- **THEN** ve el saldo de esa cuenta y sus movimientos
- **AND** no ve ningún monto de guardado ni de disponible atribuido a esa cuenta
