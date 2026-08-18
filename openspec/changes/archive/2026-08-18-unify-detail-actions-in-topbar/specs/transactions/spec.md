## RENAMED Requirements

- FROM: `### Requirement: Las acciones del detalle viven en un kebab menu`
- TO: `### Requirement: Las acciones del detalle viven en la topbar`

**Reason**: el título quedó desactualizado cuando una pasada anterior movió las acciones del kebab a la topbar; el cuerpo ya describía la topbar y el título seguía nombrando el kebab que ya no existe.

## MODIFIED Requirements

### Requirement: Las acciones del detalle viven en la topbar

El sistema SHALL exponer las acciones del detalle en la **topbar** de la pantalla, no en un kebab, no en un menú "···" y no como botones al pie. **Eliminar** y **Editar** SHALL ser dos icon buttons contiguos a la derecha de la topbar —Eliminar con hover en tono peligro, Editar en sólido navy—, **con la misma disposición en todos los viewports y en las tres superficies** (web escritorio, web en viewport angosto y app nativa). En viewport angosto la topbar es sticky, de modo que las dos acciones quedan a la vista durante todo el scroll. Cada plataforma SHALL adaptar el tratamiento visual a su propio header (la app nativa dibuja los iconos en blanco sobre el `PageHeader` navy); lo que NO SHALL divergir es la disposición: dos iconos, juntos, en la topbar.

Las acciones disponibles dependen de los permisos del usuario y del editable-state del movimiento (igual que hoy): **Editar** abre el drawer de edición en contexto cuando está disponible, o navega a `[txId]/edit`; **Eliminar** abre el `AlertDialog` con copy contextual (parent / card payment / default). Cuando el movimiento no permite ninguna acción, la topbar deja el slot de acciones vacío.

#### Scenario: Editar y Eliminar están en la topbar, en cualquier viewport

- **WHEN** el sistema renderiza el detalle de un gasto editable y eliminable, en viewport ancho o angosto
- **THEN** la topbar muestra a la derecha dos icon buttons contiguos: "Eliminar" y "Editar"
- **AND** no se renderea ningún menú kebab `⋯` ni menú "···"
- **AND** no se renderea ninguna barra inferior fija con la acción de editar

#### Scenario: En viewport angosto la topbar acompaña el scroll

- **WHEN** el usuario baja por el detalle en viewport angosto (≤600px)
- **THEN** la topbar queda sticky y las dos acciones siguen accesibles sin volver al principio
- **AND** el final de la página no queda tapado por ninguna barra fija

#### Scenario: Editar abre el drawer de edición en contexto

- **WHEN** el usuario toca "Editar" en un movimiento con drawer de edición disponible
- **THEN** se abre el drawer de edición en contexto (sin navegar a `[txId]/edit`)
