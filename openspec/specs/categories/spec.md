# categories Specification

## Purpose

Define el catálogo de categorías (y subcategorías) del sistema y las categorías propias del usuario que clasifican transacciones de ingreso, gasto o ambos. Cubre el seed de 18 categorías + 71 subcategorías sistema (enfocado en Argentina) visibles a todos los usuarios, enriquecido de forma aditiva mediante migraciones incrementales; las reglas de `canonical_name` único e inmutable, las operaciones del usuario sobre sus propias categorías (crear, editar, archivar, eliminar) con las salvaguardas correspondientes, y la traducción i18n de los nombres del sistema. Sirve de base para `transactions`, `cards` y `recurring-movements`.
## Requirements
### Requirement: Catálogo de categorías del sistema

El sistema SHALL proveer 18 categorías padre pre-cargadas: 13 de tipo `expense` y 5 de tipo `income`. Cada categoría del sistema tiene subcategorías pre-cargadas (71 en total), con la excepción de `Reintegros/Cashback`, que se provee sin subcategorías. Las categorías del sistema tienen `user_id = NULL` y son visibles para todos los usuarios autenticados.

El catálogo por defecto está enfocado en Argentina: mantiene marcas locales reconocibles (Netflix, PedidosYa, Rappi, Uber/Cabify) y rubros propios del país (Monotributo, Tasas municipales, Expensas, Prepaga, SUBE, VTV, Patente, Aguinaldo, Compra dólar/MEP, entre otros).

El catálogo SHALL enriquecerse de forma aditiva: nuevas categorías/subcategorías de sistema se incorporan mediante migraciones incrementales (`INSERT ... ON CONFLICT DO NOTHING`), sin editar el seed inicial ya aplicado, sin borrar filas existentes y sin modificar ningún `canonical_name` existente. Un cambio en la etiqueta visible de una categoría/subcategoría de sistema se realiza editando su traducción i18n (`categories.*` / `subcategories.*`), nunca su `canonical_name`.

Las categorías del sistema no pueden ser editadas, archivadas ni eliminadas por ningún usuario.

#### Scenario: Categorías del sistema visibles a todos los usuarios

- **WHEN** un usuario autenticado consulta el catálogo de categorías
- **THEN** el sistema retorna las categorías del sistema (`user_id IS NULL`) con `is_active = true`
- **AND** cada categoría incluye sus subcategorías activas

#### Scenario: Modificación de categoría del sistema bloqueada

- **WHEN** cualquier usuario intenta actualizar o eliminar una categoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Enriquecimiento aditivo del catálogo de sistema

- **WHEN** una migración incremental agrega nuevas categorías/subcategorías de sistema
- **THEN** las filas se insertan con `ON CONFLICT DO NOTHING` sin duplicar las existentes
- **AND** los `canonical_name` y las filas previas permanecen sin cambios
- **AND** las transacciones, recurrencias e instancias que referencian categorías previas no se ven afectadas

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

### Requirement: La selección de ícono y color de una categoría es por picker (web)

En los formularios web de alta (`/settings/categories/new`) y edición (`/settings/categories/[id]/edit`) de categorías propias, el `icon` y el `color` SHALL elegirse mediante controles de selección, no por entrada de texto libre:

- El `icon` SHALL elegirse desde una grilla curada de emojis (en un `Popover`), con una opción para dejarlo vacío ("Sin ícono"). El valor almacenado sigue siendo un string emoji.
- El `color` SHALL elegirse desde una paleta preset de swatches (cada uno con forma `#RRGGBB`, válida contra el schema) más un selector de color nativo para un color personalizado, con una opción para dejarlo vacío ("Sin color").

La selección NO SHALL cambiar el contrato de datos: `icon` se persiste como string y `color` como hex `#RRGGBB`; categorías existentes con cualquier valor previo siguen renderizando sin cambios.

#### Scenario: Elegir ícono desde la grilla

- **WHEN** el usuario abre el picker de ícono y toca un emoji de la grilla
- **THEN** el formulario adopta ese emoji como `icon` y cierra el popover

#### Scenario: Elegir color desde la paleta

- **WHEN** el usuario toca un swatch de la paleta
- **THEN** el formulario adopta ese hex como `color`

#### Scenario: Limpiar ícono o color

- **WHEN** el usuario usa "Sin ícono" o "Sin color"
- **THEN** el campo correspondiente queda vacío y la categoría se guarda con `icon`/`color` en `null`

---

### Requirement: El usuario puede archivar sus categorías propias

Un usuario SHALL poder archivar (soft delete: `is_active = false`) sus propias categorías. Una categoría archivada no aparece en selectores de nuevas transacciones, pero permanece visible en transacciones históricas que la referencian.

**El ocultamiento alcanza a los dos niveles del selector.** Una subcategoría archivada (`is_active = false`) NO SHALL ofrecerse al elegir clasificación para un movimiento o una recurrencia nuevos, esté su categoría padre activa o no. La regla no es "la categoría archivada desaparece": es que **ningún ítem inactivo se ofrece**, en el nivel de categoría y en el de subcategoría por igual. El filtro SHALL aplicarse en la lectura del catálogo de categorías —incluyendo las subcategorías embebidas en cada categoría— y NO SHALL delegarse a que cada consumer recuerde re-filtrar: un catálogo que entrega ítems inactivos es un read incorrecto, y un consumer que los tapa esconde el defecto en vez de arreglarlo.

**La desaparición es inmediata, no eventual.** Archivar o eliminar una categoría o subcategoría SHALL sacarla de los selectores en la sesión en curso, sin depender de que venza una política de frescura de cache ni de que el usuario recargue la app. Un catálogo cacheado que sigue ofreciendo una categoría ya eliminada de la base es un incumplimiento de este requirement, no una demora aceptable.

Una categoría que está **en uso** puede archivarse. Una categoría en uso NO puede eliminarse (hard delete). Se considera "en uso" cuando es referenciada por al menos una fila en `transactions`, `recurrences` o `recurrence_instances`, ya sea directamente (por `category_id`) o a través de cualquiera de sus subcategorías hijas (por `subcategory_id`). Esta garantía SHALL estar enforced en la DB: los FK de `category_id` y `subcategory_id` en esas tablas son `ON DELETE RESTRICT`, de modo que el bloqueo aplica a todos los clientes (web, mobile, SQL manual) y no depende de que cada frontend lo recuerde. Los clientes SHALL además consultar esas tablas antes de borrar (incluyendo las referencias a las subcategorías hijas al borrar una categoría) para devolver un mensaje accionable ("archivá en lugar de eliminar") en vez de un error de FK crudo.

Una categoría sin ninguna referencia directa ni a través de sus subcategorías puede eliminarse definitivamente.

#### Scenario: Archivar categoría propia sin uso

- **WHEN** un usuario archiva una categoría propia que no está en uso
- **THEN** `is_active` pasa a `false`
- **AND** la categoría ya no aparece en selectores de registro de movimientos
- **AND** la categoría puede eliminarse definitivamente a continuación

#### Scenario: Archivar categoría propia en uso

- **WHEN** un usuario archiva una categoría propia que tiene transacciones o recurrencias asociadas
- **THEN** `is_active` pasa a `false`
- **AND** las transacciones y recurrencias existentes siguen mostrando el nombre de la categoría

#### Scenario: Una subcategoría archivada no se ofrece bajo una categoría activa

- **WHEN** el usuario archiva la subcategoría "Delivery" de una categoría "Comida" que sigue activa
- **AND** después abre el selector de categoría de un movimiento nuevo y entra a "Comida"
- **THEN** "Delivery" no figura entre las subcategorías ofrecidas
- **AND** el resto de las subcategorías activas de "Comida" se sigue ofreciendo

#### Scenario: El catálogo no entrega subcategorías inactivas

- **WHEN** un consumer lee el catálogo de categorías con sus subcategorías
- **THEN** ninguna categoría del resultado incluye subcategorías con `is_active = false`
- **AND** el consumer puede listarlas tal cual las recibe sin re-filtrar por `is_active`

#### Scenario: Archivar saca la categoría del selector en la misma sesión

- **WHEN** el usuario archiva una categoría propia desde Configuración y a continuación abre el formulario de alta de movimiento sin recargar la app
- **THEN** la categoría archivada no aparece en el selector

#### Scenario: Una categoría eliminada no sobrevive en el selector

- **WHEN** el usuario elimina definitivamente una categoría propia sin uso y a continuación abre el formulario de alta de movimiento sin recargar la app
- **THEN** la categoría eliminada no aparece en el selector

#### Scenario: Eliminar categoría en uso bloqueado

- **WHEN** un usuario intenta eliminar definitivamente una categoría referenciada por una transacción, una recurrencia o una instancia de recurrencia
- **THEN** la operación es rechazada (por el guard de aplicación y, como última barrera, por el FK `ON DELETE RESTRICT`)
- **AND** el sistema sugiere archivar en lugar de eliminar

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

### Requirement: Visualización y administración de categorías en mobile (mobile)

`apps/mobile` SHALL exponer una pantalla `/(app)/settings/categories` que lista todas las categorías activas (sistema + propias) agrupadas por tipo (`income`, `expense`, `both`), con acciones contextuales según el tipo. Las categorías de sistema SHALL mostrarse sin acciones de editar/archivar/eliminar. Las categorías propias SHALL mostrar acciones de editar y archivar (y eliminar definitivo cuando no están en uso). El check de uso contra `transactions`, `recurrences` y `recurrence_instances` está implementado en `apps/mobile/lib/categories.ts` y respaldado por los FK `ON DELETE RESTRICT` de la DB.

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

### Requirement: Edición de categoría propia en mobile (mobile)

`apps/mobile` SHALL permitir editar `name`, `icon` y `color` de una categoría propia desde la **pantalla pusheada** `/(app)/settings/categories/[id]/edit`, navegada desde la acción "Editar" del menú de la fila. La pantalla SHALL bloquear la edición (no permitir guardar y mostrar un mensaje) si el `id` corresponde a una categoría con `user_id IS NULL` (sistema); las filas de sistema no exponen la acción de editar. RLS rechaza la operación; el cliente solo evita el viaje a DB innecesario.

El `canonical_name` SHALL NO ser editable (campo no presente en el form). La pantalla SHALL usar `FormScreen`, con el mismo chrome que el resto de los formularios mobile. El back físico de Android y el gesto de back de iOS SHALL popear la pantalla sin guardar.

Misma divergencia deliberada respecto de web que en el alta: web conserva el drawer.

#### Scenario: Edición de nombre de categoría propia desde mobile

- **WHEN** un usuario abre la pantalla de edición de su categoría y cambia el nombre a "Fast food"
- **THEN** el update en Supabase actualiza solo el campo `name`
- **AND** el `canonical_name` permanece sin cambios
- **AND** la pantalla se popea y la lista muestra el nombre actualizado

#### Scenario: Categoría del sistema no es editable desde mobile

- **WHEN** un usuario llega al form de edición con `id` de una categoría sistema (vía deep-link a `/(app)/settings/categories/[id]/edit`)
- **THEN** la pantalla muestra que la categoría no es editable
- **AND** NO permite enviar el form
- **AND** las filas de categoría del sistema en la lista no ofrecen la acción de editar

### Requirement: Alta de subcategoría propia en mobile (mobile)

`apps/mobile` SHALL permitir crear una subcategoría propia bajo una categoría existente (sistema o propia) desde la **pantalla pusheada** `/(app)/settings/categories/[id]/subcategories/new`, navegada desde la acción "Agregar" del header del listado de subcategorías. El insert SHALL setear `user_id = auth.uid()` y `category_id = [id]`. La validación SHALL usar `createSubcategorySchema` de `@grana/validation`.

La pantalla SHALL usar `FormScreen`, con el mismo chrome que el resto de los formularios mobile. El back físico de Android y el gesto de back de iOS SHALL popear la pantalla sin guardar. No existe edición de subcategoría y este change NO la agrega.

Misma divergencia deliberada respecto de web que en el alta de categoría.

#### Scenario: Subcategoría bajo categoría sistema desde mobile

- **WHEN** un usuario navega a la pantalla de crear subcategoría desde la lista de subcategorías de la categoría sistema "Comida" y crea "Verdulería"
- **THEN** el insert tiene `user_id = auth.uid()`, `category_id = <comida_id>`
- **AND** la pantalla se popea y la subcategoría aparece en la lista de subcategorías de "Comida"

#### Scenario: Colisión de subcategoría desde mobile

- **WHEN** un usuario intenta crear dos subcategorías con el mismo `canonical_name` bajo la misma categoría
- **THEN** el segundo insert falla con Postgres `23505`
- **AND** el form muestra un mensaje i18n indicando duplicado y la pantalla permanece abierta

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

### Requirement: Crear categoría propia en mobile (mobile)

Sucede a la antigua "Alta de categoría propia en mobile (mobile)", que fijaba esta misma capacidad sobre un bottom-sheet (`components/ui/Drawer`); el cambio de superficie se archivó en `2026-08-02-mobile-keyboard-avoidance`.

`apps/mobile` SHALL permitir crear una categoría propia desde la **pantalla pusheada** `/(app)/settings/categories/new`, navegada desde la acción "Agregar" del header del listado. El formulario SHALL validar con `createCategorySchema` de `@grana/validation` antes de invocar el insert en Supabase. Al éxito, la pantalla se popea y la lista de categorías refleja la nueva categoría (el listado refetchea on focus).

La pantalla SHALL usar el shell de formulario del app shell (`FormScreen`, ver capability `mobile-app-shell`), de modo que presente el mismo chrome que cualquier otra pantalla de formulario mobile: banda navy de `PageHeader` con título y back-link, y compensación de teclado. NO SHALL renderizar un header ad-hoc ni un botón de cierre propio.

**Divergencia deliberada respecto de web**: `apps/web` conserva el drawer modal (alineado con `accounts` y `cards`), donde el patrón funciona porque el drawer es un panel lateral sobre contenido visible. En un teléfono ese drawer ocupa el 100% del ancho, con lo cual deja de leerse como panel y pasa a ser una pantalla completa — pero sin las affordances de navegación de una: sin gesto de back en iOS, sin back físico de Android popeando, y con el cierre dependiendo de un único botón X. Cuando ese botón no responde, el usuario queda encerrado en el formulario. La pantalla pusheada elimina la clase de bug entera en vez de parchearla.

#### Scenario: Creación exitosa desde mobile

- **WHEN** un usuario navega a la pantalla de crear categoría desde la lista y la envía con nombre "Mascotas", tipo "expense"
- **THEN** el cliente Supabase mobile inserta la categoría con `user_id = auth.uid()`, `canonical_name = "mascotas"`, `is_active = true`
- **AND** la pantalla se popea y la nueva categoría aparece en la lista

#### Scenario: Colisión de nombre desde mobile

- **WHEN** un usuario intenta crear una segunda categoría con `canonical_name = "mascotas"`
- **THEN** el insert falla con Postgres `23505`
- **AND** el form muestra un mensaje i18n indicando que ya existe una categoría con ese nombre, y la pantalla permanece abierta

#### Scenario: Validación de nombre vacío desde mobile

- **WHEN** un usuario envía el form con nombre vacío
- **THEN** la validación Yup falla antes de tocar Supabase
- **AND** el form muestra el error de validación localizado y la pantalla permanece abierta

#### Scenario: La pantalla de alta usa el chrome estándar de formulario

- **WHEN** un usuario abre la pantalla de crear categoría
- **THEN** ve la banda navy de `PageHeader` con el título y un back-link "← Categorías", igual que el alta de movimiento
- **AND** NO ve un header blanco con un botón X de cierre

#### Scenario: Back de Android vuelve al listado

- **WHEN** la pantalla de crear categoría está abierta y el usuario presiona el back físico de Android (o el gesto de back en iOS)
- **THEN** la pantalla se popea sin crear nada
- **AND** la app vuelve a `/(app)/settings/categories`

