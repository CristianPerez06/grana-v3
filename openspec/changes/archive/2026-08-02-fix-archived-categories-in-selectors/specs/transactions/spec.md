# transactions — delta

## MODIFIED Requirements

### Requirement: El selector de categoría del drawer permite drill a subcategorías

El sistema SHALL presentar la selección de categoría en un popover con dos niveles: nivel 0 lista las categorías (las que tienen subcategorías muestran indicador de drill `›`), y al entrar a una categoría drillable, nivel 1 muestra "Toda la categoría" más sus subcategorías. Seleccionar una categoría no drillable o "Toda la categoría" SHALL fijar la categoría sin subcategoría; seleccionar una subcategoría SHALL fijar categoría + subcategoría. Cuando la categoría fue autosugerida (`suggestCategoryFromHistory`), SHALL mostrarse un chip "Sugerida" que SHALL desaparecer al elegir manualmente.

**Ambos niveles ofrecen solo ítems activos.** El nivel 0 SHALL listar únicamente categorías con `is_active = true` y el nivel 1 únicamente subcategorías con `is_active = true`. El indicador de drill `›` SHALL derivarse de las subcategorías **ofrecibles**: una categoría cuyas subcategorías están todas archivadas NO SHALL mostrarse como drillable, para que el usuario no entre a un nivel 1 que solo contiene "Toda la categoría". La misma regla aplica al selector del formulario de recurrencias, que usa el mismo catálogo.

**Excepción de edición: el ítem ya asignado no se pierde.** Al editar un movimiento o una recurrencia cuya categoría o subcategoría fue archivada después de haberse asignado, el selector SHALL mostrar ese ítem —y, si es una subcategoría, la categoría padre que lo contiene— aunque esté inactivo, identificado como archivado, y el campo SHALL conservar la clasificación existente. Guardar sin tocar el selector NO SHALL borrar ni sustituir la categoría asignada. El ítem archivado así expuesto lo está solo por ser el valor actual de ese formulario: NO SHALL ofrecerse en el alta de un movimiento nuevo, ni quedar disponible para reasignarlo una vez que el usuario eligió otra cosa.

#### Scenario: Drill y selección de subcategoría

- **WHEN** el usuario abre el selector de categoría y entra a "Comida" (drillable) y elige "Almuerzo"
- **THEN** el formulario fija categoría "Comida" y subcategoría "Almuerzo" y cierra el popover

#### Scenario: Selección manual quita el chip Sugerida

- **WHEN** la categoría está autosugerida (chip "Sugerida" visible) y el usuario elige una categoría manualmente
- **THEN** el chip "Sugerida" desaparece

#### Scenario: El alta no ofrece categorías ni subcategorías archivadas

- **WHEN** el usuario abre el selector en el alta de un movimiento y el catálogo del usuario incluye una categoría archivada y una subcategoría archivada bajo una categoría activa
- **THEN** el nivel 0 no lista la categoría archivada
- **AND** el nivel 1 de la categoría activa no lista la subcategoría archivada

#### Scenario: Una categoría con todas sus subcategorías archivadas no se muestra drillable

- **WHEN** una categoría activa tiene subcategorías pero todas están archivadas
- **THEN** el nivel 0 la muestra sin indicador de drill `›`
- **AND** tocarla fija la categoría directamente, sin abrir un nivel 1

#### Scenario: Editar un movimiento con subcategoría archivada conserva su clasificación

- **WHEN** el usuario abre en edición un movimiento clasificado con la subcategoría "Delivery", archivada después de haberse asignado
- **THEN** el selector muestra "Comida › Delivery" como valor actual, identificado como archivado
- **AND** guardar sin tocar el selector deja el movimiento con la misma categoría y subcategoría

#### Scenario: Cambiar de categoría en edición no permite volver a la archivada

- **WHEN** el usuario edita ese movimiento y elige otra categoría
- **THEN** la subcategoría archivada deja de ofrecerse en el selector
