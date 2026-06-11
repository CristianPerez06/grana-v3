## MODIFIED Requirements

### Requirement: Visualización de categorías en Configuración

El sistema SHALL mostrar una pantalla de gestión de categorías en la sección Configuración. La pantalla lista todas las categorías activas (sistema + propias) agrupadas, con acciones contextuales según el tipo.

Las categorías del sistema se muestran sin acciones de edición/archivar. Las categorías propias muestran acciones de editar y archivar. Ambas muestran la opción de agregar subcategorías.

Las mutaciones de alta y edición SHALL ocurrir en un **drawer modal** disparado desde el listado/fila, sin cambiar de URL, alineadas con el patrón de `accounts` y `cards`:

- En `apps/web`, la acción `Agregar` del header del listado (`/settings/categories`) SHALL abrir un drawer que monta el form de crear categoría (`variant="drawer"`), en vez de navegar a `/settings/categories/new`.
- La acción `Editar` de una fila de categoría **propia** SHALL abrir un drawer con el form de editar preseteado (`variant="drawer"`), en vez de navegar a `/settings/categories/[id]/edit`. Las filas de categoría del sistema NO ofrecen acción de editar.
- Las pages `/settings/categories/new` y `/settings/categories/[id]/edit` SHALL conservarse como fallback no-JS / deep-link, renderizando el mismo form en `variant="page"` con su comportamiento actual (navegación al listado al éxito).
- Las acciones `Ver subcategorías`, `Archivar` y `Eliminar` y sus confirmaciones existentes NO cambian.

El estado abierto/cerrado del drawer SHALL ser estado local del componente y NO SHALL representarse en la URL.

#### Scenario: Lista de categorías con distinción sistema/propias

- **WHEN** un usuario navega a Configuración > Categorías
- **THEN** ve las categorías del sistema (sin acciones de editar/archivar) y las propias (con acciones)
- **AND** cada categoría muestra su nombre, tipo, y cantidad de subcategorías activas

#### Scenario: Acceso a subcategorías de una categoría

- **WHEN** un usuario toca una categoría en la lista
- **THEN** ve las subcategorías activas de esa categoría
- **AND** puede agregar nuevas subcategorías propias
- **AND** las subcategorías del sistema aparecen sin acciones de editar/archivar

#### Scenario: Crear categoría abre un drawer desde el listado (web)

- **WHEN** un usuario pulsa `Agregar` en `/settings/categories`
- **THEN** se abre un drawer modal con el form de crear categoría sobre el listado, sin navegar a otra URL
- **AND** el form expone los mismos campos (`name`, `type`, `icon`, `color`), validaciones, field errors, form error y estado de submitting que la page actual

#### Scenario: Editar categoría propia abre un drawer desde la fila (web)

- **WHEN** un usuario pulsa `Editar` en una fila de categoría propia
- **THEN** se abre un drawer con el form de edición preseteado (`name`, `icon`, `color`) sin navegar a `/settings/categories/[id]/edit`
- **AND** en filas de categoría del sistema no se ofrece la acción `Editar`

#### Scenario: Guardar cierra el drawer y refresca el listado (web)

- **WHEN** el submit del drawer (crear o editar) retorna `ok`
- **THEN** el drawer se cierra
- **AND** el listado refleja el alta/edición sin recarga manual (vía `router.refresh()`)

#### Scenario: Cancelar o cerrar el drawer no muta datos

- **WHEN** un usuario cierra el drawer por scrim, `Esc`, o el botón de cancelar, con o sin cambios en el form
- **THEN** no se invoca la mutation
- **AND** el listado permanece sin cambios
- **AND** no se muestra ningún aviso de cambios sin guardar

#### Scenario: La page dedicada sigue como fallback no-JS

- **WHEN** un usuario abre directamente `/settings/categories/new` o `/settings/categories/[id]/edit` (deep-link o sin JS)
- **THEN** la page monta el form en `variant="page"` con su comportamiento actual (al éxito navega de vuelta al listado)

### Requirement: Alta de categoría propia en mobile (mobile)

`apps/mobile` SHALL permitir crear una categoría propia desde un **bottom-sheet** (`components/ui/Drawer`) disparado desde el listado de categorías, sin navegar a otra pantalla. El formulario SHALL validar con `createCategorySchema` de `@grana/validation` antes de invocar el insert en Supabase. Al éxito, el sheet se cierra y la lista de categorías refleja la nueva categoría.

La pantalla `/(app)/settings/categories/new` SHALL conservarse como fallback de deep-link, montando el mismo form. El botón físico de back de Android SHALL cerrar el sheet cuando está abierto, sin popear la pantalla del listado.

#### Scenario: Creación exitosa desde mobile

- **WHEN** un usuario abre el sheet de crear categoría desde la lista y lo envía con nombre "Mascotas", tipo "expense"
- **THEN** el cliente Supabase mobile inserta la categoría con `user_id = auth.uid()`, `canonical_name = "mascotas"`, `is_active = true`
- **AND** el sheet se cierra y la nueva categoría aparece en la lista sin navegar a otra pantalla

#### Scenario: Colisión de nombre desde mobile

- **WHEN** un usuario intenta crear una segunda categoría con `canonical_name = "mascotas"`
- **THEN** el insert falla con Postgres `23505`
- **AND** el form en el sheet muestra un mensaje i18n indicando que ya existe una categoría con ese nombre, y el sheet permanece abierto

#### Scenario: Validación de nombre vacío desde mobile

- **WHEN** un usuario envía el form con nombre vacío
- **THEN** la validación Yup falla antes de tocar Supabase
- **AND** el form muestra el error de validación localizado y el sheet permanece abierto

#### Scenario: Back de Android cierra el sheet de alta

- **WHEN** el sheet de crear categoría está abierto y el usuario presiona el back físico de Android
- **THEN** el sheet se cierra
- **AND** la app permanece en `/(app)/settings/categories`

### Requirement: Edición de categoría propia en mobile (mobile)

`apps/mobile` SHALL permitir editar `name`, `icon` y `color` de una categoría propia desde un **bottom-sheet** (`components/ui/Drawer`) disparado desde la fila/lista de categorías, sin navegar a otra pantalla. El sheet SHALL bloquear la edición (no permitir guardar y mostrar un mensaje) si el `id` corresponde a una categoría con `user_id IS NULL` (sistema); las filas de sistema no exponen la acción de editar. RLS rechaza la operación; el cliente solo evita el viaje a DB innecesario.

El `canonical_name` SHALL NO ser editable (campo no presente en el form). La pantalla `/(app)/settings/categories/[id]/edit` SHALL conservarse como fallback de deep-link. El back físico de Android SHALL cerrar el sheet cuando está abierto.

#### Scenario: Edición de nombre de categoría propia desde mobile

- **WHEN** un usuario abre el sheet de edición de su categoría y cambia el nombre a "Fast food"
- **THEN** el update en Supabase actualiza solo el campo `name`
- **AND** el `canonical_name` permanece sin cambios
- **AND** el sheet se cierra y la lista muestra el nombre actualizado

#### Scenario: Categoría del sistema no es editable desde mobile

- **WHEN** un usuario llega al form de edición con `id` de una categoría sistema (vía deep-link a `/(app)/settings/categories/[id]/edit`)
- **THEN** la pantalla muestra que la categoría no es editable
- **AND** NO permite enviar el form
- **AND** las filas de categoría del sistema en la lista no ofrecen la acción de editar

### Requirement: Alta de subcategoría propia en mobile (mobile)

`apps/mobile` SHALL permitir crear una subcategoría propia bajo una categoría existente (sistema o propia) desde un **bottom-sheet** (`components/ui/Drawer`) disparado desde el listado de subcategorías (`/(app)/settings/categories/[id]/subcategories`), sin navegar a otra pantalla. El insert SHALL setear `user_id = auth.uid()` y `category_id = [id]`. La validación SHALL usar `createSubcategorySchema` de `@grana/validation`.

La pantalla `/(app)/settings/categories/[id]/subcategories/new` SHALL conservarse como fallback de deep-link. El back físico de Android SHALL cerrar el sheet cuando está abierto. No existe edición de subcategoría y este change NO la agrega.

#### Scenario: Subcategoría bajo categoría sistema desde mobile

- **WHEN** un usuario abre el sheet de crear subcategoría desde la lista de subcategorías de la categoría sistema "Comida" y crea "Verdulería"
- **THEN** el insert tiene `user_id = auth.uid()`, `category_id = <comida_id>`
- **AND** el sheet se cierra y la subcategoría aparece en la lista de subcategorías de "Comida"

#### Scenario: Colisión de subcategoría desde mobile

- **WHEN** un usuario intenta crear dos subcategorías con el mismo `canonical_name` bajo la misma categoría
- **THEN** el segundo insert falla con Postgres `23505`
- **AND** el form en el sheet muestra un mensaje i18n indicando duplicado y el sheet permanece abierto

## ADDED Requirements

### Requirement: Creación de subcategoría en drawer desde Configuración (web)

`apps/web` SHALL ofrecer la creación de subcategorías desde el listado de subcategorías (`/settings/categories/[id]/subcategories`) en un drawer modal disparado por la acción `Agregar`, sin navegar a `/settings/categories/[id]/subcategories/new`. El drawer monta el form de crear subcategoría (`variant="drawer"`) con el `category_id` tomado del path. La page `/settings/categories/[id]/subcategories/new` SHALL conservarse como fallback no-JS / deep-link, montando el form en `variant="page"`.

La creación de subcategoría SHALL permitirse bajo categorías propias y categorías del sistema, y NO bajo categorías de otro usuario, conservando las reglas de ownership existentes. Este requirement NO agrega edición de subcategoría: no existe hoy en web y no se introduce.

#### Scenario: Crear subcategoría abre un drawer desde el listado

- **WHEN** un usuario pulsa `Agregar` en `/settings/categories/[id]/subcategories`
- **THEN** se abre un drawer con el form de crear subcategoría sobre el listado, con `category_id` = `[id]` del path, sin navegar a otra URL
- **AND** el form conserva los mismos campos (`name`), validaciones, field/form errors y estado de submitting que la page actual

#### Scenario: Guardar cierra el drawer y refresca la lista de subcategorías

- **WHEN** el submit del drawer de subcategoría retorna `ok`
- **THEN** el drawer se cierra
- **AND** la lista de subcategorías refleja el alta sin recarga manual (vía `router.refresh()`)

#### Scenario: Ownership de creación de subcategoría preservado

- **WHEN** un usuario abre el drawer de crear subcategoría bajo una categoría propia o del sistema
- **THEN** la creación se permite con `user_id = auth.uid()` y `category_id` de la categoría
- **AND** bajo una categoría de otro usuario la acción de agregar no está disponible

#### Scenario: La page dedicada de subcategoría sigue como fallback

- **WHEN** un usuario abre directamente `/settings/categories/[id]/subcategories/new` (deep-link o sin JS)
- **THEN** la page monta el form de crear subcategoría en `variant="page"` con su comportamiento actual
