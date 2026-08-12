## ADDED Requirements

> Alcance: este change es **solo superficie** (reshape de lo que ya existe). Las funcionalidades data-driven (chips de clasificación frecuente, memoria categoría→cuenta, ranking del tercer tab por frecuencia, sugerencia→cuenta) viven en el epic **#31** y no se especifican acá.

### Requirement: El selector de categoría no obliga a elegir subcategoría

En modo create, elegir una categoría SHALL ser suficiente para guardar un movimiento de `gasto` o `ingreso`: la subcategoría es un refinamiento opcional. El selector completo SHALL asignar la categoría con un solo gesto sobre su nombre, aun cuando la categoría tenga subcategorías, dejando el segundo nivel accesible como refinamiento explícito (no como un paso obligatorio).

#### Scenario: Elegir una categoría con subcategorías sin entrar al segundo nivel

- **WHEN** el usuario abre el selector de categoría y toca una categoría que tiene subcategorías
- **THEN** esa categoría queda asignada a secas
- **AND** el movimiento puede guardarse sin elegir subcategoría

#### Scenario: El segundo nivel sigue disponible como refinamiento

- **WHEN** el usuario quiere clasificar con una subcategoría
- **THEN** puede abrir el segundo nivel de esa categoría explícitamente y elegir una subcategoría

### Requirement: El monto queda enfocado al abrir el alta

Al abrir el formulario de alta, el campo de monto SHALL quedar enfocado y listo para tipear sin un gesto adicional.

#### Scenario: El monto no requiere un tap para enfocarse

- **WHEN** el usuario abre el formulario de alta
- **THEN** el campo de monto queda enfocado y listo para tipear sin un gesto adicional

### Requirement: La descripción es opcional

La descripción de un movimiento SHALL seguir siendo opcional: nunca bloquea el guardado ni es requisito para clasificar.

#### Scenario: Guardar sin descripción

- **WHEN** el usuario registra un gasto con monto y categoría pero sin descripción
- **THEN** el movimiento se guarda correctamente

### Requirement: El selector de tipo prioriza los movimientos de uso diario por elegibilidad

El formulario de alta SHALL presentar `gasto` e `ingreso` como opciones primarias fijas. El tercer lugar primario SHALL ofrecer un tipo secundario elegible entre `transferencia` y `cambio de moneda`; los tipos secundarios restantes SHALL quedar tras una affordance explícita ("Otros"). `ajuste` SHALL ser siempre secundario y nunca ocupar el lugar primario. La affordance "Otros" SHALL aparecer solo cuando existe al menos un tipo secundario elegible. La elegibilidad depende de los datos del usuario (`transferencia` requiere dos o más cuentas propias; `cambio de moneda` requiere capacidad bimoneda), de modo que un usuario sin secundarios elegibles ve solo `gasto` e `ingreso`. La priorización no altera ninguna regla contable ni la disponibilidad de los tipos.

#### Scenario: Gasto e ingreso son siempre primarios

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto` e `ingreso` como opciones primarias fijas

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

Las secciones avanzadas del alta —reintegro, gasto compartido, repetir (recurrencia) y cuotas— SHALL arrancar sin activar y SHALL NOT ser obligatorias para registrar un gasto simple. El camino mínimo de un gasto simple es: monto, categoría, cuenta (si el selector aplica), fecha y guardar.

#### Scenario: Registrar un gasto simple sin abrir secciones avanzadas

- **WHEN** el usuario completa monto, categoría y fecha en una cuenta cash/bank y confirma, sin tocar reintegro, compartido, repetir ni cuotas
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

### Requirement: El alta preselecciona la cuenta con los datos disponibles

En modo create, el formulario SHALL preseleccionar la cuenta según este orden de preferencia, usando solo datos ya disponibles: (1) la cuenta de contexto cuando el usuario llega desde una vista de cuenta; (2) la única cuenta elegible cuando hay una sola para el tipo y la moneda activos; (3) la primera cuenta elegible como fallback. La preselección nunca elige una cuenta no elegible para el tipo o la moneda activos.

#### Scenario: Preselección desde una vista de cuenta

- **WHEN** el usuario abre el alta desde la vista de una cuenta específica
- **THEN** esa cuenta queda preseleccionada

#### Scenario: Preselección con una sola cuenta elegible

- **WHEN** el usuario tiene una sola cuenta elegible para el tipo y la moneda activos
- **THEN** esa cuenta queda seleccionada de forma implícita

#### Scenario: Fallback a la primera elegible

- **WHEN** no hay cuenta de contexto y hay varias cuentas elegibles
- **THEN** queda preseleccionada la primera cuenta elegible
