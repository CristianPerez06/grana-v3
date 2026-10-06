## MODIFIED Requirements

### Requirement: Selección de fecha que abre el mes completo

La web SHALL proveer un único primitivo `DatePicker` que, al activarse con un solo click sobre el campo, despliegue **directamente** un calendario de mes completo. NO SHALL existir un paso intermedio (input nativo o vista compacta) que requiera un segundo click para ver el mes. El calendario SHALL mostrar siempre seis semanas, cualquiera sea el mes, completando los lugares sobrantes con días del mes anterior o siguiente, de modo que su tamaño no cambie al navegar entre meses.

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

#### Scenario: El calendario no cambia de tamaño al cambiar de mes

- **WHEN** el calendario está abierto y el usuario pasa de un mes que ocupa cinco semanas a uno que ocupa seis (o cuatro), en cualquier dirección
- **THEN** la grilla muestra seis semanas en ambos meses, con los días ajenos al mes en el estilo atenuado de los días de otros meses
- **AND** el calendario conserva su alto y su posición en pantalla, y los controles para cambiar de mes quedan en el mismo lugar

#### Scenario: El calendario se muestra entero sin scroll cuando entra en pantalla

- **WHEN** el usuario abre el calendario y el espacio libre de la pantalla alcanza para mostrarlo completo
- **THEN** el calendario se muestra entero, con sus seis semanas y sus acciones, sin barra de desplazamiento
- **AND** solo aparece desplazamiento interno cuando el espacio libre es menor que el calendario
