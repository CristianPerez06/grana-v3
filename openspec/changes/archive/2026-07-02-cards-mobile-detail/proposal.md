## Why

La ruta `/cards/[id]` **existe sólo en web** (`apps/web/app/(app)/cards/[id]/page.tsx`). En mobile, tocar una tarjeta del wallet ya navega a `/cards/${id}` (`apps/mobile/components/cards/Wallet.tsx`), pero **esa pantalla no existe** (`apps/mobile/app/(app)/cards/` sólo tiene `_layout`, `index`, `new`): el tap cae en la ruta faltante de Expo Router.

Los tres slices previos (`cards-list-pure-logic`, `cards-detail-data-layer`, `cards-mutations`) ya dejaron **toda la lógica cross-platform del detalle en `@grana/cards`**: los reads client-agnósticos (`getCreditCardDetail`, `getCardPeriods`, `getActiveInstallments`, …), el builder puro `resolveCardDetailState` (que colapsa la pantalla a un discriminated union `not-found | new-card | archived-empty | active`) y la presentación (`cardAccent`, `pillTone`, `resolveEditCycle`). No queda nada por extraer: construir el detalle nativo es un **consumer build puro**.

Este change construye la ruta `/cards/[id]` nativa **read-only (v1)**: muestra el overview del ciclo de vida del resumen (a pagar / en curso / próximo, montos, límite, cuotas en curso) reutilizando `resolveCardDetailState`, sin re-derivar el view-model y sin re-implementar reads. Es la pieza de UI que faltaba para que los taps del wallet aterricen.

El corte read-only es deliberado: la capa de reads + VM está 100% lista y **desbloqueada**, mientras que todo lo que escribe (pago de resumen, edición de tarjeta/fechas/cuotas, alta de primer consumo) necesita 5 mutation shells nativos + UIs de formulario/confirmación (el flujo de pago es el más complejo: confirmación de ciclo en curso, USD subordinado, impuesto de sellos), y el pane de movimientos por período está bloqueado por la extracción de `FinancialMovement`/`MovementList` (hoy web-only en `apps/web/lib/transactions/`). Ambos son changes follow-up. v1 entrega valor ya: responde "cuánto debo, cuándo vence, cuánto límite queda, qué cuotas corren" de un vistazo.

## What Changes

- **Wrappers de read mobile** en `apps/mobile/lib/cards/queries.ts` (thin, espejo del patrón `getCreditCards`/`getCardNetworks` ya presentes): `getCreditCardDetail`, `getCardPeriods`, `getActiveInstallments` — inyectan el client nativo + `getTodayAR()`, conservan firma zero-arg (salvo `id`), re-exportan tipos desde `@grana/cards`. (No se agregan `getCardPeriodDetail`/`getCardPeriodTransactionCount`: sólo los consumen las rutas anidadas, deferidas.)
- **Ruta nativa `apps/mobile/app/(app)/cards/[id].tsx`**: carga los tres reads vía TanStack Query, invoca `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` de `@grana/cards`, y hace `switch` sobre `state.kind` para renderizar las cuatro ramas con JSX nativo. Sin derivación de negocio inline (paridad con el `page.tsx` web ya adelgazado).
- **Componentes nativos del detalle** bajo `apps/mobile/components/cards/detail/` que espejan por nombre a los web `_components` (regla cross-platform: mismos nombres/props públicas, implementación RN idiomática, sin JSX compartido; consumen `CardDetailViewModel`/`LifecyclePeriod`/`PeriodKey` de `@grana/cards`): `CardDetailHeader` (sobre `PageHeader`), `LifecycleTimeline`, `PayHeroCard`, `EnCursoCard`, `ProximoMiniRow`, `CardLimitPanel`, `CuotasEnCursoPane`.
- **Corte read-only explícito**: `PayHeroCard` es display-only (monto a pagar + días a vencimiento, **sin** botón de pago); el estado `new-card` es informativo **sin** CTA de primer consumo; **sin** lápiz de edición en el header; **sin** acciones de escritura en ninguna rama.
- **Sin control segmentado movimientos/cuotas** (decisión A): como el pane de movimientos por período está bloqueado (necesita un primitivo de lista de movimientos nativo), la sección inferior muestra `CuotasEnCursoPane` **inline**, sin el segmented `[Movimientos | Cuotas]` del web. El segmented reaparece cuando la lista de movimientos aterrice en nativo.
- **Una sola pantalla** (decisión B): v1 es sólo `/cards/[id]`. Las rutas anidadas web (`/periods`, detalle de resumen) quedan **fuera** — el valor de un resumen pasado es mayormente su lista de movimientos, deferida; reingresan con el change de movimientos.
- **Header chrome siempre visible** (convención): `PageHeader` desde el primer paint con back-link, placeholder en el título dinámico mientras carga, sin `PageHeaderSkeleton` de pantalla completa.
- **Referencia de diseño** (decisión 3): el detalle web renderizado a ancho angosto (el `CardDetailView` ya colapsa a una columna en `< lg`) es la referencia autoritativa; **no** se crea un mock nativo nuevo bajo `docs/design/cards/`.
- **Verificar la navegación del wallet** apunta a `/cards/[id]` (ya correcto en `Wallet.tsx`); si sobrevive algún `CreditCardItem` que empuje a `/cards`, corregirlo (nota stale del README de diseño).

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `cards`: se agrega un requirement que especifica la ruta de detalle de tarjeta **nativa (mobile)** como consumer read-only de `resolveCardDetailState` — sus cuatro ramas de estado, el overview activo (timeline + montos display-only + límite + cuotas inline), y lo que v1 NO incluye (escritura, pane de movimientos, segmented, rutas anidadas). La ruta de detalle web ya cubierta por el spec no cambia.

## Impact

- **Mobile**: `apps/mobile/lib/cards/queries.ts` gana 3 wrappers de read; nace `apps/mobile/app/(app)/cards/[id].tsx` + `apps/mobile/components/cards/detail/*`. Las claves i18n del detalle (`cards.detail.*`) ya existen en `@grana/i18n-messages` (las usa web); mobile las consume vía `useT`. Query key nueva `['cards','detail', id]`.
- **Packages**: **cero cambios** en `@grana/cards` — reads, VM y presentación ya están. Ninguna dependencia nueva.
- **Web**: sin cambios (referencia visual únicamente).
- **Specs**: delta additive de `cards` (ruta de detalle nativa read-only).
- **Dependencias entre changes**: depende de `cards-detail-data-layer` (reads + `resolveCardDetailState`) y `cards-list-pure-logic` (presentación), **ambos ya en main**. NO depende de `cards-mutations` (v1 es read-only). Sin bloqueos.
- **Fuera de scope (changes follow-up)**:
  - **Escritura**: pago de resumen (`payCardPeriod`), edición de tarjeta (`updateCreditCard`), edición de fechas de período (`updatePeriodDates`), edición/borrado de cuotas (`updateInstallmentParent`/`deleteInstallmentParent`), alta de primer consumo — con sus 5 mutation shells nativos + UIs.
  - **Pane de movimientos por período** (`period-movements-pane` / `card-movement-mapper`): proyecta a `FinancialMovement` y renderiza vía `MovementList`, ambos web-only en `apps/web/lib/transactions/`; bloqueado hasta extraer el view-model de movimientos a un package compartido.
  - **Rutas anidadas** `/cards/[id]/periods` (lista de resúmenes) y detalle de resumen, con sus wrappers `getCardPeriodDetail`/`getCardPeriodTransactionCount`.
