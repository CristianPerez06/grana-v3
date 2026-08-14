## Purpose

Define el primitivo de selección de fecha de la app nativa (`DateField`): cómo se presenta el calendario —siempre **sobre** el layout, nunca dentro de él—, la divergencia idiomática entre iOS y Android, la regla de que todos los campos de fecha de la nativa lo usan, el contrato de valor ISO `YYYY-MM-DD` sin desfase de zona y la API controlada para pickers mutuamente excluyentes. Es la contraparte nativa de `web-date-picker`, que dejó ese scope explícitamente afuera.

## ADDED Requirements

### Requirement: El picker se presenta sobre el layout y no altera el host

El calendario de un campo de fecha nativo SHALL presentarse **sobre** la pantalla, como un overlay, y NO SHALL participar del flujo de layout de la pantalla que lo aloja. Abrir o cerrar el picker NO SHALL alterar el alto, el ancho ni la posición de la fila, card o pantalla que contiene el campo: los elementos vecinos —incluidos los que están al lado del campo en una fila horizontal— SHALL permanecer exactamente donde estaban.

El trigger del campo SHALL conservar su tamaño mientras el picker está abierto, tanto en su variante bordeada (campo standalone) como en su variante `bare` (fila dentro de una card agrupada).

#### Scenario: Abrir el picker no mueve a los vecinos de la fila

- **WHEN** el usuario abre el picker desde un campo de fecha que comparte una fila horizontal con otros controles (por ejemplo los chips Hoy / Ayer del alta de movimiento)
- **THEN** el calendario aparece por encima de la pantalla
- **AND** los controles vecinos conservan su posición y siguen visibles y accesibles dentro de la pantalla
- **AND** la card que contiene la fila conserva su alto

#### Scenario: Cerrar el picker deja la pantalla como estaba

- **WHEN** el usuario cierra el picker, con o sin haber elegido una fecha
- **THEN** el overlay desaparece
- **AND** la pantalla queda con el mismo layout que tenía antes de abrirlo, sin desplazamientos residuales

#### Scenario: Presentación idiomática por plataforma

- **WHEN** el usuario abre el picker en iOS
- **THEN** el calendario se presenta como sheet sobre un scrim, con una afordancia explícita de cierre
- **WHEN** el usuario abre el picker en Android
- **THEN** el calendario se presenta como el diálogo de fecha nativo del sistema operativo, que confirma o descarta con sus propias acciones

Esta divergencia de placement entre plataformas es una divergencia idiomática permitida por la Web↔Mobile policy: el contrato de props y el comportamiento observable del campo son los mismos en ambas.

### Requirement: Cobertura total de los campos de fecha de la app nativa

Todo campo de fecha de la app nativa SHALL usar el primitivo `DateField`. Ninguna pantalla o formulario SHALL montar un selector de fecha propio ni presentar el calendario por su cuenta, de modo que la regla de presentación como overlay valga en toda la app sin excepciones por pantalla.

#### Scenario: Un formulario nuevo hereda la presentación correcta

- **WHEN** se agrega un campo de fecha a cualquier formulario de la app nativa
- **THEN** ese campo usa `DateField`
- **AND** hereda la presentación como overlay sin que el formulario tenga que compensar el layout

#### Scenario: Ninguna pantalla monta su propio calendario

- **WHEN** se revisa cualquier pantalla de la app nativa que capture una fecha
- **THEN** no existe en ella un selector de fecha montado en el flujo del layout

### Requirement: Contrato de valor ISO sin desfase de zona

El campo SHALL recibir y emitir la fecha como string ISO `YYYY-MM-DD`, o `''` cuando está vacío. La conversión entre ese string y la fecha del picker SHALL hacerse con los componentes **locales** de la fecha, de modo que el día que el usuario elige sea exactamente el día emitido, sin corrimientos por zona horaria.

#### Scenario: El día elegido es el día emitido

- **WHEN** el usuario elige un día en el calendario
- **THEN** el campo emite ese mismo día como `YYYY-MM-DD`
- **AND** el valor no se corre un día hacia atrás ni hacia adelante por la zona horaria del dispositivo

#### Scenario: Campo vacío

- **WHEN** el campo recibe `''` como valor
- **THEN** muestra su placeholder en lugar de una fecha
- **AND** al abrir el picker parte de una fecha por defecto razonable sin emitir valor hasta que el usuario elija

### Requirement: Apertura controlada para pickers mutuamente excluyentes

El campo SHALL soportar dos modos de apertura: **autogestionado**, cuando el host no opina sobre la visibilidad, y **controlado**, cuando el host provee el estado de apertura y su callback de cambio. En modo controlado el host SHALL poder mantener mutuamente excluyentes a dos o más campos de fecha de la misma pantalla, de modo que abrir uno cierre el otro.

#### Scenario: Dos campos de fecha en la misma pantalla

- **WHEN** el usuario abre el segundo de dos campos de fecha que el host mantiene mutuamente excluyentes (por ejemplo Cierre y Vencimiento de un período de tarjeta)
- **THEN** el picker del primero se cierra
- **AND** queda abierto únicamente el del campo tocado

#### Scenario: Campo autogestionado

- **WHEN** el host no provee estado de apertura
- **THEN** el campo administra su propia visibilidad: el trigger la alterna y elegir una fecha o cerrar explícitamente la termina
