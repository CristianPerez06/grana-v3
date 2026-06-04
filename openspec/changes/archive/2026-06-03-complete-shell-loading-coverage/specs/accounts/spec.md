## MODIFIED Requirements

### Requirement: El header de `/accounts` se renderiza desde el primer paint y sus secciones cargan independientemente

El header de `/accounts` SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del módulo. El cuerpo de la ruta — sección de cuentas activas (cash + bank) y sección de cuentas archivadas — SHALL renderizarse como **secciones aisladas**, cada una con su propio fallback de carga y de error, de modo que un fallo en una sección no tire la ruta ni esconda el header.

Esta receta SHALL seguir el patrón **Variant C** ("chrome en `<ruta>/layout.tsx` + skeletons en `<ruta>/loading.tsx`") definido en el spec `route-loading-and-errors`, alineado con cómo lo aplican `/dashboard`, `/transactions` y `/cards`.

**Web — estructura de archivos:**

- `apps/web/app/(app)/accounts/layout.tsx` (server component, sync) SHALL montar `<AccountsHeader />` y renderizar `{children}` debajo. El header persiste como chrome del segmento entre transiciones de `{children}` (loading, error, navegación a hijos como `/accounts/[id]`).
- `apps/web/app/(app)/accounts/loading.tsx` SHALL renderizar los skeletons shape-matched de las dos secciones (active accounts skeleton + archived accounts skeleton) en la misma disposición que el cuerpo de la ruta. Actúa como fallback del `{children}` del layout durante la transición de segmento.
- `apps/web/app/(app)/accounts/page.tsx` SHALL renderizar el scaffold de `<Suspense>` envuelto por el Client Component error boundary (`AccountsErrorBoundary`), SIN remontar el header (que vive en el layout). El page MAY seguir siendo async para `await getTranslations()` si las strings de los `<SectionFallback>` se resuelven server-side ahí, o MAY migrarlas a containers async dedicados para volverse sync; ambas opciones son válidas siempre que el header no se duplique.
- El page NO SHALL hacer `await supabase.auth.getUser()` ni `redirect('/login')`: el auth check ya lo cubre `(app)/layout.tsx`.

**Header — comportamiento (sin cambios respecto a la versión previa):**

El `<AccountsHeader />` SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- Título "Cuentas" (sin subtítulo derivado de queries — el header no espera ningún fetch para mostrar su texto principal).
- El botón "+ Crear cuenta" SHALL renderizarse en estado **disabled** mientras la query del catálogo de instituciones (`institutions`) no resuelva. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esa query resuelve, SHALL pasar a habilitado y abrir el drawer de creación al click. Si esa query falla, el botón SHALL permanecer disabled para no abrir un drawer sin data.

**Cuerpo — scaffold de Suspense:**

El cuerpo de la ruta web SHALL renderizarse como un scaffold de **dos** `<Suspense>` boundaries (active, archived), cada uno con un fallback `<SectionFallback>` (compartido en `components/ui/`) con un mensaje de carga y un `min-h-[Xrem]` que reserva un slot vertical próximo al alto del contenido resuelto:

- **Active section** (container server async `ActiveAccountsContainer`): SHALL llamar `getCashAndBankAccounts()` (sin flag `archivedOnly`). El fallback de carga SHALL usar `min-h-[14rem]`.
- **Archived section** (container server async `ArchivedAccountsContainer`): SHALL llamar `getCashAndBankAccounts({ archivedOnly: true })` y flatten el resultado. El fallback de carga SHALL usar `min-h-[3rem]`.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`AccountsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al `try/catch` de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header** (que vive en el layout y queda fuera del boundary), con un `onRetry` que resetea el state del boundary.

**Active container — reglas de contenido.** Cuando `getCashAndBankAccounts()` resuelve:

- Si `cash.length + bank.length === 0`, el container SHALL renderizar `<EmptyAccountsState />` (mensaje "Todavía no tenés cuentas" + CTA secundario "+ Crear cuenta"). Este estado vacío NO depende del estado de la sección archivadas: SHALL mostrarse aún cuando la query de archivadas resuelva con filas. El CTA primario para crear vive siempre en el header, por lo que el CTA del empty es informativo, no la única salida.
- Si `cash.length + bank.length === 1`, el container SHALL renderizar primero el banner `<AccountsHint />` (one-shot dismissible) seguido de las secciones cash y bank.
- En todos los casos no-vacíos, el container SHALL renderizar las secciones cash y bank en ese orden, cada una con su propio título en caps + count y su contenedor de filas (per requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo").

**Archived container — reglas de contenido.** Cuando `getCashAndBankAccounts({ archivedOnly: true })` resuelve:

- Si el array de archivadas resuelve con cero filas, el container SHALL renderizar `null`. NO SHALL ocupar espacio visible (sin slot fantasma, sin separador, sin título de sección vacío).
- Si resuelve con uno o más, SHALL renderizar la sección de archivadas según las reglas visuales existentes (borde dashed, pill "Archivada", acción "Reactivar" en text-positive).

Un error en una sección NO SHALL afectar el render de la otra ni del header.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/accounts` y la query de `institutions` del header todavía no resolvió
- **AND** las queries de cuentas activas y archivadas todavía no resolvieron
- **THEN** el header ya está montado con el título "Cuentas"
- **AND** el botón "+ Crear cuenta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` (durante el render del page) o los skeletons shape-matched (durante la transición de segmento, cuando `accounts/loading.tsx` cubre el área del contenido)

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/dashboard` y navega a `/accounts`
- **THEN** durante la transición del segmento, el `<AccountsHeader />` aparece desde el primer paint del nuevo segmento (proviene de `accounts/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `accounts/loading.tsx` mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: Resolver la query de instituciones habilita el botón del header (web)

- **WHEN** la query de `institutions` resuelve con datos
- **THEN** el botón "+ Crear cuenta" pasa a habilitado y abre el drawer al click

#### Scenario: Fallo de la query de instituciones deja el botón disabled (web)

- **WHEN** la query de `institutions` falla
- **THEN** el botón "+ Crear cuenta" permanece disabled indefinidamente
- **AND** el resto del header (título) sigue visible
- **AND** las secciones del cuerpo siguen renderizándose normalmente con su propia data

#### Scenario: Cada sección muestra su propio fallback de carga mientras la otra ya cargó (web)

- **WHEN** la sección de cuentas activas ya resolvió pero la query de archivadas aún no
- **THEN** las cuentas activas se muestran agrupadas por tipo
- **AND** el área de archivadas sigue mostrando su `<SectionFallback>` con mensaje de carga

#### Scenario: Un error en la sección activa no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCashAndBankAccounts()` falla en web
- **THEN** el área de la sección activa muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible y completamente funcional (con el botón habilitado si `institutions` resolvió)
- **AND** la sección de archivadas sigue renderizándose normalmente con su propia data
- **AND** el `error.tsx` del layout group `(app)` NO se monta

#### Scenario: Un error en la sección archivadas no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCashAndBankAccounts({ archivedOnly: true })` falla en web
- **THEN** el área de la sección archivadas muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible
- **AND** la sección de cuentas activas sigue renderizándose normalmente

#### Scenario: Un throw fuera de los containers es capturado por el error boundary in-page (web)

- **WHEN** un throw ocurre durante el render del page (no del layout) fuera de los `try/catch` de los containers
- **THEN** el `AccountsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta (que vive en el layout) sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render del page

#### Scenario: La sección de archivadas no ocupa espacio cuando el usuario no tiene archivadas (web)

- **WHEN** la query de cuentas archivadas resuelve con cero filas
- **THEN** el `ArchivedAccountsContainer` renderiza `null`
- **AND** el `<SectionFallback>` de archivadas deja de mostrarse al resolver la query (no queda un slot vacío visible, no hay título de sección sin contenido)

#### Scenario: `EmptyAccountsState` se muestra cuando no hay cuentas activas, aún con archivadas presentes (web)

- **WHEN** la query de cuentas activas resuelve con `cash.length + bank.length === 0`
- **AND** la query de cuentas archivadas resuelve con una o más filas
- **THEN** el área de la sección activa muestra `<EmptyAccountsState />` (mensaje "Todavía no tenés cuentas" + CTA secundario)
- **AND** debajo se renderiza la sección de archivadas con sus filas
