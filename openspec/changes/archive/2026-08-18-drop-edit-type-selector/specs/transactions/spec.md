## MODIFIED Requirements

### Requirement: El selector de tipo ofrece dos primarias y "Otros"

Este requirement gobierna el **alta**. En **edición** no hay selector de tipo en ninguna superficie (ver el requirement del formulario único y el del drawer en modo edición): el tipo es inmutable, así que se enuncia como fila de contexto read-only y no como control.

El formulario de alta SHALL presentar `gasto` e `ingreso` como las únicas opciones primarias fijas. Los demás tipos —`transferencia`, `ajuste` y `cambio de moneda`— SHALL quedar tras una affordance explícita ("Otros") que los ofrece gateados por su elegibilidad (`transferencia` requiere dos o más cuentas propias; `cambio de moneda` requiere capacidad bimoneda; `ajuste` está siempre disponible). La affordance "Otros" SHALL mostrarse siempre que exista al menos un tipo secundario elegible. La partición es fija y no altera ninguna regla contable ni la disponibilidad de los tipos.

#### Scenario: Solo gasto e ingreso son primarios

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto` e `ingreso` como opciones primarias
- **AND** ni `transferencia`, ni `ajuste`, ni `cambio de moneda` ocupan un lugar primario

#### Scenario: Los tipos secundarios están en "Otros"

- **WHEN** el usuario activa la affordance "Otros"
- **THEN** puede elegir `transferencia` (si tiene dos o más cuentas), `ajuste` o `cambio de moneda` (si tiene capacidad bimoneda)
- **AND** el flujo de ese tipo funciona igual que antes de este cambio

#### Scenario: En edición no hay selector de tipo

- **WHEN** el formulario se abre en modo edición de un movimiento existente, en cualquier superficie (web escritorio, web en viewport angosto o app nativa)
- **THEN** el formulario NO dibuja el selector de tipo — ni la partición primario/"Otros", ni el selector completo en estado deshabilitado
- **AND** el tipo del movimiento se enuncia como fila de contexto read-only, junto a la moneda y la(s) cuenta(s), con el mismo caption de "no editable"

### Requirement: El drawer en modo edición ajusta chrome y CTA

El sistema SHALL precargar el movimiento real al abrir el drawer en modo edición y NO SHALL renderizar el selector de tipo: el tipo es inmutable y se enuncia como fila de contexto read-only. El conjunto de campos editables SHALL derivarse de `getEditableFields` (regla ya especificada para el formulario único). En modo edición el CTA SHALL decir "Guardar cambios". El borrado SHALL respetar las reglas existentes (no borrar hijas de cuotas aisladas, no borrar consumos pagados).

#### Scenario: El tipo no se ofrece como control en edición

- **WHEN** el usuario abre un movimiento existente en el drawer de edición
- **THEN** el drawer no muestra selector de tipo, en ningún viewport
- **AND** el tipo aparece como fila de contexto read-only con caption de "no editable"

#### Scenario: CTA en edición

- **WHEN** el drawer está en modo edición
- **THEN** el CTA dice "Guardar cambios"

#### Scenario: Borrado respeta reglas de cuotas

- **WHEN** el usuario intenta eliminar una cuota hija desde la edición
- **THEN** el sistema aplica las reglas de borrado existentes y no permite borrarla aislada
