# Design — redesign-cards-route

## Contexto y fuentes

- Handoff de diseño: `docs/design/design_handoff_tarjetas/` (`README.md` = fuente de verdad; `Grana - Tarjetas.html` = listado; `Grana - Tarjeta (detalle).html` = detalle; `Grana - Movimientos v3.html` = referencia del sistema visual existente).
- Los HTML son referencias hifi, **no** para copiar: se recrean con nuestros componentes y tokens.
- Continuación de `openspec/changes/archive/2026-05-25-redesign-card-detail-page/` (mismo dominio, nuevo lenguaje visual).

## Decisiones

### D1 — Ruta: se mantiene `/cards` (no `/tarjetas`)
El README sugiere `/tarjetas`, pero el módulo vive en `/cards` (convención del repo: rutas en inglés; `AGENTS.md` dice "el resumen vive en `/cards`"). "Tarjetas" queda como título visible en español. Evita romper links internos y la navegación del shell.

### D2 — API real, no mock
Se conecta a la query layer existente (`apps/web/lib/cards/queries.ts`) extendiéndola. El módulo `cards` ya está implementado (#9 Done); un mock sería deuda innecesaria.

### D3 — El ciclo de vida se deriva, no se persiste
Nuevo helper puro `classifyPeriodsLifecycle(periods, today): { apagar?: P; curso: P; prox: P | null }` en `packages/money-logic/src/cards.ts`:
- `apagar`: período sin pago con `end_date < today ≤ due_date` o `overdue` (estado `closed`/`overdue` con transacciones). Opcional.
- `curso`: el período `open` que contiene `today`.
- `prox`: el primer período con `start_date > curso.end_date` (real o proyectado en memoria con `suggestNextPeriodDates`, sin persistir — la página es de solo lectura).

Reutiliza `derivePeriodStatus`. No agrega columnas ni triggers (alineado al requirement "El estado del período se deriva sin persistir").

### D4 — Acento por tarjeta vía `resolveAccountAvatar`
El acento (`--cc-accent` en el HTML) se inyecta como CSS var por card a partir de `resolveAccountAvatar(account)` (override del usuario → `network.brand_color` → `institution.brand_color`). Nunca hardcodeado por marca. Tiñe: franja lateral, avatar, barra de límite, ring de selección, dots de cuotas.

### D5 — Reuso de la fila de movimiento
"Movimientos del período" reusa `MovementRow`/`MovementList` (`apps/web/lib/transactions/components/`). Se agrega un mapper `cardPeriodTransactionToMovement(tx, card)` que adapta el shape de `CardPeriodDetail.transactions` (que ya trae `installment_n`/`installments_total`, `category`/`subcategory`, `fx_rate_to_ars`, `currency_code`) al `FinancialMovement` que consume la fila. No se duplica la fila ni el formateo de montos.

### D6 — Bimoneda estricta
ARS y USD se muestran **separados, nunca sumados ni convertidos** (principio Bimoneda + `I-CRED-9`: cuotas solo ARS). El hero del listado y los montos del detalle muestran ARS como primario (tipografía grande) y USD subordinado, solo cuando el monto USD > 0. Los cálculos de límite/disponible son ARS-only.

### D7 — Límite opcional
`credit_limit` puede ser `null`. Cuando lo es: el wallet omite la barra de límite, y el detalle muestra el CTA "Cargar límite" → `/cards/[id]/edit` (en vez del panel usado/total/%/disponible).

### D8 — Sin número de tarjeta
La app no almacena el PAN. La meta de cada card es "Crédito · <red>", nunca dígitos.

## Estado de UI (detalle, client component)

`CardDetailView` mantiene:
- `periodo: 'apagar' | 'curso' | 'prox'`
- `tab: 'movs' | 'cuotas'`

Reglas (del README §"Estado"):
- Default al entrar: `periodo = apagar ?? curso`, `tab = 'movs'`.
- Si no hay "a pagar" y el período activo era `apagar`, caer a `curso`.
- Click en paso del timeline / hero a pagar / card en curso / mini próximo → cambia `periodo` y vuelve a `tab = 'movs'`. El elemento activo recibe ring de acento.
- Click en pestaña → cambia `tab`.
- Sin `scrollIntoView`, sin animación de entrada del pane (evita el bug de opacidad documentado en el handoff).

## Datos de lectura a extender (`apps/web/lib/cards/queries.ts`)

1. **Wallet footer** — cantidad de compras en cuotas activas por tarjeta: parents (`is_parent=true`) con al menos una hija `pending`. Se agrega a `CreditCardSummary` (campo `activeInstallmentsCount`).
2. **Hero del listado** — agregado a nivel usuario: suma de los montos "a pagar" (períodos `closed`/`overdue` sin pago) por moneda (ARS/USD separados) y lista de próximos vencimientos (tarjeta, fecha de cierre/vencimiento, monto). Nueva función `getCardsMonthSummary()`.
3. **Cuotas en curso por tarjeta** — nueva función `getActiveInstallments(accountId)`: por compra (parent), `name`/`description`, categoría, fecha de compra, cuota actual/total, monto por cuota, restante, próxima fecha de cuota; más el total restante agregado.

Estas funciones son de **solo lectura** y respetan RLS (vía la cuenta del usuario), sin escrituras.

## Componentes (web)

Listado (`apps/web/app/(app)/cards/` + `_components/`):
- `cards-month-hero.tsx` — "A pagar este mes" (ARS + USD aparte + próximo vencimiento) + lista "Próximos vencimientos".
- `wallet-grid.tsx` + `wallet-card.tsx` — grilla 2-col y card sobria (franja de acento, avatar, stats, barra de límite, footer cuotas + "Ver resumen").
- `card-status-pill.tsx` — pill due/soon/ok (reusable en ambas pantallas).
- `card-limit-bar.tsx` — barra de límite teñida con acento (reusable).

Detalle (`apps/web/app/(app)/cards/[id]/` + `_components/`):
- `card-detail-view.tsx` (client) — orquesta `periodo`/`tab`.
- `card-detail-header.tsx` — header compuesto (avatar 54px + nombre + pill + banco). Excepción permitida a `PageHeader` (como `CardHero`/`AccountDetailHeader`).
- `lifecycle-timeline.tsx` — stepper Pagado→[A pagar]→En curso→Próximo, clickeable.
- `pay-hero-card.tsx` — hero terracota con countdown + "Registrar pago".
- `en-curso-card.tsx` — badge "Sumando consumos" + panel de ciclo.
- `proximo-mini-row.tsx` — fila punteada clickeable.
- `card-limit-panel.tsx` — panel cargado / CTA "Cargar límite".
- `period-tabs.tsx` — `Segmented`: Movimientos | Cuotas en curso · N.
- `period-movements-pane.tsx` — reusa `MovementList` + mapper.
- `cuotas-en-curso-pane.tsx` + `cuota-progress-dots.tsx`.

## Estados, loading y responsive

- **Vacíos**: tarjeta sin tarjetas (listado), período sin movimientos ("Sin movimientos"), sin cuotas en curso ("Sin compras en cuotas"), límite no cargado (CTA), tarjeta nueva (`tarjeta_nueva`) sin termómetro/timeline. Reusan los patrones de empty-state del codebase.
- **Loading**: `loading.tsx` por layout group de Next + `Spinner` (módulo `route-loading-and-errors` ya existente).
- **Responsive**: la grilla del wallet colapsa a 1 columna bajo `md`; el hero pasa de 3 columnas a apilado; las pestañas y el timeline son scrollables horizontalmente en mobile-web. Sigue los breakpoints del shell (`web-app-shell`).

## Riesgos / consideraciones

- **Proyección de "próximo"**: si no existe la fila real del período próximo, se proyecta en memoria (no se persiste) con `suggestNextPeriodDates`. Coherente con la generación lazy existente.
- **Acumulado "en curso" incluye cuotas del ciclo**: el monto del período en curso ya considera las cuotas que caen en ese ciclo (las hijas `pending` con `card_period_id` del período). No se recalcula aparte.
- **Performance del listado**: `getCardsMonthSummary` y el conteo de cuotas deben resolverse en una o pocas queries agregadas, no N+1 por tarjeta.
- **Paridad mobile**: se documenta como pendiente; este change es web-only.
