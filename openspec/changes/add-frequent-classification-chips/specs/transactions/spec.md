## ADDED Requirements

### Requirement: El alta ofrece las clasificaciones más frecuentes como aceleradores de un tap

En modo create, el formulario de alta SHALL ofrecer las clasificaciones-hoja `(categoría, subcategoría)` que el usuario usó con más frecuencia recientemente, como chips de un solo gesto, derivadas de su historial de movimientos. Un gesto sobre un chip SHALL asignar su categoría y —si la hoja la incluye— su subcategoría, dejando el movimiento listo para guardar sin abrir el selector de categoría. Los chips son una sugerencia: la selección resultante SHALL seguir siendo visible y editable, y elegir un chip nunca clasifica en silencio.

El conjunto ofrecido SHALL derivarse solo de datos ya disponibles (historial del propio usuario), acotado a las hojas compatibles con el tipo de movimiento activo, y SHALL excluir toda hoja cuya categoría o subcategoría esté archivada o ya no exista en el catálogo vigente. Cuando no hay historial suficiente para el tipo activo, el formulario SHALL no mostrar chips y comportarse igual que sin esta funcionalidad. Esta funcionalidad no modifica ninguna regla contable ni el significado de los campos del movimiento.

#### Scenario: Un chip frecuente asigna la clasificación de un tap

- **WHEN** el usuario abre el alta en un tipo con historial y toca un chip de clasificación frecuente cuya hoja es "Comida › Pedidos Ya"
- **THEN** el movimiento queda con esa categoría y esa subcategoría asignadas
- **AND** puede guardarse sin abrir el selector de categoría

#### Scenario: Los chips respetan el tipo activo

- **WHEN** el usuario está en el tipo `ingreso`
- **THEN** los chips ofrecidos son solo clasificaciones compatibles con `ingreso`
- **AND** ninguna hoja exclusiva de `gasto` aparece como chip

#### Scenario: Las hojas archivadas no se ofrecen

- **WHEN** una de las clasificaciones históricamente frecuentes del usuario tiene su categoría o subcategoría archivada
- **THEN** esa hoja no aparece entre los chips

#### Scenario: Sin historial no hay chips

- **WHEN** el usuario no tiene historial suficiente para el tipo activo
- **THEN** el formulario no muestra chips de clasificación frecuente
- **AND** el selector de categoría funciona igual que sin esta funcionalidad

#### Scenario: En edición no se ofrecen chips

- **WHEN** el formulario se abre en modo edición de un movimiento existente
- **THEN** no se ofrecen chips de clasificación frecuente
