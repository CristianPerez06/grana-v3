## ADDED Requirements

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
