## Why

En producción, con muchas tarjetas de distintos bancos, el listado actual (cards grandes en grilla/carrusel) se vuelve pesado: demasiado scroll, poca comparación directa entre cierre, vencimiento, saldo y uso de límite. El problema es operativo, no estético. Una vista compacta agrupada por banco y desplegable resuelve el escaneo y la comparación, pero exige romper los no-goals del requirement de estilo visual vigente ("NO filtros/ordenamiento", "NO datos/queries nuevas") — que el propio spec (`cards`, regla de cierre) manda resolver con un change OpenSpec dedicado. El hero "A pagar este mes" se conserva como card unificada (no se rediseña).

## What Changes

- **BREAKING (de presentación):** El listado `/cards` deja de renderizarse como wallet de cards grandes (grilla `md+` / carrusel `< md` web, carrusel mobile) y pasa a una **vista compacta agrupada por banco**:
  - **Default "Por banco":** grupos **desplegables** (collapsible). Cada encabezado de banco muestra nombre, "N tarjetas · M en uso", total a pagar del banco y un badge de urgencia con el próximo vencimiento del grupo. Los grupos **auto-colapsan** cuando el banco está 100% al día y en $0; se mantienen expandidos si tienen deuda, vencimiento próximo o saldo. Toggle **"Todas"** (plano) y filtros `En uso` / `Vencen pronto` / `Con saldo`.
  - **2 filas por tarjeta** (web y mobile): fila 1 = identidad (monograma de red + nombre + red) + resumen + estado; fila 2 = cierre · vence + **barra de uso del resumen** (`—` sin límite).
  - **Web:** filas dentro de grupos desplegables (no tabla rígida de una fila).
  - **Mobile:** lista densa de ~2 líneas por tarjeta agrupada por banco, sin tabla horizontal.
- **Hero "A pagar este mes" rediseñado a card navy** (mismo patrón que el hero del dashboard, `bg-surface-dark`/`bg-navy`): monto ARS primario + USD subordinado + un **único destacado "Próximo cierre"** (fecha de **cierre**, no de vencimiento, vía `summary.nextClose`). Sin lista de próximos, sin chips/KPIs separados, sin KPI "Activas".
- **Estado por fila siempre visible** (vencido / por vencer / al día), reutilizando el `pillTone` actual — una deuda no se esconde aunque el grupo esté colapsado (el badge de urgencia del encabezado la delata y los grupos con deuda no se auto-colapsan).
- **Bimoneda apilada** en el monto del resumen (ARS primario + USD subordinado), nunca sumada ni convertida.
- **Barra de uso del resumen** en la fila 2, rotulada honesto (es el % del resumen vigente sobre el límite, no el cupo disponible real); muestra `—` cuando `credit_limit` es null.
- **Datos nuevos (rompe el no-goal "sin queries nuevas"):**
  - `getCreditCards` agrega `name` al embed de institución y lo expone para agrupar; grupo fallback **"Sin banco"** para `institution_id` null.
  - `CreditCardSummary` gana `inUse: boolean` derivado (`activePeriod.tx_count > 0 || activeInstallmentsCount > 0`), usado para el contador "M en uso" por grupo y el filtro `En uso`.
  - Mobile resuelve `networkNames` para el monograma/red de las filas (hoy no lo hace).
- **Se mantiene:** sección "Archivadas" colapsable, CTA "Agregar tarjeta" con primitivo `Button`, navegación fila → `/cards/[id]`, paridad semántica web/mobile con JSX nativo por plataforma, off-ledger, no ocultar negativos/clamped.
- **Fuera de v1 (backlog):** persistir el estado de colapso entre sesiones, "uso de límite real" sumando cuotas futuras de todos los períodos, rail lateral de bancos.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `cards`: Se reemplaza el requirement del listado (wallet de cards) por una vista compacta agrupada por banco y desplegable, con 2 filas por tarjeta, barra de uso, estado por fila y bimoneda apilada; y se reescribe el requirement de estilo visual/no-goals para permitir agrupación/filtros/orden, el colapso de grupos, y los campos/queries nuevos (`institution.name`, `inUse`, `nextClose`, `networkNames` en mobile). El hero se rediseña a card navy con un único "Próximo cierre".

## Impact

- **Web** (`apps/web/app/(app)/cards/_components/`): `wallet.tsx`, `wallet-card.tsx` → reemplazados por la vista compacta (grupos desplegables + filas de 2 líneas con barra de uso); `cards-month-hero.tsx` (+ skeleton) → rediseñado a card navy con un único "Próximo cierre"; `card-presentation.ts` reutiliza `pillTone`, `cardAccent`, `formatDayMonth`.
- **Mobile** (`apps/mobile/`): `app/(app)/cards.tsx`, `components/cards/Wallet.tsx`, `CreditCardItem.tsx` → lista densa agrupada y desplegable; `CardsMonthHero.tsx` → rediseñado a card navy con un único "Próximo cierre".
- **Queries/Types** (`apps/web/lib/cards/queries.ts` + gemelo mobile): `getCreditCards` (embed `institution.name`, derivar `inUse`), `CreditCardSummary` (+ banco, +`inUse`); `CardsMonthSummary` (+`nextClose`).
- **Lógica pura** (`lib/cards/`): helper de agrupación por banco + orden + regla de auto-colapso (compartible a nivel de lógica, no de JSX).
- **i18n** (`packages/i18n-messages`): claves de filtros, estado, "Sin banco", "uso", encabezado de grupo.
- **Mockup de referencia:** `docs/mockups/cards-compact-final.png` (+ `.html` editable).
- **Sin migraciones**: `institutions.name` ya existe; todo lo demás es read-path y presentación.
