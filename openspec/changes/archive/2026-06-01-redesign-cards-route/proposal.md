## Why

Las dos pantallas de tarjetas (`/cards` listado y `/cards/[id]` detalle) tienen un sistema visual previo (carrusel horizontal + termómetro de 3 columnas) que ya no acompaña al lenguaje visual del resto de la app (Movimientos v3, Cuentas, Dashboard). El handoff de diseño `docs/design/design_handoff_tarjetas/` define un rediseño hifi de ambas pantallas que:

- Pone el foco en **"¿cuánto tengo que pagar?"** en el listado, agregando un hero "A pagar este mes" (ARS y USD por separado, nunca sumados) y un timeline de próximos vencimientos, con las tarjetas en una **wallet de grilla** en vez de un carrusel.
- Organiza el detalle alrededor del **ciclo de vida del resumen** — el modelo crítico del dominio: en una tarjeta argentina conviven varios resúmenes en distintos estados (uno **a pagar** que ya cerró y no venció, uno **en curso** abierto, y uno **próximo**). El rediseño los explicita con un timeline clickeable, un hero de pago terracota cuando hay deuda, y pestañas "Movimientos del período" / "Cuotas en curso".

El modelo de datos y la lógica (`card_periods`, `derivePeriodStatus`/`derivePeriodVariant`, cuotas madre/hija, pago de resumen) **ya existen y no cambian**. Este es un cambio de **capa de presentación + algunas agregaciones de lectura**, sin tocar DB, tipos generados, ni server actions de escritura.

Es continuación visual del change archivado `2026-05-25-redesign-card-detail-page`: mismo concepto de ciclo de vida, nuevo lenguaje visual.

## What Changes

### Listado `/cards`
- **Wallet en grilla** (2 columnas en desktop) reemplaza el carrusel horizontal. Cada card: franja lateral con el acento de la tarjeta, avatar+nombre+meta (red/banco, **sin número de tarjeta**), pill de estado (a pagar / cierra pronto / al día), stats (resumen del mes · cierra · vence), barra de límite (si está cargado), y footer con "N compras en cuotas" + link "Ver resumen".
- **Hero "A pagar este mes"**: agrega el total a pagar de **todas** las tarjetas (ARS grande + USD subordinado y separado, nunca convertido) y destaca el próximo vencimiento. A la derecha, lista "Próximos vencimientos".
- La sección **"Archivadas"** colapsable (introducida en el redesign anterior) se mantiene.

### Detalle `/cards/[id]`
- **Timeline de ciclo de vida** horizontal: `Pagado → [A pagar] → En curso → Próximo`. El paso "A pagar" aparece solo si existe ese resumen. Los pasos son clickeables y seleccionan el período mostrado abajo.
- **Hero de pago** (terracota) cuando hay un resumen **a pagar**: monto grande (ARS + USD aparte), "cerró el X · vence el Y", cuenta regresiva y CTA "Registrar pago" → flujo existente `/cards/[id]/periods/[periodId]/pay`. Si no hay "a pagar", la card **"En curso"** pasa a ser el hero.
- **Card "En curso"** con badge "Sumando consumos", monto acumulado (incluye cuotas del ciclo) y panel de ciclo ("cierra en N días", barra, "día X de N").
- **Mini fila "Próximo"** con lo ya comprometido en cuotas.
- **Panel de límite opcional**: si está cargado muestra usado/total/%/disponible; si no, CTA **"Cargar límite"** → `/cards/[id]/edit`.
- **Pestañas** "Movimientos del período" | "Cuotas en curso · N":
  - Movimientos del período: reusa `MovementRow`/`MovementList` (agrupado por fecha, chips "Cuota X de Y" / "Recurrente", ARS terracota / USD subordinado).
  - Cuotas en curso: card intro con total restante + una card por compra con dots de progreso (pagadas / próxima / futuras) y footer (por cuota · restante · próxima cae).
- **Período por defecto** al entrar: "A pagar" si existe; si no, "En curso" (consistente con el requirement de priorización de deuda ya existente).

### Datos (lectura, API real)
- `apps/web/lib/cards/queries.ts` se extiende con: conteo de compras en cuotas activas por tarjeta (footer del wallet), agregado a nivel listado del total "a pagar" (ARS/USD) + próximos vencimientos, y una query de "cuotas en curso" por tarjeta (compra, cuota actual/total, por cuota, restante, próxima fecha, total restante).
- Nuevo helper **puro** `classifyPeriodsLifecycle(periods, today) → { apagar?, curso, prox }` en `packages/money-logic/src/cards.ts`, reutilizando `derivePeriodStatus`.

### Acento por tarjeta
- El acento (`--cc-accent`) se deriva de `resolveAccountAvatar` (override del usuario → red → institución), **no hardcodeado por marca**.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`:
  - Requirement del listado reescrito: de carrusel a **wallet en grilla** con hero "A pagar este mes" agregado (ARS/USD separados) y timeline de próximos vencimientos. Se mantiene la sección "Archivadas".
  - Requirement del detalle reescrito: del termómetro de 3 columnas al **layout de ciclo de vida** (timeline clickeable, hero de pago terracota o "En curso" como hero, mini próximo, panel de límite con CTA "Cargar límite").
  - Nuevo requirement: el detalle muestra **movimientos del período** y **cuotas en curso** en pestañas, con selección de período interactiva.
  - Requirement de mora visible actualizado: en el detalle, la mora se comunica vía el hero de pago / paso "A pagar" del timeline (no vía banner sobre termómetro).

- `project-conventions`:
  - Nuevo requirement: las **acciones tipo botón componen el primitivo `Button`** (vía `asChild` cuando navegan), no recrean su estilo inline en un `<button>`/`<Link>`. Es el gemelo, para acciones, de la regla existente de superficies tipo tarjeta (`Card`). Surge de una regresión detectada en el CTA "Agregar tarjeta" de este change.
  - Requirement de `Card` actualizado: las **superficies tipo tarjeta clickeables** componen `Card` con la prop **`asChild`** (sobre Radix `Slot`, extensión web-local como `variant`), de modo que un `<Link>`/`<button>` sea el shell de tarjeta sin re-tipear `rounded-* border bg-card` inline. Todos los componentes de este rediseño cumplen la regla.

## Impact

- **Presentación (reescritura/nuevos componentes)** en `apps/web/app/(app)/cards/` y `_components/`: wallet grid + card de wallet, hero "A pagar este mes" + próximos vencimientos, timeline de ciclo de vida, hero de pago, card "En curso" + panel de ciclo, mini próximo, panel de límite, pestañas + pane de movimientos (reusa `MovementList`) + pane de cuotas en curso con dots de progreso. Los componentes previos del termómetro/carrusel se reemplazan o adaptan.
- **Lectura**: `apps/web/lib/cards/queries.ts` (3 agregaciones nuevas, ver arriba). Sin cambios en server actions de escritura.
- **Lógica pura**: `packages/money-logic/src/cards.ts` (`classifyPeriodsLifecycle`) + sus tests.
- **Reuso**: `MovementRow`/`MovementList` (transactions), primitivos `Button`/`Card`/`Segmented`/`Alert`/`Spinner`/`AccountAvatar`/`PageHeader`, `formatARS`/`formatUSD`, tokens de `@grana/ui-tokens`.
- **Rutas auxiliares** (`/cards/new`, `/cards/[id]/edit`, `/cards/[id]/periods/*`, `/pay`): **sin cambios**, solo se enlazan desde el rediseño.
- Sin cambios de DB ni de `packages/supabase/src/types.ts`.
- **Mobile** (`apps/mobile`): fuera de scope; se replicará en un change posterior con la misma IA si aplica.
