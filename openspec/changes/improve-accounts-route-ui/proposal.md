# Mejorar el estilo visual de la ruta `/accounts`

## Why

La ruta `/accounts` ya tiene su comportamiento de producto specificado en `accounts` y su chrome de carga en `route-loading-and-errors`. Lo que falta es **fijar el handoff visual** acordado en `docs/design/accounts/` como referencia normativa para esta ruta, dejando explícito qué se mantiene igual y qué queda fuera de alcance.

Hoy la pantalla muestra cuentas activas (cash + bank) agrupadas, un hint de primer uso condicional, una sección opcional de archivadas y un empty state — todo composado por componentes existentes (`AccountsHeader`, `ActiveAccountsContainer`, `ArchivedAccountsContainer`, `AccountSection`, `AccountRow`, `AccountRowMenu`, `AccountsHint`, `EmptyAccountsState`). El handoff en `docs/design/accounts/` reorganiza la jerarquía visual de esos mismos componentes (titulares, peso tipográfico, divisores, tratamiento de filas, badge `Archivada`, contadores de sección, separación entre bloques) sin tocar datos, queries, server actions ni acciones de fila.

Esta propuesta deja escrito que la implementación futura del rediseño:

- Usa **solo** los componentes y los datos que la ruta ya expone hoy.
- **No** agrega resúmenes, totales globales por moneda, búsqueda, filtros, ordenamiento, analítica, métricas derivadas, cards nuevas ni acciones de cuenta nuevas.
- Mantiene **ARS primario / USD secundario** por fila; nunca suma ni convierte monedas.
- Mantiene el `Button` primitivo para las acciones tipo CTA (header + empty state).
- Trata web y mobile como **implementaciones nativas en paralelo** (JSX no se comparte; el contrato es la paridad de estructura y de jerarquía visual, no JSX compartido).

## What Changes

- **AGREGAR** un requirement en `accounts` que fija `docs/design/accounts/` como handoff visual normativo de la ruta `/accounts` (raíz), enumera los componentes y datos sobre los que opera el rediseño, codifica los no-goals (no totales, no búsqueda, no filtros, no ordenamiento, no analítica, no acciones nuevas), confirma la regla bimoneda en la fila de cuenta, confirma el uso del `Button` primitivo en las acciones, y fija que web y mobile se implementan como dos vistas nativas en paralelo.
- **DOCS** nuevos archivos en `docs/design/accounts/` (ya presentes en el repo): `README.md`, `shared.css`, `web/accounts.html`, `mobile/accounts.html`, y `components/*.html`. Son referencia visual; la implementación futura usa los componentes del codebase.
- **NO** se modifican: las queries (`getCashAndBankAccounts`), el server-side data shape (`AccountWithBalances` y `has_transactions`), los server actions, las rutas (`/accounts`, `/accounts/new`, `/accounts/[id]`), el menú kebab por fila, ni el shell de Suspense con sus boundaries de error.
- **NO** se agregan: totales por moneda al pie de sección, búsqueda, chips de filtros, controles de ordenamiento, métricas, cards de resumen, ni acciones de cuenta más allá de las que ya expone `AccountRowMenu`.
- **Mobile**: el handoff define una vista nativa equivalente (header + hint condicional + secciones + filas) pero NO se implementa en este change. El requirement deja constancia de que cuando aterrice será una implementación RN paralela, no JSX compartido.

## Capabilities

### New Capabilities

_Ninguna._ Esta propuesta agrega un requirement de superficie visual sobre la capability existente `accounts`; no introduce datos, queries ni mutaciones nuevas.

### Modified Capabilities

- `accounts`: agrega un requirement que fija el handoff visual de `/accounts` (raíz) — referencia normativa a `docs/design/accounts/`, no-goals explícitos, regla bimoneda en fila, uso del `Button` primitivo, web/mobile como implementaciones nativas en paralelo. NO modifica los requirements existentes del listado (`El usuario puede ver la lista de sus cuentas agrupadas por tipo`) ni del scaffold de carga (`El header de /accounts se renderiza desde el primer paint…`); el nuevo requirement los complementa con la capa de estilo y los límites de alcance.
- `page-header`: modifica el requirement "PageHeader web renderiza el estilo canónico de título de página" para fijar el comportamiento responsive del slot `actions` — apila debajo del título bajo `< sm` (640px) y vuelve al layout horizontal con `flex-wrap items-start justify-between` a partir de `sm`. La regla aplica globalmente a todos los consumidores de `PageHeader`, no solo a `/accounts`. Solucion encontrada en /accounts pero el bug y la cura son comunes a todas las rutas con acciones en el header.

## Impact

- **Rutas afectadas**: `/accounts` (raíz). `/accounts/new` y `/accounts/[id]` quedan fuera de alcance — sus rediseños viven en otros changes.
- **Código afectado por la implementación futura** (este change NO implementa nada todavía):
  - `apps/web/app/(app)/accounts/_components/{account-section,account-row,accounts-hint,empty-accounts-state}.tsx` — ajustes de tipografía, divisores, contadores de sección, badge `Archivada`, separación visual entre bloques.
  - `apps/web/app/(app)/accounts/_components/accounts-header.tsx` — sin cambios funcionales; queda como referencia para asegurar que el botón "+ Crear cuenta" sigue usando el `Button` primitivo.
- **Data layer**: sin cambios. Sin nuevas queries, sin nuevos campos en `AccountWithBalances`, sin nuevos server actions.
- **Dependencias**: ninguna nueva. Usa tokens existentes en `@grana/ui-tokens` y primitivos existentes en `apps/web/components/ui/`.
- **Mobile**: ninguna implementación en este change. El handoff incluye `docs/design/accounts/mobile/accounts.html` como referencia para el change mobile que se proponga después.
- **i18n**: ninguna clave nueva. Las copys del header, hint, empty, sección y badge ya existen en `@grana/i18n-messages`.
