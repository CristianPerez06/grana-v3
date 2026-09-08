## ADDED Requirements

### Requirement: Una categoría puede pertenecer al hogar

Además de las categorías del sistema (`user_id IS NULL`) y las propias (`user_id = auth.uid()`), el sistema SHALL admitir categorías **del hogar**: una categoría con `household_id` apuntando a un hogar activo del que su creador es miembro. Una categoría del hogar conserva `user_id` (quién la creó) y SHALL ser **visible, seleccionable y editable por todos los miembros** de ese hogar, tanto para movimientos compartidos como para movimientos propios de cada miembro.

Las tres formas de propiedad son excluyentes y SHALL estar garantizadas en la base: del sistema (`user_id IS NULL`, `household_id IS NULL`), propia (`user_id` presente, `household_id IS NULL`) o del hogar (`user_id` presente, `household_id` presente). Una categoría del hogar NO SHALL tener `user_id IS NULL`, porque "del sistema" se reconoce por esa columna y sus nombres se traducen por `canonical_name`.

La unicidad de `canonical_name` SHALL evaluarse por alcance: entre las del sistema, entre las propias de un usuario, y entre las del hogar de un mismo hogar. Un miembro PUEDE tener una categoría propia y el hogar una del hogar con el mismo nombre; las superficies que las listan SHALL distinguirlas con la marca "Hogar".

Las subcategorías siguen la misma regla: una subcategoría de una categoría del hogar SHALL ser del mismo hogar (la base lo garantiza al insertar o mover), y un miembro PUEDE crear subcategorías del hogar bajo una categoría del sistema, para que "Comida > Verdulería" sea legible por los dos miembros cuando se usa en un compartido.

Una categoría propia SHALL poder pasar al hogar por decisión de su dueño. El camino inverso, del hogar a propia, NO SHALL ofrecerse: otros miembros pueden tener movimientos apuntando a ella.

#### Scenario: Un miembro ve y usa la categoría del hogar que creó el otro

- **WHEN** Cristian crea la categoría del hogar "Hogar - La Foresta" y Julieta abre el selector de categoría de un movimiento nuevo, propio o compartido
- **THEN** "Hogar - La Foresta" aparece en el selector con la marca "Hogar"
- **AND** Julieta puede seleccionarla y guardar el movimiento

#### Scenario: Cualquier miembro edita una categoría del hogar

- **WHEN** Julieta edita el nombre, ícono o color de una categoría del hogar creada por Cristian
- **THEN** la operación se acepta y el cambio lo ven los dos miembros

#### Scenario: Un no-miembro no ve las categorías del hogar

- **WHEN** un usuario que no pertenece al hogar consulta `categories`
- **THEN** no recibe ninguna categoría con ese `household_id`

#### Scenario: Una categoría del hogar nunca es "del sistema"

- **WHEN** se intenta insertar una categoría con `household_id` presente y `user_id IS NULL`
- **THEN** la base rechaza la operación

#### Scenario: Unicidad por alcance

- **WHEN** Julieta tiene la categoría propia "Hogar" y crea la categoría del hogar "Hogar"
- **THEN** la segunda se acepta
- **AND** en Configuración y en el selector las dos se muestran, y la del hogar lleva la marca "Hogar"

#### Scenario: Una subcategoría de una categoría del hogar es del hogar

- **WHEN** un miembro crea la subcategoría "Expensas" bajo la categoría del hogar "Hogar - La Foresta"
- **THEN** la subcategoría queda con el mismo `household_id` que su categoría
- **AND** el otro miembro la ve y la puede seleccionar

#### Scenario: Pasar una categoría propia al hogar

- **WHEN** el dueño de una categoría propia la marca como del hogar desde Configuración
- **THEN** la categoría y sus subcategorías propias pasan al hogar
- **AND** los movimientos que ya la usaban siguen apuntando a ella, ahora legibles por los dos miembros

#### Scenario: No se ofrece volver una categoría del hogar a propia

- **WHEN** un miembro edita una categoría del hogar
- **THEN** la pantalla no ofrece convertirla en propia

### Requirement: Las categorías del hogar existen en la app nativa (mobile)

La app nativa SHALL ofrecer las mismas capacidades sobre categorías del hogar que la web: el grupo "Del hogar" en Configuración > Categorías, el control para pasar una categoría propia al hogar al crear o editar, la marca "Hogar" en filas y en el selector de categoría del formulario de movimiento, y la edición de categorías y subcategorías del hogar. Una capacidad presente en una plataforma y ausente en la otra es un incumplimiento de este requirement.

#### Scenario: Paridad del grupo "Del hogar"

- **WHEN** un miembro con hogar abre Configuración > Categorías en la app nativa
- **THEN** ve el grupo "Del hogar" con las mismas categorías y acciones que en la web

#### Scenario: Paridad del selector

- **WHEN** un miembro abre el selector de categoría de un movimiento en la app nativa
- **THEN** las categorías del hogar aparecen con la marca "Hogar", igual que en la web

## MODIFIED Requirements

### Requirement: El usuario puede editar sus categorías propias

Un usuario SHALL poder editar el `name`, `icon`, y `color` de sus propias categorías y de las categorías **del hogar** del que es miembro. No puede editar categorías del sistema ni categorías propias de otros usuarios.

#### Scenario: Edición de nombre de categoría propia

- **WHEN** un usuario edita el nombre de su categoría
- **THEN** el `name` se actualiza en DB
- **AND** el `canonical_name` permanece sin cambios

#### Scenario: Edición de categoría del sistema bloqueada

- **WHEN** un usuario intenta editar una categoría con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Edición de categoría propia de otro usuario bloqueada

- **WHEN** un usuario intenta editar una categoría propia (`household_id IS NULL`) de otro usuario
- **THEN** la operación es rechazada por RLS

#### Scenario: Edición de categoría del hogar por otro miembro

- **WHEN** un miembro del hogar edita una categoría del hogar creada por el otro miembro
- **THEN** la operación se acepta

### Requirement: Visualización de categorías en Configuración

El sistema SHALL mostrar una pantalla de gestión de categorías en la sección Configuración. La pantalla lista todas las categorías activas agrupadas en **Del sistema**, **Del hogar** (solo cuando el usuario pertenece a un hogar activo) y **Mías**, con acciones contextuales según el tipo.

Las categorías del sistema se muestran sin acciones de edición/archivar. Las categorías propias y las del hogar muestran acciones de editar y archivar; las del hogar llevan además la marca "Hogar". Todas muestran la opción de agregar subcategorías.

El formulario de crear y de editar una categoría propia SHALL ofrecer, solo a quien pertenece a un hogar activo, el control "Es del hogar" para crearla como del hogar o pasarla al hogar. En el formulario de una categoría que ya es del hogar el control se muestra activo y no se puede desactivar.

Las mutaciones de alta y edición SHALL ocurrir en un **drawer modal** disparado desde el listado/fila, sin cambiar de URL, alineadas con el patrón de `accounts` y `cards`:

- En `apps/web`, la acción `Agregar` del header del listado (`/settings/categories`) SHALL abrir un drawer que monta el form de crear categoría (`variant="drawer"`), en vez de navegar a `/settings/categories/new`.
- La acción `Editar` de una fila de categoría **propia o del hogar** SHALL abrir un drawer con el form de editar preseteado (`variant="drawer"`), en vez de navegar a `/settings/categories/[id]/edit`. Las filas de categoría del sistema NO ofrecen acción de editar.
- Las pages `/settings/categories/new` y `/settings/categories/[id]/edit` SHALL conservarse como fallback no-JS / deep-link, renderizando el mismo form en `variant="page"` con su comportamiento actual (navegación al listado al éxito).
- Las acciones `Ver subcategorías`, `Archivar` y `Eliminar` y sus confirmaciones existentes NO cambian.

El estado abierto/cerrado del drawer SHALL ser estado local del componente y NO SHALL representarse en la URL.

#### Scenario: Lista de categorías con distinción sistema/propias

- **WHEN** un usuario con hogar navega a Configuración > Categorías
- **THEN** ve las categorías del sistema (sin acciones de editar/archivar), las del hogar (con acciones y la marca "Hogar") y las propias (con acciones)
- **AND** cada categoría muestra su nombre, tipo, y cantidad de subcategorías activas

#### Scenario: Sin hogar no hay grupo "Del hogar"

- **WHEN** un usuario sin hogar activo navega a Configuración > Categorías
- **THEN** ve solo los grupos del sistema y propias
- **AND** el formulario de categoría no ofrece el control "Es del hogar"

#### Scenario: Acceso a subcategorías de una categoría

- **WHEN** un usuario toca una categoría en la lista
- **THEN** ve las subcategorías activas de esa categoría
- **AND** puede agregar nuevas subcategorías
- **AND** las subcategorías del sistema aparecen sin acciones de editar/archivar

#### Scenario: Crear categoría abre un drawer desde el listado (web)

- **WHEN** un usuario pulsa `Agregar` en `/settings/categories`
- **THEN** se abre un drawer modal con el form de crear categoría sobre el listado, sin navegar a otra URL
- **AND** el form expone los mismos campos (`name`, `type`, `icon`, `color`, y `Es del hogar` cuando corresponde), validaciones, field errors, form error y estado de submitting que la page actual

#### Scenario: Editar categoría propia abre un drawer desde la fila (web)

- **WHEN** un usuario pulsa `Editar` en una fila de categoría propia o del hogar
- **THEN** se abre un drawer con el form de edición preseteado (`name`, `icon`, `color`, `Es del hogar`) sin navegar a `/settings/categories/[id]/edit`
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
