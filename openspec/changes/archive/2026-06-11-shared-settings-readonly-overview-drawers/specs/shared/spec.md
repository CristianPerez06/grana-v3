## ADDED Requirements

### Requirement: El nombre del hogar se presenta readonly y se edita en un drawer enfocado (web)

En `apps/web`, la ruta `/shared/settings` SHALL mostrar el nombre actual del hogar como **valor readonly** (sin input inline), acompañado de una acción `Editar` neutra/secundaria. La acción `Editar` SHALL abrir un `Drawer` (primitivo de `overlay-primitives`) que contiene el input de nombre existente y acciones `Guardar`/`Cancelar`. El guardado SHALL invocar la misma mutación existente `updateHouseholdConfig({ name })`, sin redirect nuevo; `Cancelar`, cerrar por scrim o `Esc` SHALL descartar la edición sin efecto. El CTA `Guardar` (acción positiva de confirmación) SHALL ser el único elemento verde del flujo; el disparador `Editar` SHALL permanecer neutro/secundario.

#### Scenario: El nombre se muestra readonly con acción de edición

- **WHEN** un usuario abre `/shared/settings`
- **THEN** ve el nombre actual del hogar como texto readonly y un botón `Editar` neutro, sin input inline

#### Scenario: Editar el nombre desde el drawer

- **WHEN** el usuario presiona `Editar` en la sección de nombre
- **THEN** se abre un drawer con el input de nombre precargado y acciones `Guardar`/`Cancelar`
- **WHEN** el usuario cambia el nombre y presiona `Guardar`
- **THEN** el sistema invoca `updateHouseholdConfig({ name })`, refresca la vista y el nuevo nombre aparece readonly en la página

#### Scenario: Cancelar la edición del nombre no tiene efecto

- **WHEN** el usuario abre el drawer de nombre y lo cierra con `Cancelar`, scrim o `Esc`
- **THEN** el drawer se cierra, no se invoca ninguna mutación y el nombre permanece sin cambios

## MODIFIED Requirements

### Requirement: El usuario puede configurar el split por defecto del hogar

El sistema SHALL permitir editar el split por defecto del hogar (ej. 50·50, 60·40), que se preselecciona al marcar un gasto como compartido. Los porcentajes SHALL sumar 100 y cada uno SHALL ser ≥ 1. El split por defecto puede sobrescribirse gasto por gasto.

En `apps/web`, cuando el hogar tiene dos miembros, la sección de split por defecto de `/shared/settings` SHALL mostrar un **resumen readonly** con **ambos integrantes y su porcentaje** (de los datos que `getHousehold()` ya provee), acompañado de una acción `Editar` neutra/secundaria. La edición SHALL ocurrir en un `Drawer` enfocado que muestra el porcentaje del **primer integrante** como input **editable** y el del segundo como **complemento derivado** (`100 - primero`), sin permitir editar el segundo directamente, con acciones `Guardar`/`Cancelar`. El guardado SHALL invocar la misma mutación existente `updateHouseholdConfig({ default_split })` con el primer porcentaje editado y su complemento. Esto es una presentación legible de datos ya disponibles; no cambia la regla de derivación ni la validación. El CTA `Guardar` SHALL ser la única acción verde; el disparador `Editar` SHALL permanecer neutro/secundario.

#### Scenario: Cambiar el split por defecto a 60·40

- **WHEN** un miembro configura el split por defecto en 60·40 y guarda
- **THEN** los nuevos gastos compartidos preseleccionan 60·40, sin alterar los splits de gastos ya registrados

#### Scenario: La pantalla muestra el resumen readonly de ambos integrantes

- **WHEN** un hogar de dos miembros abre `/shared/settings`
- **THEN** la sección de split muestra un resumen readonly con el nombre y porcentaje de cada integrante, y un botón `Editar` neutro, sin input inline

#### Scenario: Editar el reparto desde el drawer deriva el complemento

- **WHEN** el usuario presiona `Editar` en la sección de reparto y se abre el drawer
- **THEN** ve el porcentaje del primer integrante como input editable y el del segundo como `100 - primero`, no editable
- **WHEN** cambia el porcentaje del primer integrante y presiona `Guardar`
- **THEN** el sistema invoca `updateHouseholdConfig({ default_split })` con el primer porcentaje y su complemento derivado, refresca la vista y el resumen readonly refleja los nuevos porcentajes

#### Scenario: Cancelar la edición del reparto no tiene efecto

- **WHEN** el usuario abre el drawer de reparto y lo cierra con `Cancelar`, scrim o `Esc`
- **THEN** el drawer se cierra, no se invoca ninguna mutación y el reparto permanece sin cambios
