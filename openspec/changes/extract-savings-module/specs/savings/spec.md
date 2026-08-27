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

### Requirement: La jerarquía del módulo no cambia con el ancho

Guardado total es el bloque padre; «Sin destino» y los propósitos son su desglose. En responsive puede
cambiar la cantidad de columnas, nunca la jerarquía. Si hay dos columnas, van dentro del desglose: la
card del total no comparte fila con nada.

#### Scenario: El mismo orden en los tres tamaños

- **WHEN** el usuario abre el módulo en teléfono, tablet o desktop
- **THEN** lee, en este orden: el total, sus acciones, y el desglose
- **AND** la card del total ocupa todo el ancho en los tres
- **AND** lo único que cambia con el ancho es cuántas columnas tiene la grilla de propósitos

#### Scenario: El panel lateral no sube nada al nivel del total

- **WHEN** el usuario abre el detalle de un propósito en desktop
- **THEN** el total sigue arriba, a todo el ancho
- **AND** ningún propósito queda al lado del total

### Requirement: Ningún monto se corta, y el quiebre lo decide el contenido

En toda fila del módulo que combine texto y plata, el que cede es el texto. Un monto nunca se achica,
nunca se parte y nunca se corta — ni por el borde de su contenedor ni por debajo de otro control.

Cuando el texto ya cedió todo lo que podía y el monto sigue sin entrar, la fila **se parte en dos
líneas**: el rótulo arriba, los montos abajo, alineados a la derecha para que la columna de números
siga siendo una columna.

El quiebre depende del CONTENIDO —cuánto miden ese nombre y esos números—, nunca del ancho de la
pantalla: no es un breakpoint. Dos filas del mismo ancho se parten distinto si sus montos son
distintos.

El nombre trunca con puntos suspensivos, pero no por debajo de un piso que lo deje irreconocible.

#### Scenario: Ocho cifras en las dos monedas, en un teléfono de 360px

- **WHEN** el usuario tiene guardado ocho cifras en pesos y ocho cifras en dólares
- **AND** abre el módulo en un teléfono de 360px
- **THEN** la card del total muestra los dos montos completos, uno arriba del otro
- **AND** el divisor entre las dos monedas se dibuja horizontal, entre ellas
- **AND** ningún monto queda cortado, desbordado ni tapado por otro elemento

#### Scenario: Los mismos montos entran al lado en una pantalla ancha

- **WHEN** esos dos montos entran uno al lado del otro
- **THEN** la card los muestra en dos mitades iguales, con el divisor vertical entre ellas
- **AND** no hace falta ningún ancho de pantalla en particular: entra porque los números miden menos

#### Scenario: Un propósito de nombre largo con un monto grande

- **WHEN** el nombre y el monto no entran en una línea
- **THEN** el nombre queda arriba y el monto abajo, alineado a la derecha
- **AND** el nombre conserva un ancho mínimo que lo deja reconocible por su principio
- **AND** el monto se muestra entero

#### Scenario: «Sin destino» con su botón

- **WHEN** el monto sin destino y el botón «Destinar» no entran en la misma línea
- **THEN** el botón baja a la línea de abajo
- **AND** el monto nunca queda por debajo del botón

### Requirement: El módulo es la lectura y el overlay son los actos

El overlay no tiene vista de detalle: abre directo a lo que se tocó. La lectura —el total, el
desglose, el puente con el banco y el historial— vive en la página.

#### Scenario: Volver desde un acto cierra

- **GIVEN** el usuario entró a un propósito desde la lista del módulo
- **WHEN** toca la flecha de volver
- **THEN** el overlay se cierra
- **AND** no aparece ninguna otra lista de propósitos por detrás

#### Scenario: El puente con el banco se lee en la página

- **WHEN** el usuario quiere entender por qué su banco muestra otro número
- **THEN** encuentra la explicación al pie del módulo, plegada
- **AND** no necesita abrir ningún formulario para leerla

### Requirement: Un propósito sin plata existe y se ve

Un propósito recién creado no tiene reparto, así que no aparece en el corte por moneda. Igual existe,
y la lista lo muestra: si no, crearlo y no verlo es indistinguible de que no se haya creado.

#### Scenario: El propósito recién creado aparece

- **GIVEN** el usuario acaba de crear un propósito y no le destinó nada
- **WHEN** vuelve a la lista
- **THEN** lo ve, en cero, al final del desglose

#### Scenario: Los vacíos no compiten con los que tienen plata

- **GIVEN** hay propósitos con saldo y propósitos en cero
- **WHEN** el usuario abre el módulo
- **THEN** ve solo los que tienen saldo
- **AND** un control al pie dice cuántos hay sin saldo y los trae
- **AND** ese control los vuelve a ocultar

#### Scenario: Sin ninguno con saldo no se esconde nada

- **GIVEN** todos los propósitos están en cero
- **WHEN** el usuario abre el módulo
- **THEN** los ve a todos
- **AND** no hay ningún control de «ver sin saldo»

### Requirement: Crear un propósito acusa la creación

El acuse es la pantalla siguiente, no un toast. Una pantalla que da por sabido que el propósito existe
no acusa nada: quien cierra ahí no sabe si quedó creado, y al reintentar choca contra el nombre único.

#### Scenario: La pantalla siguiente lo dice

- **WHEN** el usuario crea un propósito desde el módulo
- **THEN** la pantalla siguiente dice que se creó y con qué nombre
- **AND** ofrece destinarle algo
- **AND** ofrece una salida explícita para no hacerlo

#### Scenario: Destinar es opcional

- **GIVEN** el usuario acaba de crear un propósito
- **WHEN** elige no destinarle nada
- **THEN** el propósito queda creado, en cero
- **AND** aparece en la lista

### Requirement: Volver a usar tiene un origen por operación

La app sugiere de dónde sale, no impone y nunca reparte sola. Si el monto supera el origen elegido,
lo dice y nombra la salida en vez de solo negar.

#### Scenario: El origen viene preseleccionado, no bloqueado

- **GIVEN** «Sin destino» tiene saldo
- **WHEN** el usuario abre volver a usar
- **THEN** «Sin destino» viene elegido
- **AND** puede cambiarlo por cualquier grupo que tenga plata en esa moneda

#### Scenario: El tope que no alcanza ofrece la salida

- **GIVEN** «Sin destino» tiene $ 60.000 y hay propósitos con plata
- **WHEN** el usuario pide $ 70.000
- **THEN** la app dice cuánto hay en «Sin destino»
- **AND** le dice que para volver a usar más elija un propósito
- **AND** no reparte la diferencia por su cuenta

#### Scenario: Sin otro origen, no se ofrece uno

- **GIVEN** no hay ningún otro grupo con saldo en esa moneda
- **WHEN** el monto supera el tope
- **THEN** el mensaje dice el tope y nada más

### Requirement: El origen preseleccionado nunca es un grupo vacío

#### Scenario: Se corre al primero que tenga plata

- **GIVEN** «Sin destino» está en cero y hay propósitos con saldo
- **WHEN** el usuario abre volver a usar desde el módulo
- **THEN** el origen elegido es uno que tiene plata
- **AND** el tope que se muestra no es cero

### Requirement: Un nombre de propósito con espacios de más se acepta

#### Scenario: El espacio se absorbe, no se rechaza

- **WHEN** el usuario crea un propósito llamado «Prueba » con un espacio al final
- **THEN** se crea, y se guarda como «Prueba»
- **AND** no aparece ningún error

#### Scenario: Un nombre de solo espacios sigue siendo inválido

- **WHEN** el usuario intenta crear un propósito con un nombre de solo espacios
- **THEN** la app lo rechaza diciendo qué pasa con el campo del nombre
- **AND** no muestra un error genérico

### Requirement: Lo escrito sobrevive a los desvíos del formulario

#### Scenario: Crear un propósito en el medio no borra el monto

- **GIVEN** el usuario escribió un monto en el formulario de guardar
- **WHEN** va a crear un propósito y vuelve
- **THEN** el monto sigue escrito
- **AND** el propósito recién creado queda elegido

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
