## MODIFIED Requirements

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar las tres secciones aunque alguna(s) de ellas no tengan datos o sus queries devuelvan vacío. Cada sección SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada sección SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en una sección NO SHALL bloquear ni romper el renderizado de las demás. En web, esta independencia SHALL implementarse envolviendo cada sección en su propio `<Suspense>` con un `SectionFallback` como `fallback`, y haciendo que cada sección fetchee su data en un container async dedicado que degrade a `SectionFallback` si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varias secciones bloqueando el streaming entre ellas.

Cada sección SHALL declarar un `min-height` sobre el root del componente real y sobre su `SectionFallback` correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando una sección pasa de su fallback al contenido real. La card de bienvenida ("Cargá tu primer movimiento") es la única excepción: por ser condicional y rara vez visible, su `<Suspense>` puede usar `fallback={null}` y aceptar un shift breve cuando se materializa.

Cada `SectionFallback` SHALL mostrar un mensaje localizado específico de la sección: durante loading usa una key `*.loading` ("Cargando…"), durante error usa una key `*.error` ("No pudimos cargar…"). NO SHALL reusarse un mensaje genérico para todas las secciones.

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
- **AND** "Lo que viene" sigue mostrando su `SectionFallback` de loading hasta que su propia query resuelva
- **AND** ambas secciones están envueltas en `<Suspense>` independientes

#### Scenario: El fallback ocupa el mismo alto que el contenido (web)

- **WHEN** una sección del dashboard está mostrando su `SectionFallback` de loading y luego su query resuelve
- **THEN** el hueco que ocupaba el fallback es el mismo que ocupa el contenido real (min-height matcheado)
- **AND** las secciones que ya estaban pintadas debajo no se desplazan verticalmente

#### Scenario: Cada `SectionFallback` muestra un mensaje específico de la sección (web)

- **WHEN** un usuario carga `/dashboard` y todavía no resolvieron las queries
- **THEN** el fallback del Hero muestra "Cargando tu disponible…" (key `dashboard.hero_loading`)
- **AND** el fallback de "Lo que viene" muestra "Cargando los próximos eventos…" (key `dashboard.upcoming.loading`)
- **AND** el fallback de "Balance del mes" muestra "Cargando el balance del mes…" (key `dashboard.month.loading`)
- **AND** NO se ven mensajes genéricos tipo "Cargando…" sin contexto

#### Scenario: La card de bienvenida puede generar layout shift cuando aparece (web)

- **WHEN** un usuario nuevo (sin movimientos) carga `/dashboard` y la query `hasUserMovements` resuelve después del Hero
- **THEN** la card de bienvenida aparece arriba del Hero y empuja el contenido hacia abajo
- **AND** esta es la única excepción aceptable al principio de "sin layout shift", documentada porque reservar espacio fijo perjudicaría al resto de usuarios que nunca la ven
