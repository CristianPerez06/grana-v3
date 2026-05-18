## ADDED Requirements

### Requirement: Catálogo de categorías del sistema

El sistema SHALL proveer 13 categorías padre pre-cargadas: 12 de tipo `expense` y 1 de tipo `income` (Ingresos). Cada categoría del sistema tiene subcategorías pre-cargadas. Las categorías del sistema tienen `user_id = NULL` y son visibles para todos los usuarios autenticados.

Las categorías del sistema no pueden ser editadas, archivadas ni eliminadas por ningún usuario.

#### Scenario: Categorías del sistema visibles a todos los usuarios

- **WHEN** un usuario autenticado consulta el catálogo de categorías
- **THEN** el sistema retorna las categorías del sistema (`user_id IS NULL`) con `is_active = true`
- **AND** cada categoría incluye sus subcategorías activas

#### Scenario: Modificación de categoría del sistema bloqueada

- **WHEN** cualquier usuario intenta actualizar o eliminar una categoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

---

### Requirement: canonical_name inmutable en categorías

Cada categoría y subcategoría SHALL tener un campo `canonical_name`: un slug asignado por el sistema en el momento de creación, derivado del nombre inicial, que nunca puede modificarse.

El `canonical_name` es único dentro del mismo `user_id` (o dentro del sistema si `user_id IS NULL`). Un cambio en el `name` visual no afecta el `canonical_name`.

#### Scenario: canonical_name asignado en creación

- **WHEN** un usuario crea una categoría con nombre "Comida rápida"
- **THEN** el sistema asigna `canonical_name = "comida-rapida"` automáticamente
- **AND** el `canonical_name` no es editable por el usuario

#### Scenario: canonical_name estable ante edición del nombre

- **WHEN** un usuario edita el nombre de su categoría de "Comida rápida" a "Fast food"
- **THEN** el `canonical_name` permanece `"comida-rapida"`
- **AND** solo el campo `name` se actualiza en DB

#### Scenario: Colisión de canonical_name dentro del mismo usuario

- **WHEN** un usuario intenta crear una segunda categoría con `canonical_name = "comida-rapida"`
- **THEN** la operación falla con error de unicidad
- **AND** el sistema informa que ya existe una categoría con ese nombre

---

### Requirement: El usuario puede crear categorías propias

Un usuario autenticado SHALL poder crear categorías personalizadas de tipo `expense`, `income`, o `both`. Las categorías propias conviven con las del sistema en el selector de categorías.

Una categoría propia tiene: nombre (1–50 caracteres), tipo, ícono opcional, color opcional. El `canonical_name` es asignado por el sistema.

#### Scenario: Creación exitosa de categoría propia

- **WHEN** un usuario envía nombre "Mascotas", tipo "expense", sin ícono ni color
- **THEN** el sistema crea la categoría con `user_id = auth.uid()`, `canonical_name = "mascotas"`, `is_active = true`
- **AND** la categoría aparece en el catálogo del usuario junto a las del sistema

#### Scenario: Nombre de categoría vacío o inválido

- **WHEN** un usuario envía un nombre con menos de 1 carácter o más de 50
- **THEN** la operación es rechazada con un error de validación descriptivo

---

### Requirement: El usuario puede editar sus categorías propias

Un usuario SHALL poder editar el `name`, `icon`, y `color` de sus propias categorías. No puede editar categorías del sistema ni categorías de otros usuarios.

#### Scenario: Edición de nombre de categoría propia

- **WHEN** un usuario edita el nombre de su categoría
- **THEN** el `name` se actualiza en DB
- **AND** el `canonical_name` permanece sin cambios

#### Scenario: Edición de categoría del sistema bloqueada

- **WHEN** un usuario intenta editar una categoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

---

### Requirement: El usuario puede archivar sus categorías propias

Un usuario SHALL poder archivar (soft delete: `is_active = false`) sus propias categorías. Una categoría archivada no aparece en selectores de nuevas transacciones, pero permanece visible en transacciones históricas que la referencian.

Una categoría que tiene transacciones asociadas puede archivarse. Una categoría que tiene transacciones asociadas NO puede eliminarse (hard delete).

Una categoría sin ninguna transacción asociada puede eliminarse definitivamente.

#### Scenario: Archivar categoría propia sin transacciones

- **WHEN** un usuario archiva una categoría propia que no tiene transacciones
- **THEN** `is_active` pasa a `false`
- **AND** la categoría ya no aparece en selectores de registro de movimientos
- **AND** la categoría puede eliminarse definitivamente a continuación

#### Scenario: Archivar categoría propia con transacciones

- **WHEN** un usuario archiva una categoría propia que tiene transacciones asociadas
- **THEN** `is_active` pasa a `false`
- **AND** las transacciones existentes siguen mostrando el nombre de la categoría

#### Scenario: Eliminar categoría con transacciones bloqueado

- **WHEN** un usuario intenta eliminar definitivamente una categoría que tiene transacciones
- **THEN** la operación es rechazada
- **AND** el sistema sugiere archivar en lugar de eliminar

---

### Requirement: El usuario puede crear subcategorías

Un usuario SHALL poder crear subcategorías bajo cualquier categoría activa (del sistema o propia). Las subcategorías propias tienen `user_id = auth.uid()`. Las subcategorías del sistema tienen `user_id = NULL`.

Una subcategoría siempre pertenece a exactamente una categoría padre. No hay subcategorías anidadas.

#### Scenario: Creación de subcategoría bajo categoría del sistema

- **WHEN** un usuario crea la subcategoría "Verdulería" bajo la categoría del sistema "Alimentación"
- **THEN** el sistema crea la subcategoría con `user_id = auth.uid()`, `category_id = <alimentacion_id>`
- **AND** la subcategoría aparece disponible al seleccionar "Alimentación"

#### Scenario: canonical_name de subcategoría único dentro de su categoría

- **WHEN** un usuario intenta crear dos subcategorías con el mismo nombre bajo la misma categoría
- **THEN** la segunda operación falla con error de unicidad en `(category_id, canonical_name)`

---

### Requirement: El usuario puede editar y archivar sus subcategorías

Un usuario SHALL poder editar el `name` de sus subcategorías propias, y archivarlas (`is_active = false`). No puede editar subcategorías del sistema.

Las mismas reglas de archivar/eliminar que aplican a categorías aplican a subcategorías.

#### Scenario: Edición de subcategoría propia

- **WHEN** un usuario edita el nombre de su subcategoría
- **THEN** solo el `name` se actualiza; `canonical_name` permanece inmutable

#### Scenario: Edición de subcategoría del sistema bloqueada

- **WHEN** un usuario intenta editar una subcategoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

---

### Requirement: Nombres de categorías del sistema son traducibles

Los nombres de las categorías del sistema SHALL mostrarse en el idioma activo del usuario. El sistema usa `canonical_name` como clave de traducción en `packages/i18n-messages` (secciones `categories.*` y `subcategories.*`).

Para categorías propias del usuario (sin entrada en i18n), el sistema SHALL mostrar el `name` almacenado en DB como fallback. Este fallback aplica siempre para categorías propias y nunca para categorías del sistema (que siempre tienen traducción).

#### Scenario: Nombre de categoría del sistema en idioma activo

- **WHEN** un usuario con idioma `en` ve la categoría con `canonical_name = "comida"`
- **THEN** el sistema muestra `"Food & Dining"` (traducción desde `en.json`)
- **AND** no muestra el `name` en español almacenado en DB

#### Scenario: Nombre de categoría propia sin traducción

- **WHEN** un usuario creó una categoría propia llamada "Mascotas"
- **THEN** el sistema muestra `"Mascotas"` independientemente del idioma activo
- **AND** no intenta buscar una clave i18n para esa categoría

#### Scenario: Subcategoría del sistema traducida

- **WHEN** un usuario con idioma `en` ve la subcategoría con `canonical_name = "supermercado"`
- **THEN** el sistema muestra la traducción desde `subcategories.supermercado` en `en.json`

---

### Requirement: Visualización de categorías en Configuración

El sistema SHALL mostrar una pantalla de gestión de categorías en la sección Configuración. La pantalla lista todas las categorías activas (sistema + propias) agrupadas, con acciones contextuales según el tipo.

Las categorías del sistema se muestran sin acciones de edición/archivar. Las categorías propias muestran acciones de editar y archivar. Ambas muestran la opción de agregar subcategorías.

#### Scenario: Lista de categorías con distinción sistema/propias

- **WHEN** un usuario navega a Configuración > Categorías
- **THEN** ve las categorías del sistema (sin acciones de editar/archivar) y las propias (con acciones)
- **AND** cada categoría muestra su nombre, tipo, y cantidad de subcategorías activas

#### Scenario: Acceso a subcategorías de una categoría

- **WHEN** un usuario toca una categoría en la lista
- **THEN** ve las subcategorías activas de esa categoría
- **AND** puede agregar nuevas subcategorías propias
- **AND** las subcategorías del sistema aparecen sin acciones de editar/archivar
