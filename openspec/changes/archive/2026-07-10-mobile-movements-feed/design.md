## Contexto

El feed global de `/transactions` en web es un stack de 6 secciones (banner de sugerencia de recurrencia · bloque de recurrencias pendientes · bloque de reintegros pendientes · overview de gasto por categoría · barra de filtros · lista + cargar más). Este change aterriza **sólo la lista navegable por mes** en mobile (A-minimal); el resto son changes posteriores.

El read que la alimenta ya está a un paso del package:

```
apps/web/lib/transactions/ (hoy web-only, pero isomórfico)
  getGlobalMovementsPage(supabase, { limit, offset, filters })
     │  supabase.rpc('get_movements_page', { p_filters, p_limit, p_offset })   ← 1 round-trip
     │     (filtros + isHistoryRow + self-join de linked-expense + limit+1 lookahead: server-side)
     ├──▶ resolveMonthRange(filters.month)          ← filters.ts (re-export de @grana/dashboard)
     └──▶ rows.slice(0,limit).map(toFinancialMovement)   ← movements.ts (PURO)
```

`queries.ts` **no importa `next/*` ni `server-only`** y recibe `DbClient` como primer parámetro — igual que el slice account-scoped que ya se extrajo. La extracción es el mismo movimiento mecánico ya probado dos veces (`transactions-read-slice`, `cards-mobile-movements-pane`).

## Decisiones

### 1. Qué se mueve al package y qué se queda

**Se mueve** (lo que el feed A-minimal necesita, todo puro o isomórfico):

| Símbolo | Origen | Naturaleza |
|---|---|---|
| `toFinancialMovement` | `movements.ts` | puro (`TransactionWithDetails` → `FinancialMovement`) |
| `toInitialBalanceMovement`, `isInitialBalanceMovement`, `INITIAL_BALANCE_ID_PREFIX` | `movements.ts` | puros; co-locados (mismo dominio de mapper) |
| `MovementFilters`, `DEFAULT/MAX/STEP_MOVEMENTS_LIMIT`, `monthOf`, `shiftMonth`, `movementMatchesText`, re-export `resolveMonthRange` | `filters.ts` | contrato + math puros |
| `getGlobalMovementsPage`, `getGlobalMovements` | `queries.ts` | isomórficos (`supabase.rpc`) |

**Se queda web-only** (aún sin segundo consumer — la barra de filtros y el breakdown son A.2+):

- `getMovementFilterOptions`, `getMonthCategoryBreakdown`, `getMonth{Income,Subcategory}Breakdown`, `hasUsdAccount` — alimentan el overview y el filtro, no la lista.
- `filters-state.ts` (`adaptFiltersForQuery` + la máquina de estado React), `filters-context.tsx` — acoplados a React web; mobile reconcibe su estado.
- `hasAnyTransaction` — se mueve **con** el feed (lo usa el empty-state de la lista: welcome vs. mes-vacío). Es un read trivial (`select id limit 1`), isomórfico → va al package.

**Regla de re-export**: web sigue importando todo desde `@/lib/transactions/{movements,filters,queries}`, que pasan a re-exportar del package. Cero churn en call sites, query keys intactos, `/transactions` idéntico.

### 2. Estado de mes: propio del feed, no compartido con el dashboard

El dashboard mobile ya tiene `DashboardMonthContext` + `MonthNavigator`. El feed de Movimientos necesita **su propio** mes seleccionado — navegar el feed a marzo no debe mover el dashboard, y viceversa. Dos opciones:

```
opción A  ── local useState<month> en la pantalla Movimientos          ← elegida
opción B  ── un MovementsMonthContext (mirror de DashboardMonthContext)
```

Se elige **A (local state)** salvo que el mes tenga que sobrevivir navegación fuera/dentro de la tab. Como la tab es *locked* y siempre montada, el estado local basta; si más adelante A.2 agrega filtros persistentes, se promueve a context entonces (YAGNI hasta el segundo consumidor del estado). El mes inicial = `monthOf(getTodayAR())`.

### 3. `MonthNavigator`: levantarlo a ubicación compartida

`apps/mobile/components/dashboard/MonthNavigator.tsx` ya es presentacional y prop-driven (`month`, `goPrev`, `goNext`). Con el feed pasa a tener **dos** consumers reales → cumple la barra de "extraer sólo con duplicación real en ≥2 usos". Se levanta de `components/dashboard/` a `components/ui/` (o `components/movements/` si se prefiere co-locación por feature — decisión de apply). El dashboard pasa a importarlo de la nueva ubicación; **sin cambio de comportamiento** (mismo componente, mismos props). Es la única pieza de UI que se toca fuera de mobile/transactions.

### 4. Paginación: "cargar más" dentro del mes

`getGlobalMovementsPage` ya devuelve `{ movements, hasMore, nextLimit }` con el patrón limit+1 lookahead. El feed nativo:

- Query keyed por `(month, limit)`; el botón/acción "cargar más" sube `limit` a `nextLimit` (tope `MAX_MOVEMENTS_LIMIT`).
- Alternativa `offset`-based descartada: el RPC ya soporta `limit` creciente y web usa exactamente eso (misma frescura, sin duplicar lógica).
- Cambiar de mes resetea `limit` a `DEFAULT_MOVEMENTS_LIMIT`.

### 5. Empty states

Dos variantes, igual que web (vía `hasAnyTransaction`):

- **sin historial** (usuario nuevo, `hasAnyTransaction === false`): copy de bienvenida.
- **mes vacío** (hay historial, el mes seleccionado no tiene filas): copy "no hay movimientos en este mes".

Los copies salen del catálogo compartido `@grana/i18n-messages` (mismas keys que web; verificar en apply que existan o agregarlas).

### Loading: skeleton, no spinner

Convención del codebase: el dashboard (la superficie más pulida) usa skeleton shells (`SkeletonBlock` + `*Skeleton`), y web `/transactions` usa un `MovementListSkeleton` de filas. Un `ActivityIndicator` no matchea ninguno. El feed nativo usa un `MovementListSkeleton` (twin del web, mismo nombre): `SkeletonBlock` armando la anatomía de `MovementRow` (tile de ícono + 2 líneas + monto) en day-groups, para no joltear al aterrizar la data. El header + `MonthNavigator` quedan siempre visibles (nunca tapados por skeleton — ver regla de header chrome).

### Surface: las filas/skeleton van sobre `bg-card` (surgido en apply)

Los otros dos consumers de movimientos (pane de tarjeta, detalle de cuenta) envuelven las filas en una superficie blanca (`overflow-hidden rounded-2xl border border-border bg-card`). El feed **debe** hacer lo mismo: sin esa superficie, los bloques pálidos del skeleton (`bg-border-soft` ≈ `#EEF1F4`) no tienen contraste y se vuelven invisibles (bug real detectado en apply). El empty-state va **sin** wrapper (MovementList dibuja su propia card punteada; envolverla anidaría card-en-card). Además el root de la pantalla usa `bg-page` (token estructural), no `bg-background` (alias web-only que renderiza transparente en mobile — ver [[project_ui_tokens_shadcn_aliases_web_only]]).

### 6. Generalizar `MovementRow` nativo a los 8 kinds (decisión surgida en apply)

El `MovementRow` nativo (shipeado en `cards-mobile-movements-pane`) se construyó **acotado a 2 kinds** (`expense`/`reimbursement`) porque el pane de tarjeta sólo produce esos. El feed global produce los 8 → hay que generalizarlo (si no, un income/transfer/adjustment sin descripción cae al label "Gasto" y al ícono `Tag`). Es **requisito de corrección**, no opcional.

Se generaliza el **mismo** componente (no un fork) para no divergir, gateando las novedades del feed detrás de props opt-in que **sólo el feed pasa**, dejando el pane de tarjeta idéntico:

- `typeLabelKey` completo (los 8 kinds) + dos familias de íconos (`structureIcon`: transfer/exchange/adjustment/card_payment; `categorizedFallbackIcon`: income/expense/installment/reimbursement) — mirror del web row. El pane sólo golpea expense/reimbursement → sin cambio.
- Primary usa `movement.title` para `adjustment` (fallback), secondary maneja transfer/exchange (`origen → destino` según `counterpartyDirection`) y card_payment (`Pago desde X`). El pane nunca produce esos kinds → sin cambio.
- **Enriquecimientos del feed detrás de props** (default off): `showAccount?` (subtítulo de cuenta — el feed cruza cuentas) y `showFeedBadges?` (badges "Revisar" [review_flags] y "Compartido" [isShared]). El feed pasa ambos `true`; el pane no los pasa → mantiene su look lean actual (que **omitió** esos badges a propósito).
- **Diferido**: el badge "recurrente" (`isRecurrent` en web) necesita datos de recurrencia que el feed A-minimal no lee → fuera de scope.

`MovementList` nativo forwardea `showAccount`/`showFeedBadges` a cada row (default off). Elección del usuario en apply: **correct + feed enrichments** (parity cercano al web, todo derivable de `FinancialMovement` sin reads nuevos).

## Riesgos

- **Bajo.** Relocalización mecánica + pantalla nueva. El read no cambia (mismo RPC, mismos tipos). Web cubierto por 449 tests + typecheck; mobile por typecheck/lint (+ smoke en dispositivo, fuera del entorno).
- **A vigilar en apply**: que mover `filters.ts` no arrastre `filters-state.ts` (importa de `filters.ts`, no al revés — la dirección es segura); que `toFinancialMovement` no dependa de nada web-local además de `TransactionWithDetails` (ya verificado: sólo tipos).

## Alternativas consideradas

- **A-list-only (scroll infinito sin mes)**: descartado — diverge del modelo mental de web y el RPC está construido alrededor de una ventana de mes.
- **A-with-filters (barra de filtros en el mismo change)**: descartado — `filters-state.ts` es una máquina de estado React acoplada a web que necesita reconcepción nativa; infla el change y retrasa cerrar el hueco visible. Va como A.2.
- **Compartir el estado de mes con el dashboard**: descartado — son navegaciones independientes; acoplarlas confunde.
