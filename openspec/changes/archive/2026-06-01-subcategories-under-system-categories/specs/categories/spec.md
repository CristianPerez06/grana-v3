## MODIFIED Requirements

### Requirement: El usuario puede editar y archivar sus subcategorías

Un usuario SHALL poder editar el `name` de sus subcategorías propias, y archivarlas (`is_active = false`). No puede editar subcategorías del sistema.

Las mismas reglas de archivar/eliminar que aplican a categorías aplican a subcategorías. Las acciones de gestión (editar, archivar, eliminar) de una subcategoría SHALL depender de la propiedad de **esa** subcategoría (`user_id`), NO de la categoría padre: una subcategoría propia del usuario es gestionable aunque cuelgue de una categoría del sistema; una subcategoría del sistema (`user_id IS NULL`) es read-only. En consecuencia, la pantalla de subcategorías (web) SHALL ofrecer "Agregar subcategoría" también bajo categorías del sistema y mostrar las acciones por fila según el dueño de cada subcategoría.

#### Scenario: Edición de subcategoría propia

- **WHEN** un usuario edita el nombre de su subcategoría
- **THEN** solo el `name` se actualiza; `canonical_name` permanece inmutable

#### Scenario: Edición de subcategoría del sistema bloqueada

- **WHEN** un usuario intenta editar una subcategoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Subcategoría propia bajo categoría del sistema es gestionable (web)

- **WHEN** un usuario abre las subcategorías de una categoría del sistema que incluye una subcategoría propia suya
- **THEN** las subcategorías del sistema se muestran sin acciones (read-only)
- **AND** su subcategoría propia se muestra con acciones de archivar/eliminar
