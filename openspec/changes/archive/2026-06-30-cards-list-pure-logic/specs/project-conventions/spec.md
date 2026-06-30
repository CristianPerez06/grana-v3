## ADDED Requirements

### Requirement: La lógica isomórfica vive en el package de dominio; sólo el glue acoplado a plataforma queda por app

La regla de no-duplicación de lógica pura entre apps SHALL aplicar a **toda lógica isomórfica cross-platform**, no sólo al cálculo financiero de `@grana/money-logic`. En particular, la lógica **view-model pura** de un dominio —agrupamiento, ordenamiento, urgencia/tono, porcentajes de uso, filtros, presentación y mappers de fila, sin React ni Supabase— SHALL vivir en el package de dominio correspondiente (`@grana/cards`, `@grana/accounts`, `@grana/transactions`, …) y SHALL ser consumida por ambas apps desde el nombre del package. NINGUNA app SHALL mantener una copia hand-synced de esa lógica en su propio `lib/` (el patrón "Mirror of … keep the two in sync" queda prohibido).

La frontera `apps/`↔`packages/` SHALL decidirse por **acoplamiento a plataforma**, no por la naturaleza Supabase de una query. Específicamente:

- Queda en `apps/<name>/` el glue acoplado a plataforma: `next/cache` (`revalidatePath`), `server-only` y la construcción del cliente Supabase de la app, la JSX y el ensamblado de datos del Server Component, la orquestación de contextos de UI, y los shells `'use server'` que traducen errores neutrales (web → `next-intl`, mobile → `useT`).
- Va a `@grana/<domain>` la lógica isomórfica: funciones puras, tipos de dominio, y los **reads parametrizados por el cliente** (`supabase: GranaSupabaseClient` inyectado, sin construir el cliente ni importar `server-only`/`next/*`), siguiendo el patrón de read slice ya codificado en `web-data-access`.

`AGENTS.md` SHALL describir esta frontera de forma consistente con `web-data-access` y NO SHALL afirmar que "las queries Supabase quedan en el `lib/` de cada app" — esa frase queda obsoleta porque los reads se extraen como slices parametrizados por cliente en `@grana/<domain>`.

#### Scenario: Lógica view-model pura mirroreada entre apps se consolida en el package de dominio

- **WHEN** un colaborador encuentra un módulo de lógica view-model pura (p. ej. `grouping.ts`: agrupamiento por banco, tono de urgencia, filtros) copiado en `apps/web/lib/<domain>/` y `apps/mobile/lib/<domain>/` con un comentario "Mirror of … keep in sync"
- **THEN** el módulo se mueve a `@grana/<domain>` como módulo puro único
- **AND** ambas apps lo importan desde el nombre del package
- **AND** la copia mobile se borra junto con los comentarios "keep in sync"

#### Scenario: La frontera se decide por acoplamiento a plataforma, no por "es una query Supabase"

- **WHEN** un colaborador evalúa si un read de dominio va a `apps/<name>/lib/` o a `@grana/<domain>`
- **THEN** el criterio NO es "toca Supabase" sino "está acoplado a plataforma"
- **AND** si el read puede recibir el cliente por parámetro (`supabase: GranaSupabaseClient`) sin importar `server-only`/`next/*` ni construir el cliente, vive en `@grana/<domain>` como read slice
- **AND** sólo el glue acoplado a plataforma (revalidación, construcción del cliente, JSX, shells `'use server'`) queda en la app

#### Scenario: AGENTS.md describe la frontera de forma consistente con web-data-access

- **WHEN** un colaborador lee la sección de frontera `apps/`↔`packages/` en `AGENTS.md`
- **THEN** la prosa NO afirma que las queries Supabase quedan en el `lib/` de cada app
- **AND** describe que la lógica isomórfica —funciones puras Y reads inyectados por cliente— vive en `@grana/<domain>`, y que sólo el glue acoplado a plataforma queda por app
- **AND** la descripción es consistente con los requirements de read slice de `web-data-access`
