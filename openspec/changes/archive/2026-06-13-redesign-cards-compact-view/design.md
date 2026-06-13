## Context

El listado `/cards` se diseñó alrededor de un wallet de cards grandes (grilla `md+` / carrusel `< md` en web; carrusel en mobile), con un requirement de no-goals muy estricto: sin filtros, sin ordenamiento, sin datos ni queries nuevas. En producción, con muchas tarjetas de distintos bancos, ese formato no escala: el usuario no puede comparar cierre/vencimiento/saldo/uso de un vistazo y vive scrolleando.

El read-path ya expone casi todo lo necesario: `getCreditCards()` devuelve `CreditCardSummary[]` con `activePeriod` (montos pendientes ARS/USD, `tx_count`, alert/variant), `activeInstallmentsCount`, `credit_limit`, `currencies`, `institution {brand_color, icon_type}` e `institution_id`. `getCardsMonthSummary()` ya agrega "a pagar", `nextDue` y la lista `upcoming`. Falta: el **nombre del banco** (para agrupar/labelar), un flag **`inUse`** por tarjeta, un **`nextClose`** (próximo cierre, single) para el hero navy, y en mobile la **resolución de `networkNames`**.

Restricciones de producto invariables: ARS y USD no se suman ni convierten (Bimoneda); las tarjetas de crédito son off-ledger; no ocultar negativos ni clamped; paridad **semántica** web/mobile con JSX nativo por plataforma (nunca JSX compartido entre `apps/web` y `apps/mobile`); valores visuales desde tokens/primitivos, no hex literales.

## Goals / Non-Goals

**Goals:**
- Reemplazar el wallet de cards por una vista compacta agrupada por banco y **desplegable**.
- Default **"Por banco"** con grupos colapsables; auto-colapsar bancos 100% al día y en $0. Toggle "Todas" (plano) + filtros (`En uso`, `Vencen pronto`, `Con saldo`).
- **2 filas por tarjeta**: fila 1 identidad + resumen + estado; fila 2 cierre · vence + barra de uso.
- Estado por fila siempre visible; bimoneda apilada; barra de uso honesta con `—` sin límite.
- **Hero como card navy** (mismo patrón que el dashboard): A pagar ARS+USD + un único "Próximo cierre" (fecha de cierre, vía `nextClose`).
- Extender el read-path con lo mínimo (`institution.name`, `inUse`, `networkNames` en mobile) sin migraciones.

**Non-Goals:**
- Agregar KPIs/chips separados al hero (sigue siendo una sola card; el rediseño es de estilo navy + un único próximo cierre, no una grilla de métricas).
- Persistir el estado de colapso de grupos entre sesiones (v1 deriva el estado inicial por la regla de auto-colapso; el toggle es runtime).
- "Uso de límite real" sumando cuotas futuras de todos los períodos (v1 mantiene el % del resumen vigente, rotulado honesto).
- Rail lateral de bancos.
- Tocar el detalle de tarjeta, el alta, el pago, o el modelo de períodos.
- Paridad funcional 1:1 mobile↔web más allá de la fila compacta.

## Decisions

### D1 — Una sola vista compacta, no un modo alternativo
Reemplazamos las cards; no convivimos con un "modo cards grande". Mantener dos vistas duplica el costo de paridad web/mobile (que ya tiene gap conocido) sin pagar valor. "Por banco / Todas / En uso / Vencen pronto / Con saldo" son filtros/orden **dentro** de la única vista, no un segundo layout.

### D2 — Default "Por banco" con grupos desplegables
El default es agrupado por banco, con encabezado por grupo (nombre, "N tarjetas · M en uso", total a pagar del banco, badge de urgencia) y cuerpo colapsable. "Todas" (plano) queda como toggle. El modelo mental "por banco" es el que pidió el usuario y reduce el scroll con muchas tarjetas.
*Alternativa descartada:* default plano por vencimiento. Útil para "qué pago primero", pero ese trabajo lo hace el hero (próximo cierre) + el orden por urgencia de los grupos; agrupar por banco escala mejor el listado.

### D3 — Auto-colapso inteligente de grupos
Al entrar, un grupo arranca **colapsado solo si todas sus tarjetas están al día y en $0** (sin deuda, sin saldo, sin vencimiento próximo). Cualquier grupo con una tarjeta vencida / por vencer / con saldo arranca **expandido**. Esto reduce el ruido sin esconder lo accionable. El usuario puede expandir/colapsar manualmente (estado runtime, no persistido en v1).
*Alternativa descartada:* todos expandidos (reproduce el scroll que motivó el change) o todos colapsados (esconde deuda detrás de un tap).

### D4 — Estado por fila siempre visible
Cada fila lleva un indicador de estado (pill en web; dot a la derecha en mobile) derivado de `pillTone(activePeriod.alert, activePeriod.variant)` — el mismo helper que hoy usa `WalletCard`. Sin esto, el `Resumen` es ambiguo (¿abierto acumulando o cerrado a pagar?). El badge de urgencia del encabezado de grupo hereda el peor estado del grupo (rojo > ámbar > neutro), de modo que un grupo con deuda se delata incluso colapsado (y además no se auto-colapsa).

### D5 — 2 filas por tarjeta, con barra de uso en la fila 2
Una sola fila no alcanza para identidad + fechas + resumen + uso + estado sin apretar, sobre todo en mobile. Se usan dos filas: fila 1 = monograma de red + nombre + red | resumen | estado; fila 2 = "cierra DD/MM · vence DD/MM" + **barra de uso** del resumen vigente. La barra reemplaza el `%` en texto por una señal visual; cuando no hay límite, la fila 2 muestra "uso —" sin barra.

### D6 — Bimoneda apilada en el monto del resumen
Si la tarjeta tiene una sola moneda con saldo → ese monto. Si tiene ambas → ARS arriba (primario, `text-income`/`text-expense` editorial, no tokens crudos que en web salen negros) + USD debajo en `text-text-muted`. Nunca se suman ni convierten.

### D7 — Barra de uso honesta, no "disponible"
La barra/`%` se calcula como hoy: `min(100, round(pendingARS_del_resumen_activo / credit_limit * 100))`. Es el consumo del **resumen vigente**, no el cupo real (ignora cuotas futuras y USD). Por eso v1 lo rotula como uso del resumen (no "disponible") y muestra `—` cuando `credit_limit` es null. El cálculo "real" con outstanding de todos los períodos queda para v1.1.

### D8 — `inUse` por tarjeta para contadores de grupo y filtro
`inUse = activePeriod.tx_count > 0 || activeInstallmentsCount > 0`. Ambos datos ya existen en `CreditCardSummary` sin nueva query. Alimenta el contador "M en uso" del encabezado de grupo y el filtro `En uso`. Se persiste como `inUse: boolean` en el tipo para que web y mobile no diverjan. No se agregan contadores globales a `CardsMonthSummary` (no hay KPI global "En uso" en el hero navy).

### D9 — Agrupar por banco requiere `institution.name`
Hoy el embed es `institution:institutions(brand_color, icon_type)` — sin `name`. Agregamos `name` al embed y lo exponemos en `CreditCardSummary`. Las tarjetas con `institution_id` null caen en un grupo fallback **"Sin banco"**, siempre último, nunca mezclado. El color del dot de grupo usa `institution.brand_color`; el monograma de la fila usa el acento por-tarjeta (`cardAccent`) con la inicial de la red.

### D10 — Agrupación/orden/colapso client-side, en un helper puro
Agrupar por banco, ordenar grupos y filas por vencimiento, derivar "M en uso" y la regla de auto-colapso son funciones puras sobre el array de `CreditCardSummary` ya cargado. Viven en `lib/cards/` (lógica compartible, no JSX) para que web y mobile deriven idéntico. La única extensión de query es el `name` del embed (D9).

## Risks / Trade-offs

- **Deuda escondida en un grupo colapsado** → Mitigado por D3 (los grupos con deuda no se auto-colapsan), D4 (badge de urgencia en el encabezado, visible aun colapsado) y el hero navy (A pagar + próximo cierre surfacean lo urgente sin importar el agrupado).
- **Barra/uso malinterpretado como cupo disponible** → Mitigado por el rótulo de "uso del resumen" (D7) y `—` sin límite; el cálculo real queda como no-goal de v1.
- **Romper los no-goals del requirement de estilo visual vigente** → Intencional y previsto por el propio spec (regla de cierre: abrir change nuevo y modificar el requirement). El delta modifica ambos requirements afectados.
- **Filas bimoneda / 2-líneas rompen la altura uniforme** → Aceptado: la fila de 2 líneas es la base; bimoneda agrega una línea de monto en la celda. Comunica información real.
- **Divergencia de cálculo web/mobile** (`inUse`, grupos, orden, auto-colapso) → Mitigado persistiendo `inUse` en el read-path (D8) y centralizando el helper puro en `lib/cards/` (D10).

## Migration Plan

1. Extender read-path primero: `institution.name` en el embed + `inUse` derivado en `CreditCardSummary`. Sin migraciones de DB (`institutions.name` ya existe). En mobile, cablear `networkNames`.
2. Helper puro de agrupación/orden/auto-colapso en `lib/cards/`.
3. Implementar web (grupos desplegables + filas de 2 líneas con barra de uso), luego mobile (lista densa equivalente), en árboles paralelos. Hero conservado.
4. Reemplazar `Wallet`/`WalletCard` y `CreditCardItem` por los componentes compactos; eliminar el JSX obsoleto del wallet de cards.
5. Sin feature flag: reemplazo de presentación sobre datos existentes; rollback = revert del change.

## Open Questions

- ¿El grupo "Sin banco" usa un acento slate fijo para el dot, o el `cardAccent` por-tarjeta? (propuesta: slate fijo para el dot de grupo, acento por-tarjeta en la fila).
- ¿El filtro "Con saldo" considera bimoneda (ARS>0 **o** USD>0)? (propuesta: cualquiera de las dos > 0).
- ¿La regla de auto-colapso considera "saldo" en cualquier moneda y "vencimiento próximo" con el mismo umbral del alert ámbar (≤7 días)? (propuesta: sí — un grupo se expande si alguna tarjeta tiene alert ≠ none o saldo > 0 en cualquier moneda).
