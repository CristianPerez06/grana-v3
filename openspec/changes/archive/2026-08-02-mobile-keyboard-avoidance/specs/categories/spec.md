## ADDED Requirements

### Requirement: Crear categoría propia en mobile (mobile)

Reemplaza a "Alta de categoría propia en mobile (mobile)" (ver `## REMOVED`). El nombre cambia porque OpenSpec no admite la misma requirement en ADDED y REMOVED, y el reemplazo total —en vez de un MODIFIED— es lo que permite dar de baja el escenario obsoleto del sheet.

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Alta de categoría propia en mobile (mobile)

**Reason**: Reemplazada por "Crear categoría propia en mobile (mobile)" en la sección `## ADDED`, que fija la misma capacidad (crear una categoría propia desde mobile) sobre una **pantalla pusheada** en vez de un bottom-sheet. Se expresa como REMOVED + ADDED y no como MODIFIED porque el cambio de superficie deja obsoleto el escenario "Back de Android cierra el sheet de alta": ya no hay sheet que cerrar. Conservarlo tal cual dejaría en la spec maestra un escenario que describe un componente inexistente; el comportamiento equivalente vive ahora en el escenario "Back de Android vuelve al listado".

El motivo del cambio de superficie: a ancho de teléfono el `Drawer` ocupa el 100% del ancho, así que deja de leerse como panel lateral y se comporta como pantalla completa — pero sin las affordances de navegación de una (sin gesto de back en iOS, sin back físico que popee, con el cierre colgando de un único botón X). Con ese botón sin responder el usuario quedaba encerrado en el formulario, reportado en dispositivo. Además el sheet arrastraba un header blanco ad-hoc que no coincidía con ningún otro formulario de la app.

**Migration**: Ninguna para el usuario final: la acción "Agregar" del listado sigue en el mismo lugar y el formulario es el mismo (`CreateCategoryForm`, misma validación con `createCategorySchema`, mismo insert). Solo cambia la superficie donde se monta. La pantalla `/(app)/settings/categories/new` ya existía como fallback de deep-link y pasa a ser el destino principal, así que no hay rutas nuevas ni deep-links rotos. `apps/web` no se toca: conserva el drawer.
