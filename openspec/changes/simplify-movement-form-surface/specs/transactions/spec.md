## ADDED Requirements

### Requirement: El alta ofrece las clasificaciones frecuentes como selección de un tap

En modo create y en los tipos `gasto` e `ingreso`, el formulario SHALL ofrecer las clasificaciones más frecuentes del usuario (del tipo activo) como opciones de selección directa. Una clasificación frecuente es una hoja del historial: una categoría, o una categoría con su subcategoría. Un solo gesto sobre ella SHALL asignar la categoría y —cuando la clasificación la incluye— también la subcategoría, sin abrir el selector completo ni entrar a un segundo nivel. El selector completo SHALL seguir disponible como camino secundario ("Ver todas"); en él, un solo gesto sobre una categoría SHALL asignarla directamente, con sus subcategorías accesibles como refinamiento opcional y nunca como paso obligatorio. Elegir una categoría SHALL ser suficiente para guardar.

#### Scenario: Clasificar con una hoja frecuente en un tap

- **WHEN** el usuario tiene historial y abre el alta en `gasto`
- **THEN** se muestran sus clasificaciones frecuentes como opciones de selección directa
- **AND** un solo gesto sobre una de ellas asigna su categoría, y su subcategoría si la hoja la incluye
- **AND** el movimiento puede guardarse sin abrir el selector completo

#### Scenario: El selector completo no fuerza el drill de subcategoría

- **WHEN** la clasificación buscada no está entre las frecuentes y el usuario abre "Ver todas"
- **THEN** un solo gesto sobre una categoría la asigna a secas, aun cuando tenga subcategorías
- **AND** las subcategorías quedan accesibles como refinamiento opcional, no como un paso obligatorio

#### Scenario: Sin historial no hay selección rápida

- **WHEN** el usuario no tiene movimientos previos del tipo activo (primer movimiento)
- **THEN** no se muestran clasificaciones frecuentes
- **AND** el flujo usa el selector completo, que igual permite asignar una categoría en un gesto

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

El camino de registro de un gasto simple (cuenta cash/bank, sin secciones avanzadas) SHALL completarse con un máximo de tres interacciones discretas además de tipear el monto: abrir el formulario, elegir la clasificación y guardar. La cuenta no agrega interacciones cuando hay una sola elegible para la moneda activa, cuando la clasificación elegida resuelve la cuenta habitual, o cuando la preselección acierta.

#### Scenario: Gasto simple dentro del presupuesto de taps

- **WHEN** un usuario con una sola cuenta elegible abre el alta, tipea el monto, elige una clasificación frecuente y guarda
- **THEN** el gasto queda registrado
- **AND** no se requirió abrir el selector de cuenta, el drill de subcategoría ni ninguna sección avanzada

#### Scenario: El monto no requiere un tap para enfocarse

- **WHEN** el usuario abre el formulario de alta
- **THEN** el campo de monto queda enfocado y listo para tipear sin un gesto adicional

### Requirement: El selector de tipo prioriza los movimientos de uso diario, derivado de los datos

El formulario de alta SHALL presentar `gasto` e `ingreso` como opciones primarias fijas. El tercer lugar primario SHALL ofrecer el tipo secundario más usado y elegible entre `transferencia` y `cambio de moneda`; los tipos secundarios restantes SHALL quedar tras una affordance explícita ("Otros"). `ajuste` SHALL ser siempre secundario y nunca ocupar el lugar primario. La affordance "Otros" SHALL aparecer solo cuando existe al menos un tipo secundario elegible. La elegibilidad depende de los datos del usuario (`transferencia` requiere dos o más cuentas propias; `cambio de moneda` requiere capacidad bimoneda), de modo que un usuario sin secundarios elegibles ve solo `gasto` e `ingreso`. La priorización no altera ninguna regla contable ni la disponibilidad de los tipos.

#### Scenario: Gasto e ingreso son siempre primarios

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto` e `ingreso` como opciones primarias fijas

#### Scenario: El tercer lugar es el secundario más usado y elegible

- **WHEN** el usuario usa `cambio de moneda` más que `transferencia` y ambos son elegibles
- **THEN** `cambio de moneda` ocupa el tercer lugar primario
- **AND** `transferencia` queda accesible mediante la affordance "Otros"

#### Scenario: Ajuste nunca ocupa el lugar primario

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** `ajuste` no ocupa el tercer lugar primario
- **AND** queda accesible mediante la affordance "Otros"

#### Scenario: Sin secundarios elegibles no hay affordance

- **WHEN** el usuario tiene una sola cuenta en una sola moneda (ni `transferencia` ni `cambio` son elegibles)
- **THEN** el selector de tipo muestra solo `gasto` e `ingreso`
- **AND** no se muestra la affordance "Otros"

#### Scenario: En edición el tipo no cambia

- **WHEN** el formulario se abre en modo edición de un movimiento existente
- **THEN** el tipo del movimiento se muestra como contexto inmutable
- **AND** la priorización primario/secundario no ofrece cambiarlo

### Requirement: El formulario oculta la dimensión cuenta cuando hay una sola cuenta elegible para la moneda activa

El formulario de alta SHALL omitir el selector de cuenta cuando el usuario tiene exactamente una cuenta elegible para el tipo de movimiento y la moneda activos, usando esa cuenta de forma implícita. Con dos o más cuentas elegibles, el selector SHALL mostrarse. La elegibilidad depende del tipo (solo `gasto` puede apuntar a una cuenta de crédito) y de la moneda activa, de modo que el resultado puede variar por tipo y por moneda y se recalcula por render.

#### Scenario: Una sola cuenta elegible oculta el selector

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo y la moneda activos
- **THEN** el formulario no muestra el selector de cuenta
- **AND** el movimiento se registra en esa cuenta implícita

#### Scenario: Dos o más cuentas elegibles muestran el selector

- **WHEN** el usuario tiene dos o más cuentas elegibles para el tipo y la moneda activos
- **THEN** el formulario muestra el selector de cuenta
- **AND** el usuario elige entre ellas

#### Scenario: La elegibilidad depende de la moneda

- **WHEN** el usuario tiene una `Billetera` en ARS y otra cuenta solo en USD, y el monto está en ARS
- **THEN** para ARS hay una sola cuenta elegible y el selector se oculta
- **AND** al cambiar la moneda a USD la cuenta implícita pasa a ser la cuenta en USD, sin abrir un selector

### Requirement: El gasto simple no atraviesa ninguna sección avanzada

Las secciones avanzadas del alta —reintegro, gasto compartido, repetir (recurrencia) y cuotas— SHALL arrancar colapsadas y SHALL NOT ser obligatorias para registrar un gasto simple. El camino mínimo de un gasto simple es: monto, clasificación, cuenta (si el selector aplica), fecha y guardar.

#### Scenario: Registrar un gasto simple sin abrir secciones avanzadas

- **WHEN** el usuario completa monto, clasificación y fecha en una cuenta cash/bank y confirma, sin tocar reintegro, compartido, repetir ni cuotas
- **THEN** el gasto se registra correctamente
- **AND** no se creó ningún reintegro, split de gasto compartido ni regla recurrente

#### Scenario: Las funcionalidades avanzadas están sin activar al abrir

- **WHEN** el usuario abre el formulario de alta en el tipo `gasto`
- **THEN** reintegro, compartido y repetir se ofrecen como chips de activación sin activar (sin sus parámetros)
- **AND** las cuotas no aparecen salvo que la cuenta sea de crédito

### Requirement: El formulario ofrece las funcionalidades avanzadas según el contexto y las activa en el lugar

Las funcionalidades avanzadas del alta —reintegro, gasto compartido y repetir (recurrencia)— SHALL ofrecerse como opciones de activación directa gateadas por el contexto: un solo gesto SHALL activar la funcionalidad y revelar sus parámetros en el lugar, y otro gesto SHALL desactivarla. El conjunto ofrecido depende del contexto y de los datos (gasto compartido solo con un hogar de dos miembros; repetir no disponible en compras en cuotas; ninguna en `ajuste` ni `cambio de moneda`), de modo que puede ir de una a tres opciones o ninguna. Las cuotas SHALL ofrecerse junto a la cuenta cuando esta es una tarjeta de crédito, por ser parte de la forma de pago, y no dentro de las funcionalidades avanzadas. Ninguna de estas funcionalidades SHALL estar activa por defecto ni ser obligatoria para un gasto simple.

#### Scenario: Activar una funcionalidad revela sus parámetros en el lugar

- **WHEN** el usuario activa "compartir" en un gasto
- **THEN** aparecen los parámetros del split (con un default 50/50) sin abrir otra pantalla
- **AND** desactivarla los oculta de nuevo

#### Scenario: El conjunto de funcionalidades es contextual

- **WHEN** el usuario abre el alta en `ingreso`
- **THEN** se ofrece "repetir" pero no "reintegro" ni "gasto compartido"

#### Scenario: El gasto compartido requiere un hogar de dos

- **WHEN** el usuario no tiene un hogar de dos miembros
- **THEN** no se ofrece la opción de gasto compartido

#### Scenario: Las cuotas se ofrecen junto a la cuenta de crédito

- **WHEN** el usuario selecciona una tarjeta de crédito para un gasto
- **THEN** la elección de cuotas aparece junto a la cuenta, como parte de la forma de pago
- **AND** no aparece entre las funcionalidades avanzadas

### Requirement: El alta preselecciona la cuenta según la clasificación y los datos del usuario

En modo create, el formulario SHALL preseleccionar la cuenta según este orden de preferencia: (1) la cuenta de contexto cuando el usuario llega desde una vista de cuenta; (2) la cuenta más usada para la clasificación elegida, cuando el caller la provee y el usuario tiene historial para esa clasificación; (3) la única cuenta elegible cuando hay una sola; (4) la última cuenta usada por el usuario, si el caller la provee; (5) la primera cuenta elegible como fallback. La preselección nunca elige una cuenta no elegible para el tipo o la moneda activos, y la cuenta resultante SHALL ser visible y modificable.

#### Scenario: Preselección desde una vista de cuenta

- **WHEN** el usuario abre el alta desde la vista de una cuenta específica
- **THEN** esa cuenta queda preseleccionada

#### Scenario: La clasificación resuelve la cuenta habitual

- **WHEN** el usuario elige una clasificación para la que tiene una cuenta más usada en su historial
- **THEN** esa cuenta queda preseleccionada
- **AND** se muestra de forma visible y puede cambiarse

#### Scenario: Fallback a la primera elegible

- **WHEN** no hay cuenta de contexto, la clasificación no resuelve una cuenta habitual, hay varias cuentas elegibles y el caller no provee una última cuenta usada
- **THEN** queda preseleccionada la primera cuenta elegible
