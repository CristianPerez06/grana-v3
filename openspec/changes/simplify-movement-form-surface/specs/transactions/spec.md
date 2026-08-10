## ADDED Requirements

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
