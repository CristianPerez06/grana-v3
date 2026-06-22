# web-date-picker Specification

## Purpose
Define el primitivo de selección de fecha de la web (`DatePicker`): un único control que, al hacer click, abre directamente el calendario de mes completo (sin el paso intermedio del `<input type="date">` nativo). Cubre el contrato de valor (ISO `YYYY-MM-DD` sin desfase de zona), el "hoy" en zona financiera, las restricciones `min`/`max`, y la regla de que TODOS los campos de fecha de la web lo usan. Scope solo web; la contraparte mobile la maneja el tech lead.

## Requirements
### Requirement: Selección de fecha que abre el mes completo

La web SHALL proveer un único primitivo `DatePicker` que, al activarse con un solo click sobre el campo, despliegue **directamente** un calendario de mes completo. NO SHALL existir un paso intermedio (input nativo o vista compacta) que requiera un segundo click para ver el mes.

#### Scenario: Un click abre el calendario de mes

- **WHEN** el usuario hace click sobre un campo de fecha en cualquier formulario de la web
- **THEN** se despliega de inmediato el calendario con la grilla del mes completo
- **AND** no se muestra ningún paso compacto previo ni se requiere un segundo click sobre un ícono de calendario

#### Scenario: Seleccionar un día confirma el valor y cierra

- **WHEN** el usuario hace click sobre un día del calendario
- **THEN** ese día queda seleccionado como valor del campo
- **AND** el calendario se cierra

#### Scenario: Navegar entre meses

- **WHEN** el calendario está abierto
- **THEN** el usuario puede avanzar y retroceder de mes sin cerrar el calendario

### Requirement: Atajo "Hoy" en zona financiera

El `DatePicker` SHALL ofrecer un atajo "Hoy" que setea la fecha al día de hoy. El "hoy" SHALL computarse con la zona horaria financiera (`getTodayAR()`), nunca con la hora del navegador/servidor.

#### Scenario: El atajo Hoy usa la fecha financiera

- **WHEN** el usuario activa el atajo "Hoy"
- **THEN** el campo toma la fecha de hoy según la zona horaria financiera
- **AND** el calendario refleja ese día como seleccionado

### Requirement: Contrato de valor en ISO sin desfase de zona

El `DatePicker` SHALL recibir y emitir su valor como string ISO `YYYY-MM-DD` (fecha contable sin timezone). La conversión interna a/desde `Date` SHALL hacerse en horario local sin desfase de UTC, de modo que el día seleccionado por el usuario sea exactamente el día emitido.

#### Scenario: Round-trip sin corrimiento de día

- **WHEN** el usuario selecciona un día dado (incluido el día 1 o el último día del mes)
- **THEN** el valor emitido es ese mismo día en formato `YYYY-MM-DD`
- **AND** al reabrir el calendario aparece seleccionado ese mismo día, sin corrimiento por zona horaria

### Requirement: Restricciones de rango min/max

El `DatePicker` SHALL aceptar límites opcionales `min` y/o `max` (ISO `YYYY-MM-DD`) y deshabilitar la selección de días fuera de ese rango.

#### Scenario: Días fuera de rango no son seleccionables

- **WHEN** se configura un `min` (por ejemplo, la fecha de inicio de una recurrencia)
- **THEN** los días anteriores a `min` aparecen deshabilitados y no pueden seleccionarse

### Requirement: Cobertura total de campos de fecha en la web

Todos los campos de fecha de la web SHALL usar el primitivo `DatePicker`. NO SHALL quedar ningún `<input type="date">` nativo en formularios de la web tras este cambio.

#### Scenario: Barrido completo de consumidores

- **WHEN** se completa el cambio
- **THEN** el alta y la edición de movimiento, el alta y la edición de tarjeta, el pago de resumen, la edición de fechas de período, el alta y la edición de recurrencia, el bloque de reintegros pendientes y el bloque de recurrencias pendientes usan el `DatePicker`
- **AND** ninguno conserva el `<input type="date">` nativo ni el popover intermedio con botón "Hoy"

#### Scenario: Comportamiento dentro de un Drawer

- **WHEN** el `DatePicker` se usa dentro de un `Drawer` (por ejemplo, el alta de movimiento)
- **THEN** el calendario abre anclado correctamente y se cierra por outside-click/Esc sin romper el overlay del drawer

