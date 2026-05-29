# Delta — Form de movimientos como drawer

## ADDED Requirements

### Requirement: El alta y edición de movimientos se presenta como drawer lateral en desktop

El sistema SHALL presentar el formulario de carga y edición de movimientos en un drawer lateral derecho que se desliza sobre el listado de Movimientos en desktop, sin perder el contexto del listado. El drawer SHALL abrirse desde el FAB de alta, el botón "Registrar movimiento" del header del listado y el click en una fila del listado (modo edición). El drawer SHALL tener header fijo, body scrolleable y footer fijo. Al abrir en modo creación, el campo de monto SHALL recibir el foco automáticamente una vez completada la animación de entrada.

La lógica del formulario (estado, validaciones, server actions) SHALL ser la misma que la del formulario existente — el drawer es una capa de presentación, no una reimplementación. Las rutas `/transactions/new` y `/transactions/[txId]/edit` SHALL seguir resolviendo y renderizando el mismo formulario para deep-link y clientes sin JS.

#### Scenario: Abrir el drawer de alta desde el listado

- **WHEN** el usuario, en `/transactions`, activa el FAB de alta o el botón "Registrar movimiento"
- **THEN** el drawer entra desde la derecha sobre el listado
- **AND** el listado permanece visible detrás del scrim
- **AND** el campo de monto toma el foco al terminar la animación

#### Scenario: Abrir el drawer de edición desde una fila

- **WHEN** el usuario hace click en una fila del listado de movimientos
- **THEN** el drawer abre en modo edición precargado con los datos reales de ese movimiento

#### Scenario: La ruta directa sigue funcionando

- **WHEN** el usuario navega directamente a `/transactions/new`
- **THEN** el formulario se renderiza (en página) con la misma lógica que el drawer

### Requirement: El monto es el elemento hero con formato AR en vivo y color por tipo

El sistema SHALL mostrar el monto como campo principal del formulario, usando `MoneyAmountInput` (`parseMoneyInput` para parseo/validación). El monto SHALL formatearse en vivo con separador de miles `.` y decimales tras `,` (máx 2), formato es-AR. El color del monto SHALL depender del tipo: gasto y transferencia en navy, ingreso en verde, ajuste en navy con signo `+`/`−`. Una pill de moneda SHALL alternar entre ARS y USD.

#### Scenario: Formato en vivo del monto

- **WHEN** el usuario tipea `8450` en el monto
- **THEN** el campo muestra `8.450`
- **WHEN** el usuario tipea `8450,5`
- **THEN** el campo muestra `8.450,5`

#### Scenario: Color del monto según tipo ingreso

- **WHEN** el tipo activo es Ingreso
- **THEN** el monto se muestra en color verde

### Requirement: El tipo "Cambio de moneda" está disponible en el formulario unificado

El sistema SHALL ofrecer cinco tipos de movimiento en el selector del formulario: Gasto, Ingreso, Transferencia, Ajuste y Cambio de moneda. El tipo Cambio de moneda SHALL reusar el flujo `createExchange`/`updateExchange`, con cuenta y moneda de origen y cuenta y moneda de destino, exigiendo que la moneda de origen y la de destino difieran.

#### Scenario: Registrar un cambio de moneda desde el drawer

- **WHEN** el usuario elige el tipo "Cambio de moneda", define monto/moneda de origen y monto/moneda de destino con monedas distintas, y confirma
- **THEN** el sistema crea el movimiento usando el flujo de exchange existente

#### Scenario: Origen y destino con la misma moneda es inválido

- **WHEN** el usuario elige Cambio de moneda con moneda de origen y destino iguales
- **THEN** el formulario no permite confirmar (validación de exchange)

### Requirement: El selector de categoría permite drill a subcategorías

El sistema SHALL presentar la selección de categoría en un popover con dos niveles: nivel 0 lista las categorías (las que tienen subcategorías muestran indicador de drill `›`), y al entrar a una categoría drillable, nivel 1 muestra "Toda la categoría" más sus subcategorías. Seleccionar una categoría no drillable o "Toda la categoría" SHALL fijar la categoría sin subcategoría; seleccionar una subcategoría SHALL fijar categoría + subcategoría. Cuando la categoría fue autosugerida (`suggestCategoryFromHistory`), SHALL mostrarse un chip "Sugerida" que SHALL desaparecer al elegir manualmente.

#### Scenario: Drill y selección de subcategoría

- **WHEN** el usuario abre el selector de categoría y entra a "Comida" (drillable) y elige "Almuerzo"
- **THEN** el formulario fija categoría "Comida" y subcategoría "Almuerzo" y cierra el popover

#### Scenario: Selección manual quita el chip Sugerida

- **WHEN** la categoría está autosugerida (chip "Sugerida" visible) y el usuario elige una categoría manualmente
- **THEN** el chip "Sugerida" desaparece

### Requirement: Guardar y cargar otro

El sistema SHALL ofrecer en modo creación un botón "+ Otro" que guarde el movimiento y, sin cerrar el drawer, limpie el monto y la descripción, mantenga cuenta/fecha/tipo, y devuelva el foco al monto. Este botón SHALL estar oculto en modo edición.

#### Scenario: Cargar un movimiento atrás de otro

- **WHEN** el usuario completa un gasto y activa "+ Otro"
- **THEN** el movimiento se guarda
- **AND** el monto y la descripción se limpian, cuenta/fecha/tipo se mantienen, y el foco vuelve al monto

### Requirement: El toggle Repetir ofrece frecuencia personalizada

El sistema SHALL ofrecer en el toggle "Repetir" las frecuencias Semanal, Quincenal, Mensual, Anual y Personalizado. Al elegir Personalizado, SHALL mostrarse un control de intervalo `cada N · unidad` (día/semana/mes/año) con condición de fin opcional, y al guardar SHALL crear la recurrencia vía el flujo existente con el modelo intervalo+unidad.

#### Scenario: Crear una recurrencia personalizada desde el form

- **WHEN** el usuario activa "Repetir", elige "Personalizado" con `cada 3 · meses` y confirma el movimiento
- **THEN** el sistema crea el movimiento real y una recurrencia con `interval_count = 3`, `interval_unit = month`

### Requirement: Atajos de teclado en el drawer

El sistema SHALL soportar, con el drawer abierto, `Esc` para cerrar el popover activo si lo hay o, en su defecto, el drawer; y `⌘/Ctrl+Enter` para enviar el formulario.

#### Scenario: Esc cierra popover antes que drawer

- **WHEN** hay un popover abierto dentro del drawer y el usuario presiona Esc
- **THEN** se cierra el popover y el drawer permanece abierto
- **WHEN** no hay popover abierto y el usuario presiona Esc
- **THEN** se cierra el drawer

#### Scenario: Envío con atajo

- **WHEN** el usuario presiona ⌘/Ctrl+Enter con el formulario válido
- **THEN** el movimiento se envía

## MODIFIED Requirements

### Requirement: La edición de movimientos respeta los campos editables según estado

El sistema SHALL precargar el movimiento real al editar y SHALL deshabilitar el cambio de tipo. El conjunto de campos editables SHALL derivarse del estado del movimiento (`editableFields`): por ejemplo, no se editan campos bloqueados de consumos de tarjeta ya pagados ni de instancias de cuotas. El borrado SHALL respetar las reglas existentes (no borrar hijas de cuotas, no borrar consumos pagados). En modo edición el CTA SHALL decir "Guardar cambios" y el botón "+ Otro" SHALL ocultarse.

#### Scenario: Tipo no editable en edición

- **WHEN** el usuario abre un movimiento existente en el drawer de edición
- **THEN** el selector de tipo está deshabilitado

#### Scenario: Borrado respeta reglas de cuotas

- **WHEN** el usuario intenta eliminar una cuota hija desde la edición
- **THEN** el sistema aplica las reglas de borrado existentes y no permite borrarla aislada
