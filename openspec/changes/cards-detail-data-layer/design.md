## Context

`apps/web/app/(app)/cards/[id]/page.tsx` es un Server Component que (1) hace `Promise.all` de los reads de detalle —`getCreditCardDetail`, `getCardPeriods`, `getActiveInstallments`, `getCardNetworks` (+ `getInstitutions`, `getShowCents`, `getTranslations`)— y (2) deriva inline el view-model: helpers locales `daysBetweenISO` e `installmentsARSOf`, resolución del ciclo `apagar`/`curso`/`prox` (vía `classifyPeriodsLifecycle` de `@grana/money-logic` + lookup por id en `periodsDesc`), `cursoCycle*`, `apagarDaysToDue`, `committedARS`, `hasUSD`, las dos ramas de empty-state (`new-card`, `archived-empty`) y el `CardDetailViewModel` final. Los reads viven sólo en `apps/web/lib/cards/queries.ts` (tipados `DbClient`); los tipos del VM en `_components/card-detail-types.ts`.

`@grana/cards` ya es isomórfico y ya hospeda el slice cross-dominio (`getCreditCards`, `getCreditCardDebtCheck`) parametrizado por cliente. Slice 1 ya movió la presentación pura (`cardAccent`, `pillTone`, `resolveEditCycle`) al package. Esta Slice extiende el read slice al detalle y saca la derivación del view-model del Server Component.

## Goals / Non-Goals

**Goals:**
- Los 6 reads de detalle en `@grana/cards`, client-agnósticos (`supabase` 1er parámetro, `today` inyectado), reutilizables desde mobile.
- Un builder puro `resolveCardDetailState(...)` en `@grana/cards` que produce el estado de la pantalla (empty-states + `CardDetailViewModel`) sin I/O.
- `page.tsx` adelgazado a fetch + `resolveCardDetailState` + render; cero derivación de negocio inline.
- Tipos de detalle y de VM con un solo hogar (`@grana/cards`).
- Behavior-preserving: `/cards/[id]` y sus rutas anidadas renderizan idéntico.

**Non-Goals:**
- Construir la ruta `/cards/[id]` nativa (change follow-up; esta Slice deja la capa de datos lista).
- Mutaciones de tarjeta (Slice 3).
- El pane de movimientos del resumen (`period-movements-pane`, `card-movement-mapper.ts`): proyecta a `FinancialMovement`, web-only en transactions; bloqueado hasta extraer el view-model de movements.
- Tocar `getCardPeriodsWithStatus` / `getOrCreatePeriodForDate`: ya delegan a `@grana/transactions-mutations`; quedan como wrappers thin.

## Decisions

### D1 — `resolveCardDetailState` como discriminated union, no sólo el VM
El builder devuelve `{ kind: 'new-card' } | { kind: 'archived-empty' } | { kind: 'active'; vm: CardDetailViewModel }` más los campos compartidos por todas las ramas que hoy `page.tsx` calcula antes del branching (`cardHasHistory`, `institutionName`, `accent`, `editCycle`/`networkLabel` data, `committedARS`). Razón: las tres ramas de render existen en web hoy y mobile las necesitará igual; codificar la **decisión** de cuál renderizar como dato puro evita que cada plataforma reimplemente el árbol de `if`. Alternativa descartada: extraer sólo el `CardDetailViewModel` del caso activo → dejaría la lógica de empty-state duplicada entre web y mobile.

### D2 — Reads en el package, `today` inyectado (patrón read slice)
Igual que `getCreditCards`: cada read recibe `supabase: GranaSupabaseClient` y, donde hoy llama `getTodayAR()`, recibe `today: Date`/`todayISO` del caller. Web mantiene en `lib/cards/queries.ts` wrappers thin que inyectan `getTodayAR()` y conservan la firma pública + query keys. `@grana/cards` no importa `next/*`, no crea client, no revalida.

### D3 — Tipos de detalle y de VM se co-localizan en `@grana/cards`, NO en `@grana/ui-contracts`
`CardPeriodDetail`, `CreditCardDetail`, `ActiveInstallment`, `CardNetwork`, `CardDetailViewModel`, `PeriodKey`, `LifecyclePeriod` van a `@grana/cards`. `ui-contracts` es estrictamente contratos de **props** de primitivos UI; el `CardDetailViewModel` es una forma de **datos** acoplada al resultado de los reads (depende de `CardPeriodDetail`/`ActiveInstallment`), por eso vive con su productor. La JSX de detalle (web `CardDetailView`, mobile equivalente) seguirá importando `CardDetailViewModel` del package — paridad por tipo compartido, sin compartir JSX.

### D4 — Organización de archivos en el package
`packages/cards/src/detail-queries.ts` (los 6 reads + tipos de retorno) y `packages/cards/src/detail-vm.ts` (`resolveCardDetailState` + tipos de VM), re-exportados desde `index.ts`. Mantener queries y VM en módulos separados deja claro qué hace I/O (queries) y qué es puro (vm), y permite testear el VM sin DB. Se evalúa fusionar en `queries.ts`; se prefiere separar por la frontera I/O/puro.

### D5 — Mobile: retirar el mirror de detalle ahora, consumer después
`apps/mobile/lib/cards/queries.ts` deja de declarar shapes de detalle a mano y de cargar el comentario "MUST stay in sync"; pasa a importar tipos + reads de `@grana/cards`. La pantalla `/cards/[id]` nativa es el change follow-up: esta Slice sólo garantiza que la capa de datos esté lista y sin mirror. Si algún read de detalle aún no tiene consumer mobile, igual se extrae (lo consume el follow-up); no se introduce dead code porque web lo usa hoy.

## Risks / Trade-offs

- **`page.tsx` es el corazón de la ruta; un error de extracción rompe el detalle** → Mitigación: el VM builder viaja con tests (los tres `kind` + los derivados de ciclo); typecheck + lint + smoke visual de `/cards/[id]` en sus tres estados (tarjeta nueva sin historial, archivada sin pendientes, activa con apagar/curso/prox).
- **Shapes de read grandes (`CardPeriodDetail` embebe transactions) movidos al package** → Mitigación: mover el tipo entero tal cual; `CardPeriodWithPayment` base ya vive en `@grana/transactions-mutations`, sólo el enriquecimiento (`variant`/`alert`/`pendingAmount*`/`transactions`) se co-localiza en `@grana/cards`.
- **Inyección de `today` cambia call sites internos** → Mitigación: los wrappers web conservan la firma sin `today`; el cambio es interno al package, verificado por typecheck.
- **Riesgo de arrastrar algo server-only al package** → Mitigación: regla del read slice — el package no importa `next/*` ni `server-only`; un import accidental rompe el build de mobile (Hermes) y se detecta en typecheck.

## Migration Plan

Sin migración de datos. Orden seguro: (1) mover tipos de detalle + los 6 reads a `@grana/cards` con `today` inyectado; (2) escribir `resolveCardDetailState` + tipos de VM en el package con tests; (3) rewire web — wrappers thin en `lib/cards/queries.ts`, `page.tsx` adelgazado a fetch + `resolveCardDetailState` + render, borrar `card-detail-types.ts`; verificar typecheck/lint/tests + smoke de los tres estados; (4) retirar el mirror de detalle de `apps/mobile/lib/cards/queries.ts`. Rollback = revertir el commit.

## Open Questions

- ¿`resolveCardDetailState` también resuelve `editCardData` (que mezcla `accent`, `networkLabel`, `resolveEditCycle`, `institutions`) o eso queda en el caller web por acoplar `institutions` (read de accounts) y el provider del drawer? Propuesta: el builder devuelve los datos puros del ciclo (`resolveEditCycle` ya está en el package); el ensamblado de `editCardData` con `institutions` y el `EditCardDrawerProvider` queda en web (es orquestación de UI). Se confirma al implementar.
- ¿`getShowCents`/`getInstitutions`/`getTranslations` se mantienen como reads del caller? Sí: `getInstitutions` es de `@grana/accounts` (ya compartido), `getShowCents`/`getTranslations` son glue de plataforma (preferencias/i18n) — no entran al builder.
