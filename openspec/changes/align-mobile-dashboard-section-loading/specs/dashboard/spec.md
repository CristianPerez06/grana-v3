# Delta — Modelo de carga del dashboard mobile

## MODIFIED Requirements

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las secciones del dashboard en orden vertical (Hero → Lo que viene → Balance del mes) envueltas en `EyeMaskProvider`. La pantalla SHALL ser un **shell**: monta el header y coloca las secciones, pero NO SHALL orquestar las queries de las secciones ni decidir su render en función de `data`/`error` desde el padre. Cada sección SHALL poseer su propia query (vía TanStack Query) y manejar su propio loading/error in-card.

La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard. SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy", calculado una vez en el shell y pasado por prop a las secciones que lo necesiten.

**Shell visible desde el primer paint.** La pantalla NO SHALL bloquear el render con un spinner a pantalla completa que espere a que resuelvan las queries. El header (saludo + fecha + `eye toggle`) y el frame scrolleable SHALL renderizarse desde el primer paint, antes de que cualquier query resuelva. El saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") hasta que la query del nombre del perfil resuelva, momento en el que SHALL actualizarse al saludo personalizado; si esa query falla, el saludo SHALL permanecer en el fallback anon sin bloquear la pantalla. La fecha del header NO SHALL depender de ninguna query: SHALL derivarse de `getTodayAR()` y mantenerse estable.

**Carga independiente por sección, sin layout shift.** Cada sección SHALL renderizar su chrome (título/label, y en Balance del mes el navegador mensual) de forma persistente, y SHALL delegar únicamente su región de datos a un intercambio entre tres estados: carga (spinner), error (mensaje localizado + acción de reintentar) y datos. Esa región SHALL declarar un alto mínimo estable de modo que el alto de la sección NO cambie entre los estados de carga, datos y error (sin layout shift). Una query lenta o fallida en una sección NO SHALL bloquear ni desplazar a las demás. Esta es la misma arquitectura que `MonthBalanceSection` ya implementa; las secciones Hero y "Lo que viene" SHALL seguirla.

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
- **AND** "Lo que viene" sigue mostrando su spinner in-card sobre su alto mínimo estable
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
- **THEN** solo el spinner in-card de "Balance del mes" se muestra mientras esa query carga
- **AND** el `RefreshControl` superior NO se enciende
- **AND** la posición de scroll no se desplaza

#### Scenario: Salir del tab dashboard y volver resetea el eye toggle (mobile)

- **WHEN** el usuario mobile activa el eye toggle, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente (el provider se desmonta y se vuelve a montar)
