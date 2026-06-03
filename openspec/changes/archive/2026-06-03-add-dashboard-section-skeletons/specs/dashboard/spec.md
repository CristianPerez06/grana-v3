## ADDED Requirements

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada una de las 4 secciones del dashboard que tienen estado de carga propio (Hero, "Lo que viene", "Balance del mes", "Spending teaser") SHALL renderizar durante ese estado un **skeleton shell shape-matched**: una composición de bloques rectangulares con animación pulse cuyo tamaño y disposición anticipan la anatomía del contenido real que va a aterrizar. NO SHALL renderizar un mensaje textual genérico ("Cargando…") ni un spinner centrado como visual de loading.

**Naming y archivos.** Cada sección con loading state SHALL tener un componente skeleton con el sufijo `Skeleton` y el mismo nombre PascalCase que su sección, en ambas plataformas:

- web: `HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton` en `apps/web/app/(app)/dashboard/_components/`
- mobile: `HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton` en `apps/mobile/components/dashboard/`

**Tecnología por plataforma.**

- **Web** SHALL implementar los bloques con `<div className="bg-muted animate-pulse rounded-…">` inline, siguiendo el patrón ya establecido por `apps/web/lib/transactions/components/movement-list-skeleton.tsx`. NO SHALL introducirse un componente `<Skeleton/>` wrapper.
- **Mobile** SHALL introducir un único primitivo `SkeletonBlock` en `apps/mobile/components/ui/` que encapsula la animación pulse (basada en `react-native-reanimated`, ya presente en `apps/mobile/package.json`), expone `className` para sizing/border-radius via NativeWind, y respeta `useReducedMotion()`: cuando el sistema operativo declara `prefers-reduced-motion`, el bloque SHALL mantener una opacidad estática (~0.7) sin animación. Los 4 skeletons mobile SHALL componer `<SkeletonBlock/>` para sus bloques internos.

**Shape source.** Los tamaños y disposición de los bloques SHALL derivarse del DOM real de cada sección en su estado con datos (no de design refs externos), y SHALL mantenerse equivalentes 1:1 entre web y mobile dentro de los límites de cada stack. Cada elemento visible del contenido real SHALL tener un bloque skeleton correspondiente.

**Accesibilidad.** El nodo raíz de cada skeleton SHALL declarar:

- web: `aria-busy="true"` y `aria-label={t('dashboard.<sección>_loading')}` o equivalente.
- mobile: `accessibilityState={{ busy: true }}` y `accessibilityLabel={t('dashboard.<sección>_loading')}` o equivalente.

Los bloques internos NO SHALL declarar atributos de accesibilidad (heredan al wrapper, son decorativos).

**Reuso de i18n.** Las keys `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading` SHALL reusarse como `aria-label`/`accessibilityLabel` de los skeletons. Sus textos PUEDEN ajustarse para sonar correctos como label de accesibilidad sin renombrar la key.

**Color del bloque.** Web SHALL usar el token `bg-muted`. Mobile SHALL usar el token de NativeWind/`@grana/ui-tokens` semánticamente equivalente (probable `bg-border-soft` si no existe `bg-muted` en el theme mobile). NO SHALL introducirse un token de skeleton nuevo en este change.

#### Scenario: El skeleton del Hero anticipa la anatomía de las dos líneas de moneda (web + mobile)

- **WHEN** un usuario carga `/dashboard` y la query del Hero aún no resuelve
- **THEN** el área donde van los importes muestra dos bloques pulsantes verticales: uno grande (anticipando el importe ARS de tamaño headline) y otro más chico debajo (anticipando el importe USD)
- **AND** los bloques tienen animación `animate-pulse` (web) o `SkeletonBlock` con opacity loop (mobile)
- **AND** NO se muestra un mensaje "Cargando…" en texto, ni un spinner centrado

#### Scenario: El skeleton de "Lo que viene" anticipa filas de eventos (web + mobile)

- **WHEN** un usuario carga `/dashboard` y la query de `getUpcomingFortnight` aún no resuelve
- **THEN** el área de eventos muestra varios bloques pulsantes en filas, cada una con un bloque chico a la izquierda (anticipando la fecha) y dos bloques de texto (anticipando label + monto)
- **AND** la cantidad de filas-skeleton es estable (no depende de la data)

#### Scenario: El skeleton de "Balance del mes" anticipa el gráfico + footer (web + mobile)

- **WHEN** un usuario carga `/dashboard` (o navega de mes en "Balance del mes") y la query `useMonthBalanceSeries` aún no resuelve
- **THEN** el área del gráfico muestra un bloque rectangular grande con la altura del chart real, y debajo aparecen 2–3 mini-bloques anticipando el balance final + ingresos/gastos
- **AND** el título de la sección y el navegador mensual permanecen visibles e interactivos (no se reemplazan por skeleton)

#### Scenario: El skeleton del "Spending teaser" anticipa las filas con barra de progreso (web + mobile)

- **WHEN** un usuario carga `/dashboard` y la query `useMonthCategoryBreakdown` aún no resuelve
- **THEN** el área del teaser muestra ~3 filas pulsantes, cada una con un bloque a la izquierda (label de categoría), un bloque chico tipo barra (anticipando el progress bar), y un bloque mínimo a la derecha (anticipando el `%`)

#### Scenario: Web usa el skeleton como Suspense fallback (web)

- **WHEN** se inspecciona `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`
- **THEN** cada `<Suspense>` de las 4 secciones con loading state usa el skeleton respectivo como `fallback={...}`
- **AND** NO se usa `<SectionFallback message=…/>` como fallback de esos `<Suspense>`

#### Scenario: Mobile usa el skeleton dentro del swap region existente (mobile)

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx` (u otra sección con swap region)
- **THEN** el branch que antes renderizaba `<Spinner size="lg"/>` ahora renderiza `<HeroSkeleton/>` (o el skeleton correspondiente)
- **AND** el `<View style={{ minHeight: SWAP_MIN_HEIGHT }}…>` que envuelve el swap region NO cambia
- **AND** el chrome de la card (border, padding, label/título) NO se mueve a un skeleton

#### Scenario: El skeleton respeta `prefers-reduced-motion` (mobile)

- **WHEN** un usuario tiene activado "Reduce Motion" en el SO y carga `/dashboard` en mobile
- **THEN** los bloques `SkeletonBlock` se renderizan con una opacidad estática (~0.7) sin animación de pulse
- **AND** el `aria-busy`/`accessibilityState.busy` sigue declarado

#### Scenario: Cada skeleton es accesible para lectores de pantalla (web + mobile)

- **WHEN** un usuario con lector de pantalla aterriza en el dashboard mientras una sección está en loading
- **THEN** el lector anuncia el label localizado de la sección ("Cargando tu disponible…" o equivalente como label de accesibilidad)
- **AND** los bloques individuales del skeleton no son leídos uno por uno

---

## MODIFIED Requirements

### Requirement: La sección "Balance del mes" muestra un gráfico de línea acumulada con navegador mensual

La sección SHALL renderizar un gráfico de línea cuyo eje X representa los días del mes seleccionado (1 a 28/29/30/31 según el mes), eje Y representa el balance acumulado en ARS desde el día 1 del mes hasta cada día inclusive (`balance acumulado = Σ ingresos − Σ gastos hasta el día i`), y cuyo trazo conecta esos puntos con interpolación lineal. La línea SHALL cruzar el eje X cuando el acumulado pase por cero (visualmente puede destacarse cuándo el usuario está "en verde" vs "en rojo" del mes).

Encima del gráfico, la sección SHALL mostrar un navegador mensual `◀ MES AÑO ▶` con el nombre del mes seleccionado. Las flechas SHALL permitir navegar hasta 12 meses hacia atrás desde el mes actual. La flecha derecha SHALL deshabilitarse cuando el mes seleccionado es el actual (no se navega hacia el futuro). El mes actual SHALL ser el seleccionado por default al montar la tarjeta.

La tarjeta SHALL ser un componente cliente que posee el mes seleccionado en **estado local**. La navegación entre meses NO SHALL modificar la URL ni provocar una navegación de ruta: cambiar de mes NO recarga la página (web) ni desmonta/remonta la tarjeta (mobile). El mes seleccionado NO se persiste en la URL ni se conserva tras un refresh; al volver a montar, la tarjeta SHALL abrir en el mes actual.

Al navegar a un mes, la tarjeta SHALL obtener los datos del lado del cliente (web: vía server action; mobile: vía TanStack Query) y SHALL mostrar un **estado de carga propio**: un **skeleton shape-matched** (`MonthBalanceSkeleton`) que reemplaza únicamente el área del gráfico y del footer (balance, ingresos, gastos), manteniendo visibles e interactivos el título de la sección y el navegador mensual. El skeleton SHALL anticipar el bloque del gráfico (rectángulo con la altura del chart real) y el footer (mini-bloques para balance final + ingresos/gastos).

Si el fetch de un mes falla, la tarjeta SHALL mostrar un **estado de error compacto** en el área del gráfico + footer, con opción de reintentar, manteniendo visibles el título y el navegador mensual.

En los estados de carga y de error, el alto y el ancho de la tarjeta SHALL permanecer constantes respecto del estado con datos (sin layout shift).

El navegador mensual NUNCA SHALL desbordar los límites de la tarjeta. En web, incluso cuando la columna del grid es angosta (viewport entre ~1024px y ~1088px), el navegador SHALL mantenerse íntegro dentro de la tarjeta y el título de la sección SHALL ceder espacio (truncarse) antes que permitir que la flecha derecha se salga del contenedor.

Debajo del gráfico, la sección SHALL mostrar el balance final del mes seleccionado (positivo o negativo, con signo y color), y los totales de ingresos y gastos del mes en una línea pequeña.

El gráfico SHALL considerar solo transacciones con estado `confirmed` (es decir: no `pending` de tarjeta). En la práctica esto significa: ingresos en cash/bank, gastos en cash/bank, y pagos de resúmenes (que son gastos en cash/bank). Consumos en tarjeta `pending` y cuotas `pending` NO entran al gráfico.

El cálculo SHALL usar exclusivamente la moneda ARS. El gráfico NO renderiza datos en USD ni hace conversiones.

#### Scenario: Mes con sueldo a mitad de mes muestra subida brusca

- **WHEN** el mes seleccionado es mayo 2026 y el usuario tuvo un ingreso de $ 850.000 el día 15 y gastos repartidos durante el mes
- **THEN** el gráfico muestra una pendiente decreciente desde el día 1 al 14 (gastos sin ingresos), un salto vertical hacia arriba el día 15 (sueldo), y una pendiente suavemente decreciente desde el 15 hasta fin de mes

#### Scenario: Navegar al mes anterior recarga los datos sin recargar la página

- **WHEN** el usuario en mayo 2026 toca la flecha izquierda
- **THEN** la tarjeta obtiene y muestra los datos de abril 2026
- **AND** la flecha derecha se habilita (ya no estamos en el mes actual)
- **AND** la URL no cambia y el resto de la página (Hero, "Lo que viene") no se vuelve a renderizar

#### Scenario: El estado de carga reemplaza solo el gráfico y el footer

- **WHEN** el usuario navega a un mes cuyos datos aún no están disponibles y el fetch está en curso
- **THEN** el área del gráfico y del footer muestra el `MonthBalanceSkeleton` (bloque grande del chart + mini-bloques del footer)
- **AND** el título de la sección y el navegador mensual siguen visibles e interactivos
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos
- **AND** NO se muestra un spinner centrado en esa área

#### Scenario: El estado de error permite reintentar sin perder el navegador

- **WHEN** el fetch de los datos del mes seleccionado falla
- **THEN** el área del gráfico y del footer muestra un mensaje de error compacto con una acción de reintentar
- **AND** el título de la sección y el navegador mensual siguen visibles
- **AND** al reintentar, la tarjeta vuelve a obtener los datos del mismo mes seleccionado
- **AND** el alto y el ancho de la tarjeta no cambian respecto del estado con datos

#### Scenario: La flecha derecha está deshabilitada en el mes actual

- **WHEN** el usuario está viendo el mes actual
- **THEN** la flecha derecha del navegador está deshabilitada visual y funcionalmente

#### Scenario: Límite de 12 meses hacia atrás

- **WHEN** el usuario navegó 12 meses hacia atrás y toca la flecha izquierda
- **THEN** la flecha izquierda está deshabilitada y la navegación no avanza

#### Scenario: El navegador no desborda la tarjeta en viewports angostos (web)

- **WHEN** el viewport tiene un ancho entre ~1024px y ~1088px (la columna izquierda del grid del dashboard queda angosta)
- **THEN** el navegador mensual, incluida la flecha derecha, queda contenido dentro de los límites de la tarjeta
- **AND** el título de la sección se trunca si hace falta para dejar espacio, en lugar de empujar el navegador fuera del contenedor

#### Scenario: Consumo en tarjeta no impacta el gráfico

- **WHEN** el usuario registra un consumo de $ 30.000 en su tarjeta el día 10 del mes
- **THEN** el gráfico del mes actual NO refleja ese consumo como bajada
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí aparece como bajada en la fecha del pago

#### Scenario: Mes sin movimientos confirmados muestra línea plana

- **WHEN** el mes seleccionado no tiene ningún ingreso ni gasto confirmado
- **THEN** el gráfico muestra una línea horizontal sobre el eje X (acumulado = 0)
- **AND** debajo muestra "Ingresos $ 0 · Gastos $ 0" y "Balance + $ 0"

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar las tres secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada sección SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en una sección NO SHALL bloquear ni romper el renderizado de las demás. En web, esta independencia SHALL implementarse envolviendo cada sección en su propio `<Suspense>` con su **skeleton shape-matched** correspondiente como `fallback` (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`), y haciendo que cada sección fetchee su data en un container async dedicado que degrade a un estado de error compacto si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varias secciones bloqueando el streaming entre ellas.

Cada sección SHALL declarar un `min-height` sobre el root del componente real y sobre su **skeleton** correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando una sección pasa de su skeleton al contenido real. La card de bienvenida ("Cargá tu primer movimiento") es la única excepción: por ser condicional y rara vez visible, su `<Suspense>` puede usar `fallback={null}` y aceptar un shift breve cuando se materializa.

Los skeletons SHALL anticipar visualmente la anatomía de la sección (ver requirement "Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched") y SHALL declarar un `aria-label` localizado específico de la sección reusando las keys `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading`. NO SHALL reusarse un mensaje genérico para todas las secciones.

#### Scenario: Usuario nuevo sin transacciones ve dashboard funcional

- **WHEN** un usuario recién creado por el onboarding carga `/dashboard` sin haber registrado ningún movimiento ni consumo
- **THEN** el Hero muestra `$ 0,00` y `u$s 0,00`
- **AND** "Lo que viene" muestra el estado vacío
- **AND** "Balance del mes" muestra la línea plana en 0

#### Scenario: Falla parcial en una query no rompe la pantalla

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB)
- **THEN** la sección "Lo que viene" renderiza un estado de error compacto ("No pudimos cargar los próximos eventos")
- **AND** las otras dos secciones renderizan normalmente

#### Scenario: Cada sección stream-ea apenas resuelve su query (web)

- **WHEN** un usuario carga `/dashboard` y la query de `getDashboardHero` resuelve antes que la de `getUpcomingFortnight`
- **THEN** el Hero pinta sus importes en cuanto su query resuelve, sin esperar a "Lo que viene"
- **AND** "Lo que viene" sigue mostrando su `UpcomingFortnightSkeleton` hasta que su propia query resuelva
- **AND** ambas secciones están envueltas en `<Suspense>` independientes

#### Scenario: El skeleton ocupa el mismo alto que el contenido (web)

- **WHEN** una sección del dashboard está mostrando su skeleton de loading y luego su query resuelve
- **THEN** el hueco que ocupaba el skeleton es el mismo que ocupa el contenido real (min-height matcheado)
- **AND** las secciones que ya estaban pintadas debajo no se desplazan verticalmente

#### Scenario: Cada skeleton declara un aria-label específico de la sección (web)

- **WHEN** un usuario con lector de pantalla carga `/dashboard` y todavía no resolvieron las queries
- **THEN** el `HeroSkeleton` declara `aria-busy="true"` y un `aria-label` derivado de `dashboard.hero_loading`
- **AND** el `UpcomingFortnightSkeleton` declara un `aria-label` derivado de `dashboard.upcoming.loading`
- **AND** el `MonthBalanceSkeleton` declara un `aria-label` derivado de `dashboard.month.loading`
- **AND** NO se reusa un label genérico tipo "Cargando…" sin contexto

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

Los componentes mobile del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase: `HeroSection`, `HeroSkeleton`, `UpcomingFortnightSection`, `UpcomingFortnightSkeleton`, `MonthBalanceSection`, `MonthBalanceSkeleton`, `MonthBalanceChart`, `MonthNavigator`, `CategoryTeaser`, `CategoryTeaserSkeleton`, `MaskedAmount`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardHeader`, `WelcomeFirstMoveCard`. Las props públicas SHALL coincidir cuando es técnicamente posible. El carrusel de tarjetas (`CreditCardCarousel`, `CreditCardItem`) ya no es parte del dashboard: vive en el módulo cards (`apps/mobile/components/cards/`) y lo consume la pantalla `/cards`.

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `FlatList`, `react-native-svg`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. Los skeletons mobile SHALL componer el primitivo `SkeletonBlock` (de `apps/mobile/components/ui/`) en vez de re-implementar la animación pulse en cada caso. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

`SectionFallback` ya NO forma parte del set de componentes espejados del **dashboard** — los containers del dashboard (web y mobile) ya no lo importan, ni para loading ni para error states. El archivo en sí permanece en ambas plataformas (`apps/web/components/ui/section-fallback.tsx`, `apps/mobile/components/dashboard/SectionFallback.tsx`) porque sigue siendo utility compartida por otras rutas (`accounts`, `cards`); su migración eventual a skeletons queda fuera del scope de este change.

#### Scenario: Mismo nombre de componente entre web y mobile

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los nombres PascalCase exportados coinciden uno a uno (incluyendo los 4 nuevos skeletons)
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Componente mobile usa primitivas RN

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx`
- **THEN** el componente usa `View`/`Text`/`Pressable` y NO usa elementos del DOM como `div`, `span`, ni `<Link>` de Next
- **AND** la navegación usa `useRouter()` de `expo-router`

#### Scenario: Skeletons mobile componen el primitivo `SkeletonBlock`

- **WHEN** se inspecciona cualquiera de los 4 skeletons mobile (`HeroSkeleton`, `UpcomingFortnightSkeleton`, `MonthBalanceSkeleton`, `CategoryTeaserSkeleton`)
- **THEN** los bloques pulsantes se renderizan vía `<SkeletonBlock className="…"/>` importado de `apps/mobile/components/ui/SkeletonBlock`
- **AND** ningún skeleton mobile usa `Animated.View` ni `useSharedValue` directamente (la animación está encapsulada en el primitivo)

#### Scenario: Los componentes del dashboard no importan `SectionFallback`

- **WHEN** se busca `SectionFallback` con grep dentro de los directorios del dashboard (`apps/web/app/(app)/dashboard/` y `apps/mobile/components/dashboard/` + `apps/mobile/app/(app)/dashboard.tsx`)
- **THEN** ningún archivo del dashboard lo importa, ni como `<Suspense>` fallback ni como error state
- **AND** los archivos `apps/web/components/ui/section-fallback.tsx` y `apps/mobile/components/dashboard/SectionFallback.tsx` siguen existiendo porque otras rutas (`accounts`, `cards`) aún los consumen

---

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las secciones del dashboard en orden vertical (Hero → Lo que viene → Balance del mes) envueltas en `EyeMaskProvider`. La pantalla SHALL ser un **shell**: monta el header y coloca las secciones, pero NO SHALL orquestar las queries de las secciones ni decidir su render en función de `data`/`error` desde el padre. Cada sección SHALL poseer su propia query (vía TanStack Query) y manejar su propio loading/error in-card.

La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard. SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy", calculado una vez en el shell y pasado por prop a las secciones que lo necesiten.

**Shell visible desde el primer paint.** La pantalla NO SHALL bloquear el render con un spinner a pantalla completa que espere a que resuelvan las queries. El header (saludo + fecha + `eye toggle`) y el frame scrolleable SHALL renderizarse desde el primer paint, antes de que cualquier query resuelva. El saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") hasta que la query del nombre del perfil resuelva, momento en el que SHALL actualizarse al saludo personalizado; si esa query falla, el saludo SHALL permanecer en el fallback anon sin bloquear la pantalla. La fecha del header NO SHALL depender de ninguna query: SHALL derivarse de `getTodayAR()` y mantenerse estable.

**Carga independiente por sección, sin layout shift.** Cada sección SHALL renderizar su chrome (título/label, y en Balance del mes el navegador mensual) de forma persistente, y SHALL delegar únicamente su región de datos a un intercambio entre tres estados: carga (**skeleton shape-matched**), error (mensaje localizado + acción de reintentar) y datos. Esa región SHALL declarar un alto mínimo estable de modo que el alto de la sección NO cambie entre los estados de carga, datos y error (sin layout shift). Una query lenta o fallida en una sección NO SHALL bloquear ni desplazar a las demás. Esta es la misma arquitectura que `MonthBalanceSection` ya implementa; las secciones Hero y "Lo que viene" SHALL seguirla. El skeleton SHALL vivir **dentro** de la swap region (en la misma posición donde antes vivía el `<Spinner/>`), NO SHALL reemplazar el chrome de la card.

**Card de bienvenida auto-gateada.** `WelcomeFirstMoveCard` SHALL poseer la query `hasUserMovements` y renderizar `null` mientras la query no resuelve o si el usuario ya tiene movimientos; SHALL materializarse solo cuando el usuario no tiene movimientos. Por ser condicional y rara vez visible, se acepta el layout shift breve al aparecer (misma excepción que web).

**Pull-to-refresh.** El `RefreshControl` de la pantalla SHALL ligar su estado `refreshing` al **gesto de pull**, no a objetos de query retenidos en el shell ni al conteo de queries en vuelo del prefijo `['dashboard']`. En particular, los fetches internos de una sección que comparten ese prefijo (p. ej. la query `balance-series` que dispara `MonthBalanceSection` al navegar de mes) NO SHALL encender el `RefreshControl`. El gesto de pull SHALL invalidar las queries bajo el prefijo `['dashboard']`, y el indicador SHALL permanecer encendido mientras esos refetches del pull no terminen.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan).

#### Scenario: El shell y el header se ven desde el primer paint (mobile)

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado, antes de que resuelva cualquier query
- **THEN** el header (saludo, fecha y `eye toggle`) y el frame del dashboard ya están visibles
- **AND** NO se muestra un spinner a pantalla completa que oculte header y secciones
- **AND** el saludo muestra el fallback anon ("Hola.") y la fecha de hoy correcta

#### Scenario: El nombre del perfil llega async y actualiza el saludo (mobile)

- **WHEN** la query del nombre del perfil resuelve con `full_name = "Cristian Perez"` después del primer paint
- **THEN** el saludo pasa de "Hola." a "Hola, Cristian."
- **AND** la fecha del header no cambió

#### Scenario: Las secciones cargan independientemente sin layout shift (mobile)

- **WHEN** la query de `getDashboardHero` resuelve antes que la de `getUpcomingFortnight`
- **THEN** el Hero pinta sus importes en cuanto su query resuelve, sin esperar a "Lo que viene"
- **AND** "Lo que viene" sigue mostrando su `UpcomingFortnightSkeleton` in-card sobre su alto mínimo estable
- **AND** cuando "Lo que viene" resuelve, su contenido aparece dentro del alto que ya ocupaba, sin empujar al Hero ni a "Balance del mes"

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB) en mobile
- **THEN** `UpcomingFortnightSection` muestra in-card un mensaje de error localizado con acción de reintentar, dentro de su alto estable
- **AND** Hero y Balance del mes renderizan normalmente
- **AND** NO se dispara `getCreditCards` para el dashboard

#### Scenario: La card de bienvenida se auto-gatea (mobile)

- **WHEN** un usuario sin movimientos carga `/dashboard` y la query `hasUserMovements` aún no resolvió
- **THEN** la card de bienvenida no se renderiza todavía (`null`), sin reservar espacio
- **AND** cuando la query resuelve con "sin movimientos", la card aparece arriba de las secciones (shift breve aceptado)
- **AND** si el usuario tiene movimientos, la card nunca se renderiza

#### Scenario: Pull-to-refresh muestra el indicador solo durante el gesto (mobile)

- **WHEN** el usuario hace pull-to-refresh en el dashboard
- **THEN** se invalidan las queries bajo `['dashboard']` y vuelven a fetchearse
- **AND** el `RefreshControl` muestra el indicador hasta que esos refetches terminan (ligado al gesto, no a objetos de query del shell)

#### Scenario: Navegar de mes en "Balance del mes" no enciende el refresh superior (mobile)

- **WHEN** el usuario toca una flecha del navegador mensual de "Balance del mes" y se dispara la query `balance-series` del nuevo mes

- **THEN** solo el `MonthBalanceSkeleton` in-card de "Balance del mes" se muestra mientras esa query carga
- **AND** el `RefreshControl` superior NO se enciende
- **AND** la posición de scroll no se desplaza

#### Scenario: Salir del tab dashboard y volver resetea el eye toggle (mobile)

- **WHEN** el usuario mobile activa el eye toggle, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente (el provider se desmonta y se vuelve a montar)
