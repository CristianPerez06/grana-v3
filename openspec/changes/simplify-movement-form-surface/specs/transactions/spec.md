## ADDED Requirements

### Requirement: El alta ofrece las categorías recientes como selección de un tap

En modo create y en los tipos `gasto` e `ingreso`, el formulario SHALL ofrecer las categorías recientes del usuario (del tipo activo) como opciones de selección directa: un solo gesto las asigna, sin abrir el selector completo ni entrar al segundo nivel de subcategorías. El selector completo con drill de subcategorías SHALL seguir disponible como camino secundario. Elegir una categoría SHALL ser suficiente para guardar; la subcategoría es un refinamiento opcional.

#### Scenario: Clasificar con una categoría reciente en un tap

- **WHEN** el usuario tiene historial y abre el alta en `gasto`
- **THEN** se muestran sus categorías recientes como opciones de selección directa
- **AND** un solo gesto sobre una de ellas la asigna como categoría del movimiento
- **AND** el movimiento puede guardarse sin elegir subcategoría

#### Scenario: El selector completo sigue disponible

- **WHEN** la categoría buscada no está entre las recientes
- **THEN** el usuario abre el selector completo ("Ver todas") con todas las categorías y sus subcategorías
- **AND** puede clasificar con o sin subcategoría

#### Scenario: Sin historial no hay selección rápida

- **WHEN** el usuario no tiene movimientos previos del tipo activo (primer movimiento)
- **THEN** no se muestran categorías recientes
- **AND** el flujo usa el selector completo

### Requirement: La descripción es opcional y acelera la clasificación cuando se usa

La descripción de un movimiento SHALL seguir siendo opcional: nunca bloquea el guardado ni es requisito para clasificar. Cuando el usuario la completa con un texto ya visto en su historial, el sistema MAY prefiltrar la clasificación (categoría y subcategoría) a partir de ese historial, como acelerador y no como imposición.

#### Scenario: Guardar sin descripción

- **WHEN** el usuario registra un gasto con monto y categoría pero sin descripción
- **THEN** el movimiento se guarda correctamente

#### Scenario: Una descripción conocida acelera la clasificación

- **WHEN** el usuario tipea una descripción que coincide con un movimiento anterior sin haber elegido categoría
- **THEN** el sistema ofrece la categoría (y subcategoría) usada históricamente para ese texto como sugerencia de un tap
- **AND** el usuario puede aceptarla o ignorarla sin que sea obligatoria

### Requirement: Registrar un gasto simple no supera un presupuesto de interacciones

El camino de registro de un gasto simple (cuenta cash/bank, sin secciones avanzadas) SHALL completarse con un máximo de tres interacciones discretas además de tipear el monto: abrir el formulario, elegir la categoría y guardar. La cuenta no agrega interacciones cuando hay una sola elegible o cuando la preselección acierta.

#### Scenario: Gasto simple dentro del presupuesto de taps

- **WHEN** un usuario con una sola cuenta elegible abre el alta, tipea el monto, elige una categoría reciente y guarda
- **THEN** el gasto queda registrado
- **AND** no se requirió abrir el selector de cuenta, el drill de subcategoría ni ninguna sección avanzada

#### Scenario: El monto no requiere un tap para enfocarse

- **WHEN** el usuario abre el formulario de alta
- **THEN** el campo de monto queda enfocado y listo para tipear sin un gesto adicional

### Requirement: El selector de tipo prioriza los movimientos de uso diario

El formulario de alta de movimientos SHALL presentar `gasto`, `ingreso` y `transferencia` como opciones primarias, y `ajuste` y `cambio de moneda` como opciones secundarias alcanzables mediante una affordance explícita (ej. "Otros"). La partición es fija (deriva de la naturaleza del tipo, no del usuario) y no altera ninguna regla contable ni la disponibilidad de los tipos secundarios.

#### Scenario: La decisión primaria muestra tres tipos

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto`, `ingreso` y `transferencia` como opciones primarias
- **AND** `ajuste` y `cambio de moneda` no ocupan una ranura primaria de igual peso

#### Scenario: Los tipos secundarios siguen disponibles

- **WHEN** el usuario activa la affordance de tipos secundarios ("Otros")
- **THEN** puede seleccionar `ajuste` o `cambio de moneda`
- **AND** el flujo de ese tipo funciona igual que antes de este cambio

#### Scenario: En edición el tipo no cambia

- **WHEN** el formulario se abre en modo edición de un movimiento existente
- **THEN** el tipo del movimiento se muestra como contexto inmutable
- **AND** la partición primario/secundario no ofrece cambiarlo

### Requirement: El formulario oculta la dimensión cuenta cuando hay una sola cuenta elegible

El formulario de alta SHALL omitir el selector de cuenta cuando el usuario tiene exactamente una cuenta elegible para el tipo de movimiento activo, usando esa cuenta de forma implícita. Con dos o más cuentas elegibles, el selector SHALL mostrarse. La elegibilidad depende del tipo (solo `gasto` puede apuntar a una cuenta de crédito), de modo que el resultado puede variar por tipo y se recalcula por render.

#### Scenario: Una sola cuenta elegible oculta el selector

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo activo
- **THEN** el formulario no muestra el selector de cuenta
- **AND** el movimiento se registra en esa cuenta implícita

#### Scenario: Dos o más cuentas elegibles muestran el selector

- **WHEN** el usuario tiene dos o más cuentas elegibles para el tipo activo
- **THEN** el formulario muestra el selector de cuenta
- **AND** el usuario elige entre ellas

#### Scenario: La elegibilidad depende del tipo

- **WHEN** el usuario tiene una cuenta de crédito además de una `Billetera` y el tipo activo es `ingreso`
- **THEN** la cuenta de crédito no cuenta como elegible (ingreso no apunta a crédito)
- **AND** si la única elegible restante es la `Billetera`, el selector se oculta

### Requirement: El gasto simple no atraviesa ninguna sección avanzada

Las secciones avanzadas del alta —reintegro, gasto compartido, repetir (recurrencia) y cuotas— SHALL arrancar colapsadas y SHALL NOT ser obligatorias para registrar un gasto simple. El camino mínimo de un gasto simple es: monto, cuenta (si el selector aplica), categoría, fecha y guardar.

#### Scenario: Registrar un gasto simple sin abrir secciones avanzadas

- **WHEN** el usuario completa monto, categoría y fecha en una cuenta cash/bank y confirma, sin tocar reintegro, compartido, repetir ni cuotas
- **THEN** el gasto se registra correctamente
- **AND** no se creó ningún reintegro, split de gasto compartido ni regla recurrente

#### Scenario: Las secciones avanzadas están colapsadas al abrir

- **WHEN** el usuario abre el formulario de alta en el tipo `gasto`
- **THEN** las secciones de reintegro, compartido y repetir se muestran colapsadas (solo su toggle)
- **AND** la sección de cuotas no aparece salvo que la cuenta sea de crédito en ARS

### Requirement: El alta preselecciona la cuenta más probable

En modo create, el formulario SHALL preseleccionar la cuenta según este orden de preferencia: (1) la cuenta de contexto cuando el usuario llega desde una vista de cuenta; (2) la única cuenta elegible cuando hay una sola; (3) la última cuenta usada por el usuario, si el caller la provee; (4) la primera cuenta elegible como fallback. La preselección nunca elige una cuenta no elegible para el tipo activo.

#### Scenario: Preselección desde una vista de cuenta

- **WHEN** el usuario abre el alta desde la vista de una cuenta específica
- **THEN** esa cuenta queda preseleccionada

#### Scenario: Preselección con una sola cuenta elegible

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo activo
- **THEN** esa cuenta queda seleccionada de forma implícita

#### Scenario: Fallback a la primera elegible

- **WHEN** no hay cuenta de contexto, hay varias cuentas elegibles y el caller no provee una última cuenta usada
- **THEN** queda preseleccionada la primera cuenta elegible
