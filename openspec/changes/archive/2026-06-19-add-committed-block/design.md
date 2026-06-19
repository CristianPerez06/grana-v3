## Context

El dashboard tiene tres lentes; faltaba COMPROMISO. Tras la fase #1.5 (reconciliación CAJA), "Balance del mes" (caja) y "En qué se fue" (consumo devengado) dan distinto a propósito, y el QA mostró que el usuario necesita que se le explique el gap (= consumo de tarjeta del mes). Este change agrega la card "Lo que se viene" (COMPROMISO) y el mensaje 💳 que cierra esa explicación.

Capas existentes que se reusan:
- `projectUpcomingOccurrences` (`@grana/money-logic` recurrences.ts) proyecta ocurrencias de reglas activas en una ventana, sin tocar la DB.
- La lógica de pendientes por resumen (`apps/web/lib/cards/queries.ts`): `pendingAmountARS/USD` por período = consumos `pending` − reintegros recibidos imputados. Hoy `getCardsMonthSummary` solo suma los resúmenes **cerrados** ("a pagar"); para la deuda total hay que sumar también el resumen **en curso**.
- El grid de dos columnas de la fila del Hero (`hero-section-container.tsx`: `lg:grid-cols-[1.15fr_1fr]`) — mismo patrón para la fila `Balance del mes | Lo que se viene`.

Restricción de dominio: ARS y USD nunca se combinan (bimoneda). La card COMPROMISO es estática "desde hoy" (no sigue el navegador de mes).

## Goals / Non-Goals

**Goals:**
- Card "Lo que se viene": deuda de tarjeta total + gastos recurrentes próx mes + ingreso recurrente de contexto, bimoneda, estática.
- Mensaje 💳 al pie de Balance del mes que conecta total devengado = caja + financiado en tarjeta, solo si hubo consumo de tarjeta.
- Reusar diseño (Card/FlowRow/skeleton/eye-mask) y el grid de dos columnas; sin rediseño ni flecha cruzada.

**Non-Goals:**
- Ajustar el Hero "para gastar hoy" por compromisos (es #3, después).
- Tarjeta como cuenta de pasivo full (#4).
- Paridad mobile (diferida).
- Proyectar "cuotas futuras" como línea aparte (entran a la deuda cuando su resumen madura).

## Decisions

### 1. El número "financiado en tarjeta" se deriva, no se recomputa

`financiado = total_devengado − gasto_de_caja`, donde `total_devengado` = total ARS de `getMonthCategoryBreakdown` (el mismo de "En qué se fue") y `gasto_de_caja` = `totalExpense` de `getMonthBalanceSeries`. Así `total = caja + financiado` cierra **por construcción** y el mensaje nunca contradice a "En qué se fue".

Implementación: `MonthBalanceSection` (client) ya vive en el dashboard junto a `SpendingSection`, que fetchea `getMonthCategoryBreakdown` con un queryKey por mes. `MonthBalanceSection` SHALL hacer el **mismo** `useQuery` (mismo queryKey) — TanStack **dedupea**, sin fetch extra — y sumar el total devengado de la moneda activa para el mensaje. El mensaje aparece solo si `financiado > 0`.

_Alternativa descartada_: agregar un total de "consumo de tarjeta" a `getMonthBalanceSeries`. Definiría el número distinto (no necesariamente = devengado − caja por el neteo de reintegros) y rompería el cierre de los tres números.

### 2. Nueva query `getCommittedOutlook` en `@grana/dashboard` (estática)

Una sola función server, sin parámetro de mes (usa `getTodayAR`):
- **Deuda de tarjeta** por moneda: traer los períodos impagos (sin `period_payments`) de las tarjetas activas y sumar su pendiente (consumos `pending` − reintegros recibidos imputados), abarcando **en curso + cerrados + vencidos**. Reusar la matemática de pendiente por período que ya existe (factorizar si hace falta, sin duplicar el neto).
- **Recurrentes próx mes** por moneda y tipo: traer reglas activas, proyectar con `projectUpcomingOccurrences` sobre la ventana `[1er día, último día]` del mes calendario siguiente a hoy, y sumar `amount` por `currency_code` y `movement_type` (`expense` → gastosRecurrentes; `income` → ingresosRecurrentes; `transfer` se ignora).

Devuelve `{ ARS: { debt, recurringExpense, recurringIncome }, USD: {...} }`. El **total comprometido** = `debt + recurringExpense` (las salidas), por moneda; el ingreso es contexto.

### 3. La card es estática y server-rendered (no usa el month context)

`CommittedSectionContainer` (server) llama `getCommittedOutlook` y pasa los datos a `CommittedSection` (client, solo para el eye-mask). NO consume `DashboardMonthProvider` → el navegador de mes no la toca. Sigue el patrón del Hero/AccountsCard (server container + client para máscara) y el de skeleton shape-matched.

### 4. Layout: fila de dos columnas reusando el patrón del Hero

En `dashboard-content.tsx`, "Balance del mes" y "Lo que se viene" se envuelven en un grid `lg:grid-cols-[...]` (apiladas en mobile), cada una con su propio `Suspense` + skeleton. Balance del mes pasa de ancho completo a media columna; el contenido (filas + strip USD + mensaje 💳) ya es compacto y entra. Sin flecha entre cards: el mensaje 💳 al pie de Balance del mes hace el trabajo y aguanta el apilado mobile.

## Risks / Trade-offs

- **Balance del mes apretado a media columna** → el mensaje 💳 es compacto y las filas condicionales solo aparecen cuando hay dato; si en QA se ve cargado, se simplifica la tipografía. Mitigación: validar en QA con un mes denso.
- **Doble query del breakdown** → evitado: mismo queryKey que `SpendingSection`, TanStack dedupea. Si el queryKey difiere, habría fetch doble — usar EXACTO el mismo (`['dashboard','category-breakdown',year,month]`).
- **Deuda de tarjeta vs número del puente** → son distintos a propósito (stock total vs consumo del mes); los labels lo dejan claro ("Deuda de tarjeta" vs "financiado en tarjeta este mes").
- **Mobile** → la card nueva no se renderiza en nativo hasta la paridad diferida; no rompe (web-only).

## Open Questions

- Ninguna bloqueante. El factoreo exacto de la "pendiente por período" (si se mueve a `@grana/money-logic` o se reusa desde `apps/web/lib/cards`) se resuelve en implementación.
