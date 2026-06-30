## Context

`@grana/cards` ya es **isomórfico**: sus únicos imports runtime son `@grana/money-logic` y `@grana/validation` (puros); `@grana/supabase` y `@grana/transactions-mutations` entran sólo como `import type`. El cliente se inyecta por parámetro. Por eso correr lógica de cards en el package es seguro en web y en Hermes; el read slice (`getCreditCards` parametrizado por `GranaSupabaseClient`) ya se ejecuta en ambas plataformas.

La lógica view-model del listado, sin embargo, sigue hand-synced: `apps/web/lib/cards/grouping.ts` (167 líneas) y `apps/mobile/lib/cards/grouping.ts` difieren sólo en la dirección del comentario "Mirror of…". `apps/web/app/(app)/cards/_components/card-presentation.ts` (99 líneas) es web-only pero 100% puro. La unión de tono `'due' | 'soon' | 'ok'` está duplicada: `CardTone` en `grouping.ts` y `CardPillTone` en `card-status-pill.tsx`.

Esta Slice es el primer movimiento de la extracción de cards y el que asienta la política (corrección de `AGENTS.md` + delta de `project-conventions`), de modo que las Slices 2 (reads de detalle + `buildCardDetailViewModel`) y 3 (mutaciones) la citen.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad para la lógica view-model pura del listado de tarjetas (grouping + presentación) en `@grana/cards`.
- Borrar el mirror `apps/mobile/lib/cards/grouping.ts` y los comentarios "keep in sync".
- Consolidar la unión de tono en un solo tipo (`CardTone`) en el package.
- Refactor behavior-preserving: web y mobile renderizan idéntico.
- Asentar la política: corregir `AGENTS.md` y codificar en `project-conventions` que la lógica view-model pura vive en el package de dominio.

**Non-Goals:**
- Extraer reads de detalle ni `buildCardDetailViewModel` (Slice 2).
- Extraer mutaciones de tarjeta (Slice 3).
- Extraer `card-movement-mapper.ts`: depende de `FinancialMovement`, web-only en transactions; queda bloqueado hasta la extracción del view-model de movements (change futuro, fuera de cards).
- Cambiar el comportamiento, los nombres públicos o la firma de cualquier función movida.

## Decisions

### D1 — Mover los módulos completos, no fragmentos
`grouping.ts` se mueve entero. `card-presentation.ts` se mueve **entero** —incluido `resolveEditCycle`, que es detail/edit-only pero es puro y sólo depende de una forma estructural de período (no de las funciones de read de la Slice 2)— para no dejar el archivo partido a la mitad. Alternativa descartada: mover sólo los 4 helpers de listado y dejar `resolveEditCycle` para la Slice 2 → partiría un archivo puro sin beneficio y agregaría churn.

### D2 — Ubicación dentro de `@grana/cards`: módulos puros nombrados, re-exportados desde `index.ts`
`packages/cards/src/grouping.ts` y `packages/cards/src/presentation.ts`, re-exportados desde `index.ts`. Se evalúa un subpath `@grana/cards/logic` para que mobile importe lógica pura sin arrastrar el módulo de queries; se descarta porque el package ya es isomórfico (no hay código server-only que aislar) y el repo no usa subpath exports hoy (todos los packages exponen sólo `.`). Mantener un único entrypoint es consistente con `@grana/accounts`/`@grana/transactions`.

### D3 — Consolidar `CardTone` = `CardPillTone`
La unión `'due' | 'soon' | 'ok'` pasa a `@grana/cards` como `CardTone` (junto a `grouping`). `card-status-pill.tsx` (UI web) importa `CardTone` del package y lo usa como su prop de tono (puede re-aliasarlo localmente a `CardPillTone` si conviene a la legibilidad, sin redefinir la unión). Así desaparece la segunda definición.

### D4 — Web: borrar los archivos, no dejar shims
`apps/web/lib/cards/grouping.ts` y `_components/card-presentation.ts` se borran; los ~13 consumidores reapuntan sus imports a `@grana/cards`. Alternativa considerada: dejar thin re-exports para no tocar imports. Se descarta: el repo prefiere imports directos al package (precedente `lib/cards/utils.ts` quedó como re-export sólo por ser un caso de muchos imports dispersos; acá el churn es acotado y rastreable). Si en la implementación el volumen de imports resultara molesto, se permite el re-export como fallback — decisión menor, no altera comportamiento.

### D5 — Mobile: borrar el mirror y reapuntar
`apps/mobile/lib/cards/grouping.ts` se borra. `Wallet.tsx` y `lib/cards/queries.ts` importan grouping/tono de `@grana/cards`. Mobile no tiene `card-presentation.ts` propio (su accent sale de `AccountAvatar`/`resolveAccountAvatar`); no hay otro mirror que borrar en esta Slice.

### D6 — Tests al package
`lib/cards/__tests__/grouping.test.ts` y `month-summary.test.ts` se mueven a `packages/cards/src/__tests__/` (vitest ya configurado). Son la red de seguridad del refactor: si la lógica movida cambia de comportamiento, el test rompe.

### D8 — `month-summary.ts` entra en esta Slice (misma categoría que grouping)
`summarizeCardsMonth` es agregación pura del hero del mes: toma `CreditCardSummary[]` + `todayStr`, sin I/O, sólo `sumMoneyValues`. Es la misma categoría "view-model puro de superficie de listado" que grouping/presentation, y está hand-synced (mobile la mirrorea inline en `lib/cards/queries.ts`). Por eso entra en Slice 1 y no en la Slice 2 de reads: NO consume tipos de read de detalle. El wrapper `getCardsMonthSummary` (read: `getCreditCards` + `summarizeCardsMonth`) queda por app —es glue de read— e importa la función pura del package; mobile borra su mirror inline. Alternativa descartada: dejar month-summary para Slice 2 → mezclaría lógica pura con la extracción de reads y dejaría un mirror vivo más tiempo del necesario.

### D7 — `resolveAccountAvatar` como dependencia explícita
`cardAccent` consume `resolveAccountAvatar` de `@grana/ui-contracts`. Si `@grana/ui-contracts` no figura en `dependencies` de `packages/cards/package.json`, se agrega. Es un import de función pura (no JSX), seguro en Hermes.

## Risks / Trade-offs

- **Churn de imports en ~13 componentes web + `card-status-pill.tsx`** → Mitigación: cambio mecánico path-only; typecheck + lint atrapan cualquier import colgado; sin cambio de símbolos ni firmas. Fallback D4 (re-export) si molesta.
- **Drift de comportamiento al mover lógica** → Mitigación: el test de grouping viaja con el código; correr vitest del package + typecheck de ambas apps. Smoke visual del listado/wallet en web y mobile (agrupamiento por banco, orden, tono, filtros).
- **`card-status-pill.tsx` ahora depende de `@grana/cards`** → es una dependencia de tipo trivial (la unión de tono), sin runtime; aceptable.
- **La corrección de `AGENTS.md` toca prosa viva muy citada** → Mitigación: el reemplazo es 1 línea, alineado con `web-data-access` ya codificado; el delta de `project-conventions` deja el racional auditable.

## Migration Plan

Sin migración de datos. Orden seguro: (1) crear `packages/cards/src/{grouping,presentation}.ts` + tests + exports en `index.ts`; (2) rewire web (borrar archivos, reapuntar imports, consolidar `CardTone`) y verificar typecheck/lint/tests web; (3) rewire mobile (borrar mirror, reapuntar `Wallet`/`queries`) y verificar typecheck/lint mobile; (4) corregir `AGENTS.md`. Rollback = revertir el commit; no hay estado persistido.

## Open Questions

- ¿Algún consumidor mobile además de `Wallet.tsx`/`queries.ts` referencia `grouping`? La auditoría no encontró otro, pero se confirma con un grep en la implementación antes de borrar el mirror.
- ¿`resolveEditCycle` se queda en `presentation.ts` o se prefiere un módulo `detail-presentation.ts`? Se asume `presentation.ts` (un solo archivo de presentación); si la Slice 2 crece el detalle, se puede resplitear sin costo.
