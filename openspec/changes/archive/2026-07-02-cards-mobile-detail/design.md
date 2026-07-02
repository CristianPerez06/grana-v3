## Context

La ruta de detalle de tarjeta vive sólo en web. Tras los tres slices de extracción, `@grana/cards` expone **todo lo cross-platform** que el detalle necesita:

- Reads client-agnósticos: `getCreditCardDetail`, `getCardPeriods`, `getActiveInstallments` (+ `getCardNetworks`, `getCardPeriodDetail`, `getCardPeriodTransactionCount`), cada uno con `supabase: GranaSupabaseClient` como primer parámetro y `today: Date` inyectado.
- Builder puro: `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` → `{ kind: 'not-found' } | { kind: 'new-card'; shared } | { kind: 'archived-empty'; shared } | { kind: 'active'; shared; vm: CardDetailViewModel }`, sin I/O.
- Presentación: `cardAccent`, `pillTone`, `resolveEditCycle`, `formatDayMonth`.

El `page.tsx` web ya está adelgazado a: fetch (vía wrappers que inyectan `getTodayAR()`) → `resolveCardDetailState` → `switch (state.kind)` de render. Mobile replica exactamente esa forma: mismos reads (con el client nativo), mismo builder, distinta JSX (RN). No hay lógica de negocio que portar — sólo wrappers de read, la pantalla y sus componentes de presentación nativos.

Mobile ya usa TanStack Query para el listado (`apps/mobile/app/(app)/cards/index.tsx`), `PageHeader` custom en todas las pantallas, y `useT` para i18n desde `@grana/i18n-messages` (el mismo catálogo que web). El wallet ya navega a `/cards/${id}`; falta la pantalla destino.

## Goals / Non-Goals

**Goals:**
- Ruta `/cards/[id]` nativa que renderiza el detalle read-only reutilizando `resolveCardDetailState`, sin re-derivar el view-model ni re-implementar reads.
- Las cuatro ramas de estado (`not-found`, `new-card`, `archived-empty`, `active`) con JSX nativo idiomático.
- Overview activo: timeline del ciclo de vida, monto a pagar + días a vencimiento (display-only), total en curso, próximo cierre, panel de límite, cuotas en curso.
- Paridad visual con el detalle web a ancho angosto; paridad de nombres/props con los `_components` web.
- Header chrome (`PageHeader` + back-link) visible desde el primer paint.

**Non-Goals:**
- Cualquier escritura: pago de resumen, edición de tarjeta/fechas/cuotas, alta de primer consumo (change follow-up; requiere 5 mutation shells nativos + UIs). v1 no construye los mutation wrappers mobile.
- El pane de movimientos por período: proyecta a `FinancialMovement` y usa `MovementList`, web-only en `apps/web/lib/transactions/`; bloqueado hasta extraer el view-model de movimientos.
- Rutas anidadas `/cards/[id]/periods` y detalle de resumen (change follow-up, junto con movimientos).
- Crear un mock de diseño nativo nuevo (se usa el detalle web a ancho angosto como referencia).
- Tocar `@grana/cards` (ya completo) o el detalle web.

## Decisions

### D1 — v1 read-only: el corte es "no escribe"
El detalle nativo v1 renderiza pero no muta. Razón: la capa de reads + `resolveCardDetailState` está 100% lista y desbloqueada, mientras que la escritura necesita mutation shells nativos + UIs de formulario/confirmación no triviales (el pago compone confirmación de ciclo en curso, USD subordinado e impuesto de sellos). Separar el consumer de lectura del de escritura entrega valor ya y mantiene el change chico y verificable. Consecuencia concreta: sin lápiz de edición en el header, sin botón de pago, sin CTA de primer consumo. Alternativa descartada: construir todo (detalle + pago + edición) en un change → scope grande y acoplado a UIs de mutación que merecen su propio diseño.

### D2 — Sin segmented; `CuotasEnCursoPane` inline (respuesta A)
El web muestra una sección inferior con segmented `[Movimientos | Cuotas]` que default-ea a Movimientos. En v1 el pane de Movimientos está bloqueado, así que un segmented de una sola pestaña real es ruido. La sección inferior nativa muestra `CuotasEnCursoPane` inline, sin control segmentado. Cuando el primitivo de lista de movimientos aterrice en nativo, se reintroduce el segmented con ambas pestañas. Alternativa descartada: segmented con pestaña "Movimientos" deshabilitada/"próximamente" → afordancia muerta y confusa.

### D3 — Una sola pantalla; rutas anidadas deferidas (respuesta B)
v1 es sólo `/cards/[id]`. `/periods` (lista de resúmenes) y el detalle de un resumen quedan fuera porque el valor de un resumen pasado es mayormente su lista de movimientos (deferida); reingresan con el change de movimientos, que también aporta `getCardPeriodDetail`/`getCardPeriodTransactionCount` wrappers. Esto mantiene v1 en una pantalla + tres reads.

### D4 — Referencia de diseño: detalle web a ancho angosto, sin mock nuevo (respuesta 3)
La convención del repo es diseñar las tres vistas (web / web-mobile / nativo) como mocks HTML antes de specear. Excepción justificada acá: el detalle **ya está construido en web** y su `CardDetailView` colapsa a una sola columna en `< lg` (`grid ... lg:grid-cols-[...]`), así que el web a ancho angosto **es** la referencia autoritativa de la vista nativa. No se crea un mock nuevo bajo `docs/design/cards/` (que hoy sólo cubre el listado). La traducción sigue siendo a tokens estructurales, nunca hex literal (los aliases shadcn `bg-muted`/`bg-background` son web-only en mobile).

### D5 — Componentes nativos espejan por nombre, no por JSX
Bajo `apps/mobile/components/cards/detail/` nacen `CardDetailHeader`, `LifecycleTimeline`, `PayHeroCard`, `EnCursoCard`, `ProximoMiniRow`, `CardLimitPanel`, `CuotasEnCursoPane` — mismos nombres y props públicas que los web `_components`, implementación RN idiomática, sin JSX compartido. Todos consumen `CardDetailViewModel`/`LifecyclePeriod`/`PeriodKey` de `@grana/cards` (paridad por tipo, no por componente). Es la regla cross-platform ya codificada.

### D6 — Fetch: una query TanStack para los tres reads; `resolveCardDetailState` en la pantalla
La pantalla usa una `useQuery` con key `['cards','detail', id]` cuyo `queryFn` corre los tres wrappers (`getCreditCardDetail`, `getCardPeriods`, `getActiveInstallments`) y devuelve `{ cardDetail, periods, installments }`. La pantalla invoca `resolveCardDetailState({ ..., todayISO: formatDateISO(getTodayAR()) })` en render (no en el `queryFn`, para que `today` sea fresco al renderizar) y hace `switch`. Un solo query key simplifica loading/error/invalidation. Read-only ⇒ sin invalidaciones nuevas (el listado ya se invalida por su cuenta). Alternativa descartada: tres queries separadas → tres estados de carga a coordinar antes de poder llamar al builder, que necesita los tres juntos.

### D7 — Header chrome siempre visible; sin skeleton de pantalla completa
`CardDetailHeader` monta sobre `PageHeader` con back-link desde el primer paint. Mientras `isPending`, el título muestra un placeholder (no `PageHeaderSkeleton`), y el cuerpo muestra un fallback de sección. En `not-found` (o `state.kind === 'not-found'`), header presente + mensaje de no encontrado. Regla canónica `route-loading-and-errors` + `header-chrome-always-visible`.

## Risks / Trade-offs

- **Un detalle read-only sin movimientos ni pago puede sentirse fino** → Mitigación: aún responde las preguntas núcleo (cuánto debo / cuándo vence / cuánto límite queda / qué cuotas corren); movimientos y pago son fast-follow con diseño propio. El corte es explícito en el spec, no un olvido.
- **`PayHeroCard` display-only muestra un monto a pagar sin acción** → Mitigación: no se renderiza afordancia de pago (ni botón deshabilitado), evitando la promesa rota. Ver Open Questions sobre un hint textual.
- **`LifecycleTimeline` es el componente más pesado de portar** → Mitigación: es presentación pura sobre campos del `vm` (`apagar`/`curso`/`prox`, fechas, `is_estimated`, `accent`); portar con cuidado y smoke de todos los estados (con a-pagar / sin a-pagar / con pagados / con próximo estimado).
- **Deriva de tokens: aliases shadcn transparentes en mobile** → Mitigación: usar tokens estructurales (`bg-page`, `bg-card`, `text-text-muted`, `border-border`, …) como ya hace `Wallet.tsx`, nunca `bg-muted`/`bg-background`.
- **Claves i18n faltantes** → Mitigación: `cards.detail.*` ya existen (las usa web); si el layout inline de cuotas necesita alguna clave que sólo vivía bajo el segmented, se agrega a `@grana/i18n-messages` (es/en) en el mismo change. Verificar en implementación.

## Migration Plan

Sin migración de datos ni cambios en packages. Orden: (1) 3 wrappers de read en `apps/mobile/lib/cards/queries.ts`; (2) componentes de presentación nativos bajo `components/cards/detail/`; (3) la pantalla `[id].tsx` con la query + `resolveCardDetailState` + `switch`; (4) smoke de las cuatro ramas + estados del timeline; (5) verificar navegación del wallet → `/cards/[id]`. Rollback = borrar la ruta + los wrappers (nada más los consume). El listado mobile no cambia.

## Open Questions

- **`PayHeroCard` display-only**: ¿mostrar un hint textual ("pago disponible desde la web por ahora") o simplemente ninguna acción? Propuesta: **ninguna acción y ningún hint en v1** — el follow-up de pago cablea el botón; un hint provisional envejece mal. Revisar al implementar.
- **Copy del estado `new-card` sin CTA**: ¿reutilizar `cards.detail.ready_title`/`ready_description` sin el botón de primer consumo, o un copy propio "aún sin consumos"? Propuesta: reutilizar las claves existentes sin el botón. Confirmar en implementación.
- **Placement del requirement en el spec**: se agrega a `cards` (la Purpose ya enmarca el detalle como vista de primera clase). Si emergiera una capability de "mobile parity" más adelante, podría moverse; por ahora `cards` es su hogar.
