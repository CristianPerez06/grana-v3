## ADDED Requirements

### Requirement: La superficie del alta presenta la misma jerarquía visual en las superficies mobile (web y nativa)

El formulario de alta de movimientos SHALL presentar la misma jerarquía visual en la superficie **mobile-web** (gateada por breakpoint) y en la **app nativa**, de modo que ambas se lean como el mismo producto. Esta paridad es de **presentación**: no altera ningún campo, tipo de movimiento, regla contable ni el contrato del hook compartido. En web sigue gateada por breakpoint y el formulario **desktop** no se ve afectado.

La jerarquía compartida SHALL incluir:

- **Monto como hero.** El campo de monto SHALL presentarse como un bloque destacado con el número en tamaño grande y **centrado**, precedido por el signo del tipo activo y por el **símbolo de la moneda atenuado**. La **moneda** SHALL ofrecerse como un **chip inline** dentro del bloque de monto —no como un control segmentado separado— que al accionarse rota entre las monedas elegibles y SHALL quedar inerte cuando hay una sola. En el bloque de monto SHALL haber un **disparador de calculadora** cuando el campo la habilita.
- **Campos secundarios agrupados.** Categoría, cuenta, cuotas (cuando aplican) y fecha SHALL presentarse dentro de **un único contenedor** con separadores entre filas, en lugar de contenedores sueltos e independientes.
- **Fecha compacta.** La fecha SHALL presentarse como un disparador de calendario junto a chips de acceso rápido **Hoy/Ayer**, sin una etiqueta de campo propia.
- **Descripción slim.** La descripción SHALL presentarse como una sola línea compacta, sin una etiqueta de campo propia.

La paridad se evalúa por **rol y estructura** de los elementos (qué es el hero, qué comparte contenedor), no por igualdad de píxeles. El comportamiento de cada campo (ocultamiento de la cuenta, chips de avanzado, cuotas junto a la cuenta de crédito, etc.) SHALL permanecer como lo definen los requirements de comportamiento vigentes.

#### Scenario: El monto se presenta como hero en ambas superficies mobile

- **WHEN** el usuario abre el alta en la web-mobile o en la app nativa
- **THEN** el monto se muestra como un bloque destacado con el número grande y centrado, el signo del tipo y el símbolo de moneda atenuado
- **AND** la moneda aparece como un chip dentro de ese bloque, no como un control segmentado aparte

#### Scenario: Los campos secundarios comparten un único contenedor

- **WHEN** el usuario abre el alta en la web-mobile o en la app nativa
- **THEN** categoría, cuenta (si el selector aplica), cuotas (si aplican) y fecha se presentan dentro de un único contenedor con separadores
- **AND** no aparecen como contenedores independientes y sueltos

#### Scenario: La fecha usa disparador de calendario más chips Hoy/Ayer

- **WHEN** el usuario mira la fila de fecha del alta en cualquiera de las dos superficies mobile
- **THEN** ve un disparador de calendario acompañado de chips Hoy/Ayer
- **AND** no ve una etiqueta de campo separada para la fecha

#### Scenario: El desktop no se ve afectado

- **WHEN** el formulario de alta se renderiza en viewport de escritorio
- **THEN** conserva su maqueta de escritorio y no adopta la presentación mobile
