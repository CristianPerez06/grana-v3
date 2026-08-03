## ADDED Requirements

### Requirement: Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación

Cuando un colaborador agrega una ruta nueva a `apps/web` o una pantalla nueva con fetching cliente a `apps/mobile`, esa ruta/pantalla SHALL incluir loading y error states desde el commit que la introduce (no en un follow-up).

Aplicación concreta por plataforma:

- **Web** (`apps/web/app/.../page.tsx`): el segmento SHALL tener un `loading.tsx` y un `error.tsx` colocalizados, o estar cubierto por un par a nivel de layout group ancestro. La regla operativa es: si la ruta nueva queda cubierta por el `loading.tsx`/`error.tsx` del layout group superior con un fallback aceptable, no hace falta duplicar; si necesita un fallback distinto, agregar el par específico.
- **Mobile** (`apps/mobile/app/.../<screen>.tsx`): la pantalla SHALL manejar explícitamente los estados `isPending` y `error` de sus queries, usando `<Spinner size="lg" />` y `<RouteError>` (componentes provistos por la capability `route-loading-and-errors`). Pantallas placeholder (sin queries) están exentas hasta su primera implementación real.

Esta regla NO aplica retroactivamente a rutas anteriores al change que introdujo la capability `route-loading-and-errors` — aunque ese change agrega el par a las rutas existentes en un solo commit, lo que importa para esta convención es que **de aquí en adelante** ninguna ruta nueva se mergee sin loading/error.

#### Scenario: Una ruta web nueva entrega loading.tsx y error.tsx en el mismo PR

- **WHEN** un colaborador crea un nuevo `apps/web/app/<group>/<route>/page.tsx`
- **AND** el segmento NO queda cubierto por un `loading.tsx` o `error.tsx` de un layout ancestro con fallback aceptable
- **THEN** el mismo PR agrega `loading.tsx` y `error.tsx` colocalizados con el `page.tsx` nuevo
- **AND** el PR es revisado antes de merge para validar que ambos archivos están presentes o que el fallback ancestro aplica

#### Scenario: Una pantalla mobile nueva con queries entrega loading y error states en el mismo PR

- **WHEN** un colaborador crea una nueva pantalla `apps/mobile/app/(app)/<screen>.tsx` que invoca `useQuery({ ... })`
- **THEN** el componente maneja `isPending` (renderizando `<Spinner size="lg" />`) y `error` (renderizando `<RouteError>`) antes de renderizar contenido
- **AND** el PR no se mergea sin esa cobertura

## MODIFIED Requirements

### Requirement: Las rutas bajo `/settings` adoptan Variant C de in-page chrome

`apps/web/app/(app)/settings/**` SHALL adoptar la **Variant C** del requirement *"Una ruta de apps/web puede optar por loading y error in-page para mantener su chrome visible"*: el header de cada segmento vive en su `layout.tsx` y persiste durante el loading/error del cuerpo. Esto extiende el alcance ya cubierto por `/dashboard`, `/transactions`, `/accounts`, `/cards` y `/shared` a las rutas de configuración.

La distribución concreta es:

1. `apps/web/app/(app)/settings/layout.tsx` SHALL montar `<SettingsHeader />` envolviendo `{children}`. `SettingsHeader` es un Client Component que renderiza `<PageHeader title="Configuración" />` **únicamente** cuando `usePathname() === '/settings'`, y retorna `null` en cualquier sub-ruta. El pathname guard existe para evitar que el header de `/settings` se apile sobre el `CategoriesHeader` cuando el usuario navega a `/settings/categories/**`.
2. `apps/web/app/(app)/settings/categories/layout.tsx` SHALL montar `<CategoriesHeader />` envolviendo `{children}`. `CategoriesHeader` es un Client Component que conmuta su `PageHeaderProps` (`title`, `description`, `backLink`, `actions`) según `usePathname()` y `useParams()`, cubriendo las cinco rutas hijas (`/settings/categories`, `/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`).
3. Para las rutas con segmento `[id]` (`/edit`, `/subcategories`, `/subcategories/new`), `CategoriesHeader` SHALL fetchear `category.name` client-side y mostrar un placeholder vacío (non-breaking space, U+00A0) en la `description` mientras el fetch no resuelve. El placeholder SHALL preservar la altura de la línea sin texto visible — el objetivo es evitar reflow del título cuando la descripción aparece, no mostrar feedback textual al usuario. NO SHALL mostrar un skeleton animado, ni texto "Cargando...", ni una descripción vacía que colapse la línea.
4. Las acciones de los headers de `/settings/categories` y `/settings/categories/[id]/subcategories` SHALL componerse como `<Button asChild><Link href={…/new}>…</Link></Button>` (primitivo `Button` del UI library), nunca como `<Link>` con clases inline de botón. Esta regla ya está specceada en `ui-foundations` y este requirement la aplica explícitamente al segmento de settings.
5. `apps/web/app/(app)/settings/loading.tsx` NO SHALL renderizar `<PageHeaderSkeleton />`: el header ya vive en el layout y no necesita placeholder. SHALL renderizar únicamente skeletons del cuerpo.
6. `apps/web/app/(app)/settings/categories/loading.tsx` SHALL renderizar un skeleton shape-matched de la lista de categorías. NO SHALL renderizar `<PageHeaderSkeleton />`.

#### Scenario: /settings mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/settings` y el server tarda > 200ms en resolver el RSC payload (por ejemplo, mientras `getShowCents()` o `getLocale()` resuelven)
- **THEN** `<SettingsHeader />` con el título "Configuración" aparece desde el primer paint, montado por `settings/layout.tsx`
- **AND** el cuerpo de la página se reemplaza por los skeletons de `settings/loading.tsx` (sin `PageHeaderSkeleton`)
- **AND** una vez que el contenido resuelve, el cuerpo reemplaza a los skeletons sin remontar el header

#### Scenario: /settings/categories mantiene el header durante el loading del contenido

- **WHEN** un usuario navega a `/settings/categories` y el server tarda en resolver `getAllCategories(user.id)`
- **THEN** `<CategoriesHeader />` con el título "Categorías", su descripción y el botón "Agregar" (icono `<Plus />` + label, sin `+` literal) aparece desde el primer paint
- **AND** el botón es el primitivo `Button` con `variant="primary"` y `className="w-auto"` (override del `w-full` default), NO un `<Link>` con `bg-primary px-4 py-2 …` inline
- **AND** el cuerpo se reemplaza por el skeleton de la lista de categorías (`categories/loading.tsx`)
- **AND** el header permanece visible y operable durante toda la transición

#### Scenario: Las sub-rutas de /settings/categories preservan CategoriesHeader durante la navegación

- **WHEN** un usuario navega de `/settings/categories` a `/settings/categories/<id>/subcategories` (o a `/new`, `/[id]/edit`, etc.)
- **THEN** el segmento `settings/categories/layout.tsx` NO se remonta: `<CategoriesHeader />` permanece en el DOM
- **AND** el contenido del header conmuta a los `PageHeaderProps` correspondientes a la nueva sub-ruta (`title`, `description`, `backLink`, `actions`) sin parpadear
- **AND** `<SettingsHeader />` del segmento padre retorna `null` durante toda la sesión bajo `/settings/categories/**` (el guard `pathname === '/settings'` lo apaga)

#### Scenario: /settings/categories/[id]/subcategories reserva la línea de descripción durante el loading

- **WHEN** un usuario navega a `/settings/categories/<id>/subcategories` y el fetch client-side de `category.name` aún no resuelve
- **THEN** el header se renderiza con `title="Subcategorías"` desde el primer paint
- **AND** la `description` contiene un non-breaking space (U+00A0) que preserva la altura de la línea sin texto visible
- **AND** no se muestra texto "Cargando..." ni un skeleton animado en el slot de descripción
- **AND** cuando `category.name` resuelve, la `description` se reemplaza por el nombre real sin reflow del título ni del back link

#### Scenario: Las acciones del header de categorías usan el primitivo Button

- **WHEN** un desarrollador inspecciona el DOM del header en `/settings/categories` o `/settings/categories/<id>/subcategories`
- **THEN** el botón "Agregar" es renderizado por `<Button asChild className="w-auto">` envolviendo un `<Link>` de `next/link`, con `<Plus />` como única fuente del "+" visual (los strings i18n `settings.categories.actions.add` y `.add_subcategory` ya NO incluyen el `+` literal)
- **AND** las clases del botón provienen del primitivo `Button` (variant `primary` por default, equivalente al verde emerald del UI library), no de `className="bg-primary px-4 py-2 …"` re-tipeado inline
- **AND** el estilo es visualmente idéntico al botón "Crear cuenta" de `/accounts` (mismo override `w-auto`, mismo icono + label sin `+` literal)
