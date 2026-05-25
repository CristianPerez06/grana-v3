# categories Specification

## Purpose

Define el catálogo de categorías (y subcategorías) del sistema y las categorías propias del usuario que clasifican transacciones de ingreso, gasto o ambos. Cubre el seed inmutable de 17 categorías + 31 subcategorías sistema visibles a todos los usuarios, las reglas de `canonical_name` único e inmutable, las operaciones del usuario sobre sus propias categorías (crear, editar, archivar, eliminar) con las salvaguardas correspondientes, y la traducción i18n de los nombres del sistema. Sirve de base para `transactions`, `cards` y `recurring-movements`.
## Requirements
### Requirement: Catálogo de categorías del sistema

El sistema SHALL proveer 17 categorías padre pre-cargadas: 12 de tipo `expense` y 5 de tipo `income`. Cada categoría del sistema tiene subcategorías pre-cargadas (31 en total). Las categorías del sistema tienen `user_id = NULL` y son visibles para todos los usuarios autenticados.

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

Una categoría propia tiene: nombre (1–60 caracteres), tipo, ícono opcional, color opcional. El `canonical_name` es asignado por el sistema.

#### Scenario: Creación exitosa de categoría propia

- **WHEN** un usuario envía nombre "Mascotas", tipo "expense", sin ícono ni color
- **THEN** el sistema crea la categoría con `user_id = auth.uid()`, `canonical_name = "mascotas"`, `is_active = true`
- **AND** la categoría aparece en el catálogo del usuario junto a las del sistema

#### Scenario: Nombre de categoría vacío o inválido

- **WHEN** un usuario envía un nombre con menos de 1 carácter o más de 60
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

- **WHEN** un usuario crea la subcategoría "Verdulería" bajo la categoría del sistema "Comida"
- **THEN** el sistema crea la subcategoría con `user_id = auth.uid()`, `category_id = <comida_id>`
- **AND** la subcategoría aparece disponible al seleccionar "Comida"

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

### Requirement: Visualización y administración de categorías en mobile (mobile)

`apps/mobile` SHALL exponer una pantalla `/(app)/settings/categories` que lista todas las categorías activas (sistema + propias) agrupadas por tipo (`income`, `expense`, `both`), con acciones contextuales según el tipo. Las categorías de sistema SHALL mostrarse sin acciones de editar/archivar/eliminar. Las categorías propias SHALL mostrar acciones de editar y archivar (y eliminar definitivo cuando no tienen transacciones asociadas, una vez que ese check esté implementado en backend).

Las queries SHALL ir contra el cliente Supabase de mobile (`apps/mobile/lib/supabase.ts`) directamente, sin server actions. La validación de inputs SHALL usar los schemas de `@grana/validation` ya compartidos con web (`createCategorySchema`, `updateCategorySchema`, `createSubcategorySchema`, `updateSubcategorySchema`).

Las reglas de negocio (RLS para bloquear edición de categorías sistema, unicidad de `canonical_name` por usuario, archivar vs. eliminar, `canonical_name` inmutable) ya están enforced en DB y aplican igual al cliente mobile. Errores conocidos de Postgres (ej. `23505` por colisión de `canonical_name`) SHALL mapearse a strings i18n traducibles.

Los nombres de categorías y subcategorías de sistema SHALL renderearse a través de `useT()` usando `canonical_name` como clave (sección `categories.*` y `subcategories.*` del catálogo), respetando el locale activo.

#### Scenario: Lista de categorías mobile distingue sistema y propias

- **WHEN** un usuario abre `/(app)/settings/categories`
- **THEN** ve las categorías del sistema sin botones de editar/archivar
- **AND** ve sus categorías propias con botones de editar y archivar
- **AND** cada categoría muestra su nombre traducido (sistema) o literal (propia), tipo, y cantidad de subcategorías activas

#### Scenario: Acceso a subcategorías de una categoría desde mobile

- **WHEN** un usuario presiona una categoría en la lista mobile
- **THEN** navega a `/(app)/settings/categories/[id]/subcategories`
- **AND** ve las subcategorías activas de esa categoría
- **AND** puede agregar nuevas subcategorías propias

---

### Requirement: Alta de categoría propia en mobile (mobile)

`apps/mobile` SHALL exponer una pantalla `/(app)/settings/categories/new` con un formulario que permite crear una categoría propia. El formulario SHALL validar con `createCategorySchema` de `@grana/validation` antes de invocar el insert en Supabase. Al éxito, navega de vuelta a la lista de categorías.

#### Scenario: Creación exitosa desde mobile

- **WHEN** un usuario envía el form con nombre "Mascotas", tipo "expense"
- **THEN** el cliente Supabase mobile inserta la categoría con `user_id = auth.uid()`, `canonical_name = "mascotas"`, `is_active = true`
- **AND** la app vuelve a `/(app)/settings/categories` con la nueva categoría visible en la lista

#### Scenario: Colisión de nombre desde mobile

- **WHEN** un usuario intenta crear una segunda categoría con `canonical_name = "mascotas"`
- **THEN** el insert falla con Postgres `23505`
- **AND** el form muestra un mensaje i18n indicando que ya existe una categoría con ese nombre

#### Scenario: Validación de nombre vacío desde mobile

- **WHEN** un usuario envía el form con nombre vacío
- **THEN** la validación Yup falla antes de tocar Supabase
- **AND** el form muestra el error de validación localizado

---

### Requirement: Edición de categoría propia en mobile (mobile)

`apps/mobile` SHALL exponer una pantalla `/(app)/settings/categories/[id]/edit` para editar `name`, `icon` y `color` de una categoría propia. La pantalla SHALL bloquear la edición (no permitir guardar y mostrar un mensaje) si el `id` corresponde a una categoría con `user_id IS NULL` (sistema). RLS rechaza la operación; el cliente solo evita el viaje a DB innecesario.

El `canonical_name` SHALL NO ser editable (campo no presente en el form).

#### Scenario: Edición de nombre de categoría propia desde mobile

- **WHEN** un usuario edita el nombre de su categoría a "Fast food"
- **THEN** el update en Supabase actualiza solo el campo `name`
- **AND** el `canonical_name` permanece sin cambios
- **AND** la app vuelve a la lista con el nombre actualizado

#### Scenario: Intento de editar categoría del sistema desde mobile

- **WHEN** un usuario navega a `/(app)/settings/categories/[id]/edit` con `id` de una categoría sistema
- **THEN** la pantalla muestra que la categoría no es editable
- **AND** NO permite enviar el form

---

### Requirement: Alta de subcategoría propia en mobile (mobile)

`apps/mobile` SHALL exponer una pantalla `/(app)/settings/categories/[id]/subcategories/new` para crear una subcategoría propia bajo una categoría existente (sistema o propia). El insert SHALL setear `user_id = auth.uid()` y `category_id = [id]`. La validación SHALL usar `createSubcategorySchema` de `@grana/validation`.

#### Scenario: Subcategoría bajo categoría sistema desde mobile

- **WHEN** un usuario crea la subcategoría "Verdulería" bajo la categoría sistema "Comida" desde mobile
- **THEN** el insert tiene `user_id = auth.uid()`, `category_id = <comida_id>`
- **AND** la subcategoría aparece en la lista de subcategorías de "Comida"

#### Scenario: Colisión de subcategoría desde mobile

- **WHEN** un usuario intenta crear dos subcategorías con el mismo `canonical_name` bajo la misma categoría
- **THEN** el segundo insert falla con Postgres `23505`
- **AND** el form muestra un mensaje i18n indicando duplicado

---

### Requirement: Archivar categoría propia desde mobile (mobile)

`apps/mobile` SHALL permitir al usuario archivar (`is_active = false`) sus categorías propias desde la lista de categorías. Una categoría archivada SHALL desaparecer de la lista mobile (que filtra por `is_active = true`). Las subcategorías SHALL seguir las mismas reglas y exponer la misma acción desde la pantalla de subcategorías.

#### Scenario: Archivar categoría propia desde mobile

- **WHEN** un usuario presiona "Archivar" en una categoría propia
- **THEN** Supabase actualiza `is_active = false` para esa categoría
- **AND** la categoría deja de aparecer en la lista mobile
- **AND** las transacciones históricas que la referencian siguen mostrando el nombre

#### Scenario: Archivar categoría del sistema bloqueado en mobile

- **WHEN** un usuario intenta archivar una categoría con `user_id IS NULL` (no debería verse el botón, pero si llega vía deep link o un edge case)
- **THEN** la operación es rechazada por RLS
- **AND** el cliente muestra un error genérico no bloqueante

