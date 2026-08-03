# repo-architecture Specification

## Purpose

Define cómo está carveado el repo de Grana V3 y dónde vive cada cosa: la layout del monorepo pnpm con `apps/` y `packages/`, la frontera entre ambos decidida por acoplamiento a plataforma (la lógica isomórfica vive en el package de dominio; sólo el glue acoplado queda por app), y la política web↔mobile de dos implementaciones nativas independientes sostenidas por contratos de props compartidos en lugar de JSX compartido. Responde la pregunta "¿esto va en `packages/` o en `apps/web/lib/`?". No cubre el design system (ver `ui-foundations`) ni las convenciones de trabajo sobre el repo (ver `project-conventions`).
## Requirements
### Requirement: El repo está organizado como monorepo pnpm con apps/ y packages/

El repo SHALL estar organizado como un monorepo manejado por pnpm workspaces, con la siguiente layout:

- `apps/` SHALL contener una carpeta por aplicación desplegable. La app actual es `apps/web/` (Next.js). Apps futuras (p. ej. `apps/mobile/` cuando se haga el scaffold de la app móvil) SHALL agregarse bajo `apps/` siguiendo el mismo patrón. Cada `apps/<name>/` SHALL tener su propio `package.json`, su propio toolchain (Next config, Expo config, etc.), y SHALL ser autónomo a nivel build.
- `packages/` SHALL contener una carpeta por paquete compartido entre apps. Los paquetes actuales son `packages/validation/` (schemas Yup), `packages/i18n-messages/` (catálogos JSON), `packages/supabase/` (cliente factory + tipos de DB), y `packages/ui-tokens/` (tokens de diseño). Cada `packages/<name>/` SHALL tener su propio `package.json` con `name: "@grana/<name>"` y SHALL exportar via `main`/`exports`.
- La raíz del repo SHALL contener: `package.json` (scripts orquestadores + dev tooling compartido), `pnpm-workspace.yaml`, `tsconfig.base.json` si se usa una base compartida, `openspec/`, `supabase/` (backend, no es app), `AGENTS.md`, y los archivos meta (`.gitignore`, `.env.example`, README, etc.).
- Código de producto SHALL NOT vivir en la raíz. Todo `app/`, `components/`, `lib/` y similares SHALL vivir dentro de un `apps/<name>/` o `packages/<name>/`.

La regla de qué va en `apps/` vs `packages/`:

- Va en `apps/<name>/` el código específico de una plataforma o deployment (rutas Next, pantallas Expo, middleware, server actions, components).
- Va en `packages/<name>/` el código que es reutilizable entre apps **y** no tiene dependencias de plataforma. Si un módulo se usa solo en una app, vive en esa app.

#### Scenario: Una feature nueva de web se agrega bajo apps/web

- **WHEN** un colaborador implementa una ruta o componente nuevo solo para la app web
- **THEN** el archivo se crea bajo `apps/web/app/` o `apps/web/components/`
- **AND** no se crea en la raíz ni en `packages/`

#### Scenario: Lógica compartida nueva se agrega como paquete

- **WHEN** un colaborador identifica lógica que va a usarse en web y mobile (p. ej. un nuevo grupo de schemas de validación para una entidad)
- **THEN** se agrega al paquete compartido que corresponda (p. ej. `packages/validation/src/<entity>.ts`)
- **AND** se importa desde ambas apps vía el nombre del paquete (p. ej. `import { ... } from '@grana/validation'`)

#### Scenario: Lógica que se usaba solo en web pero ahora también se necesita en mobile

- **WHEN** un colaborador descubre que un módulo que vivía en `apps/web/lib/` ahora también lo necesita mobile
- **THEN** el módulo se promueve a un paquete bajo `packages/` con un `package.json` propio
- **AND** ambas apps lo consumen vía el nombre del paquete
- **AND** se evita duplicar el código copiándolo a `apps/mobile/lib/`

#### Scenario: Un colaborador intenta agregar código de producto en la raíz

- **WHEN** un colaborador crea un archivo de código de producto directamente en la raíz del repo (p. ej. en una nueva carpeta `lib/` o `components/` raíz)
- **THEN** el archivo viola la convención
- **AND** debe moverse a la app o paquete apropiado

### Requirement: La paridad web↔mobile se sostiene por contratos de props compartidos

Grana SHALL mantener dos implementaciones nativas de cada primitivo de UI: una en `apps/web/components/ui/` y otra en `apps/mobile/components/ui/`. NO se SHALL intentar compartir JSX entre web y React Native; ambas implementaciones permanecen independientes en su árbol de DOM/View nativo.

Las capas de componentes y su ubicación canónica por plataforma son propiedad de `ui-foundations`, no de esta capability. Este requirement gobierna la **política de paridad** entre las dos implementaciones; cuando una ruta aparezca en ambas capabilities, la de `ui-foundations` SHALL prevalecer.

La paridad de API entre ambas SHALL estar garantizada por **tipos de props compartidos** vivos en el package `@grana/ui-contracts`. Cada componente equivalente en web y mobile MUST importar el mismo prop type desde `@grana/ui-contracts` y exponerlo como su prop signature pública. Las implementaciones MAY aceptar props adicionales propias de su plataforma vía intersection con el tipo del contrato, pero NO MAY divergir en los nombres, tipos ni semántica de las props comunes.

Las convenciones de naming adoptadas (las que difieren entre web y RN) SHALL quedar documentadas en `packages/ui-contracts/README.md`. Una convención fijada por esta spec: los callbacks de interacción se llaman `onPress` (no `onClick`) en ambos lados, alineado con la convención de React Native.

Esta política aplica a los primitivos de UI (`Button`, `Card`, `Input`, `Label`, `Alert`, `Spinner`, `FormField`, `PasswordField` y futuros). NO aplica a la lógica de negocio pura: para eso existe `@grana/money-logic`, donde una única implementación SHALL ser consumida por ambas plataformas.

#### Scenario: Web y mobile importan el mismo prop type

- **WHEN** un colaborador define un componente primitivo equivalente en web y mobile (por ejemplo `Button`)
- **THEN** ambos archivos importan `ButtonProps` desde `@grana/ui-contracts`
- **AND** ambos archivos exponen `Button(props: ButtonProps)` como su firma pública

#### Scenario: Una prop nueva en el contrato obliga a mobile a implementarla

- **WHEN** un colaborador agrega una nueva prop obligatoria al tipo `ButtonProps` en `@grana/ui-contracts`
- **THEN** TypeScript marca como error el archivo `apps/mobile/components/ui/Button.tsx` hasta que mobile la implemente
- **AND** la PR NO puede mergearse mientras mobile no cumpla el contrato

#### Scenario: Una implementación necesita una prop específica de su plataforma

- **WHEN** la implementación de mobile necesita una prop extra que no aplica a web (por ejemplo, haptic feedback)
- **THEN** mobile expone su firma como `MobileButtonProps = ButtonProps & { hapticFeedback?: 'light' | 'medium' }`
- **AND** la prop extra NO se agrega al contrato compartido

#### Scenario: Un primitivo mobile nuevo se crea bajo components/ui/

- **WHEN** un colaborador crea un primitivo de UI nuevo en mobile
- **THEN** el archivo vive en `apps/mobile/components/ui/`, junto a los primitivos existentes (`Button.tsx`, `Card.tsx`, `Input.tsx`, …)
- **AND** NO se coloca suelto en `apps/mobile/components/`, que está reservado para carpetas de componentes por feature (`accounts/`, `cards/`, `settings/`, …)

#### Scenario: Lógica financiera no se duplica entre apps

- **WHEN** una función de cálculo financiero puro (balance, derivación de período, generación de fechas de recurrencia) es necesaria en web y mobile
- **THEN** la función vive en `@grana/money-logic` y ambas apps la importan desde ahí
- **AND** ninguna app reimplementa la función en su propio `lib/`

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

