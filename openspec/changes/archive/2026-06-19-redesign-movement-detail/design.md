## Context

La pantalla `/transactions/[txId]` ya existe y está bien cableada: la ruta, el fetch de datos en `page.tsx` (transacción, cuotas hermanas, reintegros, link de recurrencia, edit-context, shared-info, composición de pago de tarjeta) y los handlers de Editar/Eliminar (`TxActionsMenu` + `deleteTransaction` + drawer de edición) funcionan. Lo que cambia es la **capa de presentación**: hoy es `GlobalTransactionDetail` con `TxHero` + `TxDetailGroup`/`TxDetailRow`/`TxInstallmentRows`; el handoff (`detalle-movimiento/`) la reemplaza por hero-banda tintada + grilla de tiles por tipo.

Fuente de verdad de estilos: `detalle-movimiento/panel.css` (tokens, layout desktop, breakpoint `≤600px`). Referencias visuales: `tipo-*.html` (7 tipos) + `WEB`/`MOBILE`. El repo usa Next.js App Router, Tailwind + `@grana/ui-tokens`, Plus Jakarta Sans, `formatARS`/`formatUSD` (es-AR).

Restricciones del repo:
- Reusar paleta/tokens (`@grana/ui-tokens/theme.css`) — no duplicar colores.
- Reusar helpers de formato y el `TxActionsMenu` existente.
- Cero regresiones en lista, alta (drawer) y dashboard.
- App de gestión: nunca mostrar número de tarjeta.

## Goals / Non-Goals

**Goals:**
- Replicar fielmente la anatomía y los valores del handoff (radios, paddings, tamaños de hero/ring/barras) portándolos a Tailwind + tokens.
- Una sola estructura de detalle que se adapta al `kind`/tipo con los tiles correctos.
- Mobile-first con paridad: topbar sticky, "···" para secundarias, barra inferior con Editar; desktop = mismo layout a 2 columnas.
- Wirear con data real todos los tiles donde la data existe; marcar TODO claro donde no.

**Non-Goals:**
- Duplicar movimiento y "Convertir en recurrencia"/"Ver serie" (flujos de navegación que maneja el tech lead).
- Estado de liquidación por persona en compartido (el modelo no lo guarda por transacción).
- Cambiar la ruta o convertir el detalle en modal/drawer — sigue siendo página.
- Cambios de schema, migraciones o de la API de queries existentes.

## Decisions

### D1 — Rewrite de presentación, reuso de datos y handlers
`GlobalTransactionDetail` se reescribe para emitir la nueva anatomía. `page.tsx` conserva todos sus fetches y suma dos: el breakdown mensual (peso del mes) y `getRecurrenceDetail` (tile de recurrencia, solo cuando hay `recurrenceLink`). Los handlers de Editar/Eliminar y el drawer de edición se reusan tal cual; solo cambia **dónde** se renderizan los botones (topbar/barra inferior en lugar de kebab). El `TxActionsMenu` se adapta o se envuelve para el nuevo layout manteniendo su lógica (permisos, AlertDialog, drawer).

Alternativa descartada: mantener `TxDetailGroup`/`TxDetailRow` y solo reestilarlos → no alcanza, la grilla de tiles es estructuralmente distinta.

### D2 — Tono por tipo con CSS variables locales, no nuevos tokens globales
panel.css setea el tono con `--tone/--tone-soft/--tone-deep` y una clase en `<body>`. Lo portamos a un contenedor raíz del detalle (ej. `data-tone="gasto|ingreso|transfer"`) que define esas variables locales **referenciando los tokens existentes** de `@grana/ui-tokens` (terracotta, emerald-deep, slate ya existen como `--expense`/`--income`/etc. o sus equivalentes). Así los tiles usan `var(--tone)` sin duplicar hex ni crear tokens nuevos. Donde un token del handoff no exista 1:1 (ej. `--amber-soft`, `--plum`), se mapea al token de `ui-tokens` más cercano ya definido; si no hay, se agrega el token a `ui-tokens` (no inline hex).

Alternativa descartada: clases Tailwind condicionales por tono en cada tile → multiplica variantes; las CSS vars centralizan el tono en un solo lugar.

### D3 — Componentes de presentación bajo `_components/detail/`
Se crean componentes chicos y enfocados, uno por bloque/tile reutilizable, para no tener un archivo gigante:
- `detail-topbar` (volver + acciones + barra inferior mobile)
- `detail-hero` (banda, ícono, monto tonal, contexto, chips)
- `glance-grid` + `tile` (card base con eyebrow/aside)
- tiles específicos: `tile-payment-method` (Pagado con), `tile-installments` (barra cuotas), `tile-shared-split` (Te toca pagar + Dividido entre), `tile-reimbursement-net` (Resultado neto + linked), `tile-recurrence` (+ historial barras), `tile-transfer-flow` (origen→destino + callout), `tile-detail-rows` (Detalle), `tile-description` (Descripción), `tile-month-weight` (ring Peso en el mes).
`GlobalTransactionDetail` queda como orquestador: resuelve tipo→tone y arma la lista de tiles por kind.

El valor exacto de panel.css (px) se porta con clases arbitrarias de Tailwind (`rounded-[20px]`, `p-[24px]`, etc.) o estilos inline cuando es más legible, igual que ya hace `TxHero`.

### D4 — "Peso en el mes": cálculo client-side sobre breakdown existente
`page.tsx` llama `getMonthCategoryBreakdown(supabase, month)` (gasto) o `getMonthIncomeBreakdown` (ingreso) para el mes del movimiento. El tile recibe el array de slices y la categoría del movimiento, y computa: `pct = valorCategoría / totalMes`, y el `rank` ordenando los slices desc. El anillo (`conic-gradient`) y el copy ("2.ª categoría del mes…") salen de ahí. Para ingreso, `pct = montoMovimiento / totalIngresosMes`. Movimientos sin categoría o estructurales **no** muestran este tile.

### D5 — Recurrencia: derivar del `getRecurrenceDetail`
Cuando `recurrenceLink` existe, `page.tsx` trae `getRecurrenceDetail(recurrence_id)`. El tile deriva: próximo cobro = `pending_instance.scheduled_date`; activa desde = `start_date`; nº de cobros = instancias confirmadas; acumulado = suma de instancias no-skipped; historial = últimas 6 instancias por mes (amount). Si falta la regla, no se muestra el tile (el movimiento se ve como gasto simple).

### D6 — Compartido sin estado por persona (TODO marcado)
`tile-shared-split` usa `getMovementSharedInfo` (`ownShare` + `bySplit[{name, amount}]`). Muestra "Te toca pagar = ownShare", "Dividido entre" con cada persona y su monto, y la propia ("Vos"). **No** renderiza badges Te debe/Saldado. Se deja un comentario `// TODO: per-person settlement state — el modelo no lo guarda por transacción` para cuando exista el dato.

### D7 — Medio de pago: nombre + tipo, nunca número
El chip y el tile "Pagado con" usan `account.name` + etiqueta del `account.type` (`cash`→"Efectivo"/billetera, `bank`→"Débito"/caja de ahorro, `credit`→"Tarjeta de crédito"). Para cuotas/crédito se muestra "Tarjeta de crédito"; nunca dígitos. El badge usa el color de cuenta/medio según los tokens existentes.

### D8 — i18n
Los nuevos rótulos ("Pagado con", "En cuotas", "Te toca pagar", "Dividido entre", "Resultado neto", "Pagado", "restan", "Próxima", "termina en", "Recurrencia", "Próximo cobro", "Activa desde", "Historial de cobros", "Acreditado en", "Movimiento de dinero", callout de transferencia, "Peso en el mes", copy del ring, estados Reintegrado/Completada/Acreditado) se agregan a los mensajes `transactions` (es) reusando claves existentes donde ya existan (`detail.labels.*`, `reimbursement.*`, etc.).

## Risks / Trade-offs

- [Tokens del handoff sin equivalente 1:1 en `ui-tokens`] → mapear al token más cercano ya definido; si realmente falta, agregarlo a `@grana/ui-tokens` (no inline hex sueltos), documentándolo.
- [El cálculo de peso del mes agrega un fetch por detalle] → es la misma query que ya usa el dashboard (cacheada/barata); solo se dispara en gasto/ingreso categorizado.
- [Regresión visual en otros kinds no cubiertos por los 7 tipos (exchange, adjustment, settlement, card_payment)] → estos reusan el camino "genérico": hero tonal + tiles Pagado con / Detalle / Descripción, sin tiles especiales. Verificar que no rompan.
- [El `TxActionsMenu` cambia de ubicación] → mantener su lógica intacta y solo recomponer el layout; correr el flujo de eliminar (incluido card payment y parent) para evitar regresión de copy/confirm.
- [Mobile barra inferior fija puede tapar contenido] → padding inferior en el contenedor (como `panel.css` `.page { padding-bottom: 96px }`).
- [Compartido sin badges puede leerse incompleto vs el mockup] → decisión de producto ya tomada (mostrar montos, TODO estado); el copy evita prometer estado.
