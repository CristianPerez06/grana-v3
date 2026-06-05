## Context

`apps/web` organiza cada section (`/transactions`, `/accounts`, `/cards`, `/settings`) con un `layout.tsx` que monta un section header (TransactionsHeader, AccountsHeader, CardsHeader, SettingsHeader). El layout aplica a la section root y a todas sus rutas hijas — Next.js anida los layouts.

Hoy:

- **SettingsHeader** (referencia correcta): `if (pathname !== '/settings') return null` y devuelve un único `<PageHeader>` solo en el root. En sub-rutas, `CategoriesHeader` mismo es el que decide qué pintar según pathname, lo cual evita conflictos.
- **TransactionsHeader / AccountsHeader / CardsHeader**: renderizan su `<PageHeader>` siempre, sin importar la ruta. Las pages hijas montan su propio `<PageHeader>` o widget compuesto (CardDetailHeader, AccountDetailHeader, TxHeader), resultando en dos elementos apilados.

Sobre los back-links:

| Ruta | Estilo actual |
|---|---|
| `/transactions/[txId]/edit`, `/transactions/recurring`, `/transactions/recurring/[id]`, `/accounts/new`, `/accounts/[id]/edit`, `/cards/new`, `/cards/[id]/edit`, `/cards/[id]/periods`, `/cards/[id]/periods/[periodId]`, `/cards/[id]/periods/[periodId]/pay`, `/settings/categories/**` | `PageHeader.backLink` → `← {label}` (canónico) |
| `/cards/[id]` | Componente local `Breadcrumb` con `‹ {label}` |
| `/accounts/[id]` | `Link` inline en `account-detail-content.tsx` con `← {label}` (clases ligeramente distintas, pero visualmente cercano) |
| `/transactions/[txId]` | `TxHeader` con `<ArrowLeft>` icon-only, sin label, en un container con padding distinto |

El canónico ya vive en `apps/web/components/ui/page-header.tsx`:

```
text-sm text-muted-foreground hover:text-foreground transition-colors
```

precedido de `←` y el label.

## Goals / Non-Goals

**Goals:**

- Eliminar el doble header en toda ruta hija bajo `/transactions`, `/accounts`, `/cards`.
- Unificar el estilo del back-link de toda ruta hija de `(app)/` al canónico de `PageHeader.backLink`.
- Codificar ambas reglas en la spec `page-header` con scenarios verificables.

**Non-Goals:**

- No tocar mobile (`apps/mobile`). Mobile no tiene section layouts equivalentes; usa `PageHeader` directo por pantalla.
- No tocar widgets compuestos de detalle (`CardDetailHeader`, `AccountDetailHeader`, el bloque title interno de `GlobalTransactionDetail`). Estos siguen viviendo debajo del back-link, sin cambios.
- No tocar `/settings/**` ni `/settings/categories/**`: ya están alineados.
- No tocar el contract de `PageHeaderProps` en `@grana/ui-contracts`. La regla nueva habla del *uso* del componente, no de su API.

## Decisions

### Decisión 1: Short-circuit en cada section header vs. layout

**Elegido**: short-circuit dentro de cada `*-Header` component (TransactionsHeader, AccountsHeader, CardsHeader), igual que SettingsHeader.

**Alternativa considerada**: remover `<*Header />` del `layout.tsx` y montarlo solo en `page.tsx` de la section root. Más explícito, pero rompe el patrón ya establecido por `/settings` y agregaría un import extra en cada page hija para no romper nada visualmente.

**Por qué la elegida**: minimiza el diff, mantiene paridad con `SettingsHeader`, y el lugar natural para la regla pathname-aware es el componente que se rinde (no el layout, que es server component y no tiene `usePathname`).

### Decisión 2: TxHeader pasa de icon-only a `← {backLabel}`

El comentario actual en `tx-header.tsx:5-8` justifica el icon-only así:

> "icon-only, no label — the back of the browser carries the same semantic and the label `← Visa Galicia` / `← Movimientos` eats real estate without adding info"

**Elegido**: unificar a `← {backLabel}` y borrar el comentario.

**Por qué**: el argumento del browser-back aplica igual a todas las demás pages que sí muestran label. Si fuera suficiente, todo el app sería icon-only. La consistencia visual gana sobre la economía de espacio de una page específica. El slot derecho del `TxHeader` (actions menu/kebab) se preserva — el back-link cambia de elemento `<Link>` con `ArrowLeft` a `<Link>` con el estilo canónico.

### Decisión 3: `/cards/[id]` y `/accounts/[id]` conservan su widget compuesto

`CardDetailHeader` y `AccountDetailHeader` no son `PageHeader` — son widgets ricos (avatar + nombre + status pill + bank/currencies). El proposal **NO** los reemplaza. Solo normaliza el back-link que vive **arriba** del widget.

Estos casos ya figuran como excepciones explícitas en la spec actual de `page-header` (linea 200-208: "Las pages no declaran títulos top-level por fuera de PageHeader"). Esa excepción no cambia — lo que se agrega es la regla de que el back-link arriba del widget compuesto SHALL usar el estilo canónico.

### Decisión 4: Dónde codificar la regla

**Elegido**: agregar requirements nuevos en `openspec/specs/page-header/spec.md`.

**Alternativa considerada**: `web-app-shell` (porque trata del shell autenticado). Descartada: web-app-shell hoy cubre sidebar nav, no headers de page.

**Por qué page-header**: el componente cuyo estilo se vuelve canónico ya vive ahí, junto con la regla de "pages no declaran h1 ad-hoc". Las nuevas reglas son su extensión natural: "section headers solo en section root" y "back-link canónico unificado".

## Risks / Trade-offs

- **Riesgo**: `TransactionsHeader` precarga 3 queries (accounts, categories, household) vía `useQueries` para gatear el botón "Registrar movimiento" del root. → **Mitigación**: las mismas queries se disparan downstream por `MovementDrawerLoader` con el mismo `queryKey` (TanStack dedupea). En rutas hijas que no monten `MovementDrawerLoader`, las queries simplemente no se prefetchean — pero esas rutas tampoco necesitan el botón ni el drawer, así que es un no-op funcional.
- **Riesgo**: cambio sutil de jerarquía visual en `/transactions/[txId]` al perder el icon-only y ganar `← Movimientos` (o `← Visa Galicia` cuando `from=card:...`). El header de detalle se vuelve un pelo más alto. → **Mitigación**: aceptable por consistencia con `/accounts/[id]`, `/cards/[id]` y todas las páginas hijas de `/cards/[id]/periods/*` que ya muestran label.
- **Trade-off**: el comentario justificatorio del TxHeader queda borrado. Una decisión documentada se reemplaza por su opuesto — vale capturarlo en el commit message para que el `git blame` no parezca arbitrario.

## Migration Plan

No hay migración de datos ni de URLs. El cambio es 100% client-side rendering. El rollout es atómico via merge a `main`: las 3 layouts dejan de pintar doble header y los 3 back-links inconsistentes pasan al estilo canónico en el mismo PR.

Rollback: revertir el commit del PR. Sin efectos colaterales en DB ni en estado de usuarios.

## Open Questions

Ninguna — los dos puntos confirmados con el usuario en explore mode resuelven el scope.
