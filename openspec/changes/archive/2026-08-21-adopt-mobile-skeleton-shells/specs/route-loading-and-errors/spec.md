## REMOVED Requirements

### Requirement: Toda pantalla autenticada de apps/mobile con fetching cliente entrega loading y error states (mobile)

**Reason**: Prescribía `<Spinner size="lg" />` como estado de carga de una pantalla nativa, con el patrón `if (isPending) return <ScreenLoading />` escrito dentro del propio requirement. Eso contradice la regla de skeletons shape-matched que la capability `dashboard` ya exige, y es la razón por la que catorce pantallas de Cuentas, Tarjetas y Configuración cargan hoy con un spinner centrado. Su scenario "Una pantalla mobile en carga muestra Spinner centrado" se da de baja con él: afirma exactamente el comportamiento que este change elimina.

**Migration**: Lo reemplaza el requirement "Toda pantalla autenticada de apps/mobile con fetching cliente carga con skeleton shell y entrega error state (mobile)", que conserva intacta la mitad de errores (`RouteError` + retry, con su scenario) y cambia sólo la mitad de carga. Ninguna pantalla queda sin regla: la cobertura pasa de "spinner centrado" a "skeleton shape-matched compuesto sobre `SkeletonBlock`".

## ADDED Requirements

### Requirement: Toda pantalla autenticada de apps/mobile con fetching cliente carga con skeleton shell y entrega error state (mobile)

`apps/mobile` SHALL renderizar un estado de loading y un estado de error consistentes en toda pantalla que dependa de un fetch cliente (típicamente vía `useQuery` de TanStack Query, ver `mobile-app-shell`). El loading SHALL ser un **skeleton shell shape-matched** del contenido de esa pantalla; el error SHALL usar `<RouteError>`.

Un skeleton shell shape-matched es —con la misma definición que ya rige para los bloques del dashboard (ver capability `dashboard`)— una composición de bloques rectangulares con animación pulse que respeta la forma final del contenido: mismos radios, misma altura aproximada, misma cantidad de bloques, de modo que la pantalla no salte al resolverse. Los bloques SHALL componer el primitivo `SkeletonBlock` de `apps/mobile/components/ui/` en vez de reimplementar la animación (`SkeletonBlock` respeta `useReducedMotion()`).

El skeleton SHALL reemplazar **sólo el cuerpo** de la pantalla. El chrome —`PageHeader` o `FormScreen`, su back-link y sus slots de acción— SHALL seguir visible desde el primer paint, con la acción primaria `disabled` mientras la data que necesita no esté lista.

`<Spinner>` NO SHALL usarse como estado de carga de una pantalla nativa. Su uso queda acotado a **indicador de una acción en curso**: `<Button loading>`, un refresh disparado por el usuario, o un control puntual esperando una mutación. El primitivo NO se da de baja y `SpinnerProps` no cambia — web lo sigue usando en el `loading.tsx` del layout group genérico.

Tampoco SHALL usarse como estado de carga un texto placeholder ("Cargando…") ni el estado vacío del contenido, por la misma razón por la que el dashboard lo tiene prohibido: afirman algo que todavía no se sabe.

Patrón canónico para pantallas mobile:

```tsx
const { data, isPending, error, refetch } = useQuery({ ... })

if (isPending) return <ContentSkeleton />  // shape-matched, compone SkeletonBlock
if (error) return <RouteError error={error} onRetry={() => refetch()} />
return <ScreenContent data={data} />
```

Esta regla aplica a cualquier pantalla bajo `(app)/` que monte queries cliente. Pantallas placeholder (sin fetching) están exentas hasta su primera implementación real.

#### Scenario: Una pantalla mobile en carga muestra un skeleton con la forma de su contenido

- **WHEN** un usuario abre una pantalla mobile cuyas queries cliente aún están en estado `pending`
- **THEN** la pantalla muestra bloques `SkeletonBlock` dispuestos con la forma del contenido final (misma cantidad de secciones/filas, alturas y radios equivalentes)
- **AND** NO muestra un `<Spinner>` centrado, un texto "Cargando…" ni el estado vacío del contenido
- **AND** al resolver la query el contenido ocupa el mismo espacio, sin salto de layout perceptible

#### Scenario: El chrome de la pantalla no se reemplaza durante la carga

- **WHEN** una pantalla mobile con `PageHeader` o `FormScreen` está en estado de carga
- **THEN** el header, su back-link y sus slots de acción están visibles desde el primer paint
- **AND** la acción primaria que depende de la data se muestra `disabled` en vez de ocultarse

#### Scenario: Spinner sólo aparece como indicador de acción

- **WHEN** un usuario dispara una mutación desde un botón nativo (guardar, pagar, archivar)
- **THEN** el `<Spinner>` puede aparecer dentro de ese control (`<Button loading>`) mientras la acción está en vuelo
- **AND** ninguna pantalla nativa usa `<Spinner>` como su estado de carga de contenido

#### Scenario: Una pantalla mobile con error muestra RouteError con retry funcional

- **WHEN** una query cliente en una pantalla mobile cae en error
- **THEN** la pantalla muestra `<RouteError>` con el mensaje genérico y el botón "Reintentar"
- **AND** presionar "Reintentar" llama a `refetch()` y la pantalla vuelve a entrar en estado de loading mientras la query reintenta

### Requirement: Cuentas, Tarjetas y Configuración cargan con skeleton shells en mobile

Las tres secciones alcanzables desde el botón "…" del tab bar SHALL cubrir su estado de carga con skeletons shape-matched, sin `<Spinner>` de pantalla ni cajas de texto "Cargando…". Superficies cubiertas:

- **Cuentas**: la lista (`accounts/index.tsx`), el detalle (`accounts/[id]/index.tsx`) y los tres formularios (`new`, `[id]/edit`, `[id]/currency`).
- **Tarjetas**: los tres bloques de la raíz (`cards/index.tsx`: hero del mes, billetera y archivadas), el detalle (`cards/[id]/index.tsx`), la lista de resúmenes (`cards/[id]/periods/index.tsx`), el detalle de resumen (`.../[periodId]/index.tsx`), el pago (`.../[periodId]/pay.tsx`) y los formularios de alta y edición.
- **Configuración**: la lista de categorías, la edición de categoría y la lista de subcategorías bajo `settings/categories/**`.

Cada skeleton SHALL vivir junto al componente cuya forma espeja (`components/accounts/`, `components/cards/`, `components/cards/detail/`, `components/categories/`) y nombrarse `<Componente>Skeleton`, siguiendo la convención de naming espejo que ya usan los skeletons del dashboard y de movimientos.

Cada skeleton SHALL escribirse **con la forma de esa pantalla concreta**. NO SHALL introducirse un shell genérico parametrizado (del tipo `<FormSkeleton rows={n} />`) que sirva a varias pantallas: un select, un input de monto y una fila de chips tienen formas distintas, y un shell genérico las aplana, que es justamente lo que la regla shape-matched evita. Web sigue el mismo criterio: cada `loading.tsx` compone el suyo.

Excepciones, escritas para que no se "completen" por error:

- La **raíz de Configuración** (`settings/index.tsx`) NO SHALL tener skeleton: no monta ninguna query, lee `showCents` y el locale de contexto y renderiza sincrónico.
- La **tira de archivadas** de la raíz de Tarjetas (y su equivalente en Cuentas) SHALL seguir sin dibujar nada mientras carga: es un bloque condicional —existe sólo si hay elementos archivados— y un skeleton prometería contenido que en la mayoría de las cuentas no aparece. Es la misma decisión que la tira "Compartido" del dashboard.

La regla general (skeleton por defecto, `Spinner` sólo como indicador de acción) rige para toda la app nativa, no sólo para estas tres secciones: al momento de este change la única pantalla fuera de ellas que usaba `<Spinner>` como estado de pantalla es `/transactions/recurring/new`, que también SHALL migrar.

El skeleton NO SHALL mostrar copy visible. Su nodo raíz SHALL declarar `accessibilityState={{ busy: true }}` y un `accessibilityLabel` derivado de la key de esa superficie; los bloques internos NO SHALL declarar atributos de accesibilidad (son decorativos). Es la misma regla de accesibilidad que ya rige para los skeletons del dashboard.

Las keys de carga existentes (`accounts.route.active_loading`, `accounts.route.archived_loading`, `cards.route.hero_loading`, `cards.route.wallet_loading`, `cards.route.archived_loading`) SHALL reusarse como ese label en vez de darse de baja: dejan de pintarse como texto y pasan a anunciarse. Una superficie sin key propia SHALL recibir una key específica en `es.json` y `en.json`; NO SHALL reusarse un mensaje genérico (`common.loading`) para varias superficies distintas.

#### Scenario: La raíz de Tarjetas carga con los tres bloques en skeleton

- **WHEN** un usuario abre `/cards` con las queries del hero y de la billetera en `pending`
- **THEN** el hero del mes y la billetera muestran skeletons con su forma final (card del hero, filas de tarjeta de la billetera)
- **AND** ninguno muestra una caja de borde punteado con texto de carga
- **AND** la tira de archivadas no ocupa espacio hasta que su query resuelve con contenido

#### Scenario: Un formulario que espera catálogo muestra la forma de sus campos

- **WHEN** un usuario abre `/cards/new` y el catálogo de instituciones y redes todavía carga
- **THEN** el cuerpo muestra el skeleton propio de ese formulario, con un bloque por campo real y el botón de submit
- **AND** el `FormScreen` (título y back-link) está visible desde el primer paint

#### Scenario: La raíz de Configuración no tiene estado de carga

- **WHEN** un usuario abre `/settings`
- **THEN** la pantalla renderiza sus secciones directamente, sin skeleton ni spinner intermedios

#### Scenario: Ninguna pantalla de las tres secciones usa Spinner como estado de pantalla

- **WHEN** se inspeccionan las pantallas bajo `app/(app)/accounts/**`, `app/(app)/cards/**` y `app/(app)/settings/**`
- **THEN** ninguna renderiza `<Spinner>` como estado de carga de contenido
- **AND** los `<Spinner>` que quedan están dentro de controles que esperan una acción del usuario

## MODIFIED Requirements

### Requirement: Toda nueva ruta o pantalla entrega loading y error states desde su primera implementación

Cuando un colaborador agrega una ruta nueva a `apps/web` o una pantalla nueva con fetching cliente a `apps/mobile`, esa ruta/pantalla SHALL incluir loading y error states desde el commit que la introduce (no en un follow-up).

Aplicación concreta por plataforma:

- **Web** (`apps/web/app/.../page.tsx`): el segmento SHALL tener un `loading.tsx` y un `error.tsx` colocalizados, o estar cubierto por un par a nivel de layout group ancestro. La regla operativa es: si la ruta nueva queda cubierta por el `loading.tsx`/`error.tsx` del layout group superior con un fallback aceptable, no hace falta duplicar; si necesita un fallback distinto, agregar el par específico.
- **Mobile** (`apps/mobile/app/.../<screen>.tsx`): la pantalla SHALL manejar explícitamente los estados `isPending` y `error` de sus queries, usando un **skeleton shell shape-matched** del contenido de esa pantalla y `<RouteError>` (ver el requirement de loading y error states en mobile). El skeleton se escribe junto al componente cuya forma espeja, no se resuelve con un `<Spinner>`. Pantallas placeholder (sin queries) están exentas hasta su primera implementación real.

Esta regla NO aplica retroactivamente a rutas anteriores al change que introdujo la capability `route-loading-and-errors` — aunque ese change agrega el par a las rutas existentes en un solo commit, lo que importa para esta convención es que **de aquí en adelante** ninguna ruta nueva se mergee sin loading/error.

#### Scenario: Una ruta web nueva entrega loading.tsx y error.tsx en el mismo PR

- **WHEN** un colaborador crea un nuevo `apps/web/app/<group>/<route>/page.tsx`
- **AND** el segmento NO queda cubierto por un `loading.tsx` o `error.tsx` de un layout ancestro con fallback aceptable
- **THEN** el mismo PR agrega `loading.tsx` y `error.tsx` colocalizados con el `page.tsx` nuevo
- **AND** el PR es revisado antes de merge para validar que ambos archivos están presentes o que el fallback ancestro aplica

#### Scenario: Una pantalla mobile nueva con queries entrega loading y error states en el mismo PR

- **WHEN** un colaborador crea una nueva pantalla `apps/mobile/app/(app)/<screen>.tsx` que invoca `useQuery({ ... })`
- **THEN** el componente maneja `isPending` (renderizando el skeleton shape-matched de ese contenido) y `error` (renderizando `<RouteError>`) antes de renderizar contenido
- **AND** el PR no se mergea sin esa cobertura
