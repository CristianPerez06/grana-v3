## Why

El archivado de `redesign-dashboard-home-v2` (2026-08-21) reemplazó dos requirements del master por versiones más cortas que las que reemplazaban, borrando reglas vigentes: el requirement de skeletons pasó de 63 a 23 líneas y el de tolerancia a datos parciales de 47 a 23. Con eso se perdieron del spec la prohibición de spinners y de "Cargando…", el naming `*Skeleton`, la tecnología por plataforma, la accesibilidad de los skeletons, el `min-height` sin layout shift y la independencia de `<Suspense>` por bloque.

En paralelo, una auditoría de la pantalla mostró que **tres de los cuatro bloques incumplen el requirement de skeletons que el propio rediseño declaraba**: web "Cuánto gastaste" muestra su copy de vacío mientras carga, el nativo usa el skeleton del donut dado de baja, y Compromisos nativo pierde el encabezado de la card. El spec, además, nunca decidió tres cosas que el código necesitaba decidir igual: si el encabezado de la card sobrevive a la carga, qué hace un bloque condicional como Compartido, y si un estado vacío puede usarse como placeholder.

## What Changes

- **Se restauran** en el master las reglas que el archivado borró, integradas al requirement de skeletons y al de datos parciales.
- **Se especifica el estado de carga bloque por bloque**, que hasta hoy era una sola frase para los cuatro:
  - "Saldo disponible total" carga con **un único skeleton de card completa** (regla que ya existía y se conserva).
  - "Cuánto gastaste" y "Compromisos del próximo mes" conservan su **encabezado real desde el primer paint** — título, mes y link — y skeletonean solo el cuerpo.
  - La tira "Compartido" **no dibuja skeleton**: es condicional, y su estado de carga es no ocupar espacio.
- **Se prohíbe explícitamente** usar el estado vacío de un bloque o sus montos en cero como placeholder de carga, en la carga inicial y en la navegación de mes.
- **Se prohíbe** reusar el skeleton de un bloque como stand-in de otro (hoy `dashboard/loading.tsx` usa `CommittedSkeleton` dos veces).
- **Se corrigen tres referencias muertas** que ningún delta del rediseño tocó: los dos bullets de `route-loading-and-errors` que nombran `MonthBalanceSkeleton`/`SpendingSkeleton`, y el inventario de naming espejo mobile del spec `dashboard`, que además afirma que la tira Compartido no tiene par nativo cuando el rediseño se lo dio.
- **Se implementa** lo anterior en las dos plataformas: skeleton nuevo para "Cuánto gastaste" (web y mobile), chrome en el de Compromisos nativo, skeleton único de card para el saldo nativo, y cobertura de la navegación de mes en el saldo web.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `dashboard`: se restauran y se completan los requirements de estado de carga (skeletons shape-matched y tolerancia a datos parciales), con la regla por bloque, la prohibición del vacío falso y la excepción de Compartido; y se actualiza el inventario de naming espejo mobile a la composición vigente.
- `route-loading-and-errors`: el inventario de skeletons del dashboard —tanto el ejemplo de la regla general como el detalle de Variant C— nombra componentes dados de baja; se actualiza al set vigente y se deja escrito que ningún `loading.tsx` reusa el skeleton de un bloque para otro.

## Impact

- **Web** (`apps/web/app/(app)/dashboard/`): `spent-card-skeleton.tsx` nuevo; `dashboard-content.tsx` envuelve "Cuánto gastaste" en su propio `<Suspense>`; `spent-card.tsx` gana rama de carga; `loading.tsx` deja de duplicar `CommittedSkeleton`; `balance-card.tsx` cubre la navegación de mes.
- **Mobile** (`apps/mobile/components/dashboard/`): `SpentCardSkeleton` nuevo y baja de `SpendingSkeleton`; `CommittedSkeleton` gana la card y el encabezado; `BalanceCardSkeleton` reemplaza al `HeroSkeleton` parcial.
- **i18n**: sin claves nuevas. `dashboard.spent.loading` ya existe en ambos locales y hoy no tiene consumidores; `dashboard.spending.loading` queda huérfana con la baja del donut nativo.
- **Base de datos**: ninguna migración.
- **Riesgo**: bajo. Todo el cambio es de estado de carga; ningún número ni lectura se toca.
