## ADDED Requirements

### Requirement: Section header solo se renderiza en la section root (web)

En `apps/web/app/(app)/`, una **section** es un segmento top-level que monta un section header en su `layout.tsx` (TransactionsHeader en `/transactions`, AccountsHeader en `/accounts`, CardsHeader en `/cards`, SettingsHeader en `/settings`). El componente de section header SHALL devolver `null` cuando el `usePathname()` no coincida exactamente con la section root, de modo que las rutas hijas no pinten dos headers apilados.

Section roots cubiertos por esta regla:

- `/transactions` → `TransactionsHeader` (`apps/web/app/(app)/transactions/_components/transactions-header.tsx`)
- `/accounts` → `AccountsHeader` (`apps/web/app/(app)/accounts/_components/accounts-header.tsx`)
- `/cards` → `CardsHeader` (`apps/web/app/(app)/cards/_components/cards-header.tsx`)
- `/settings` → `SettingsHeader` (`apps/web/app/(app)/settings/_components/settings-header.tsx`) — ya cumple

Las section layouts SHALL seguir montando el componente de section header (no se remueve del `layout.tsx`); la responsabilidad de no pintar nada en rutas hijas vive en el propio componente.

Sub-section headers que ya conmutan por pathname (como `CategoriesHeader` en `/settings/categories/**`) SHALL seguir funcionando como hoy y NO están cubiertos por esta regla — eligen su propio markup según el sub-pathname.

#### Scenario: Cada section header devuelve null fuera de su section root

- **WHEN** se navega a cualquier ruta bajo `/transactions/**`, `/accounts/**`, `/cards/**` o `/settings/**` que no sea exactamente la section root
- **THEN** el componente `*-Header` correspondiente retorna `null`
- **AND** la página no muestra dos elementos de header apilados (solo el header propio de la page)

#### Scenario: Una nueva section sigue el patrón

- **WHEN** se introduce una section nueva bajo `apps/web/app/(app)/<section>/` con un `layout.tsx` que monta `<SectionHeader />`
- **THEN** el componente `SectionHeader` SHALL incluir `if (pathname !== '/<section>') return null` antes de renderizar su `PageHeader`
- **AND** las rutas hijas SHALL renderizar su propio header sin verse afectadas por el section header

### Requirement: Las rutas hijas bajo (app) usan el back-link canónico de PageHeader (web)

Toda ruta hija de una section bajo `apps/web/app/(app)/<section>/**/page.tsx` (es decir, cualquier path distinto a la section root) SHALL renderizar un back-link al parent inmediato, usando el estilo canónico:

- Texto: `← {label}` (la flecha Unicode `←` seguida de un espacio y el label legible).
- Clases CSS: `text-sm text-muted-foreground hover:text-foreground transition-colors`.
- Implementación con `next/link` (no `<a>` raw) apuntando al `href` del parent.

El estilo canónico es el que `PageHeader` aplica cuando recibe `backLink={{ href, label }}` (definido en `apps/web/components/ui/page-header.tsx`). Las rutas hijas SHOULD usar `<PageHeader backLink={...} />` directamente. Si una ruta hija usa un widget compuesto (`AccountDetailHeader`, `CardDetailHeader`, header interno de `GlobalTransactionDetail`) en lugar de `PageHeader`, el back-link SHALL renderizarse como elemento separado encima del widget, usando exactamente el mismo markup que produce `PageHeader.backLink`.

Implementaciones explícitamente cubiertas por esta regla (rutas que hoy se desvían del estilo canónico y SHALL converger):

- `/cards/[id]` (`apps/web/app/(app)/cards/[id]/page.tsx`): el componente local `Breadcrumb` que renderiza `‹ {label}` SHALL ser reemplazado por el estilo canónico (`← {label}` con las clases canónicas).
- `/accounts/[id]` (`apps/web/app/(app)/accounts/[id]/_components/account-detail-content.tsx`): el `Link` inline que renderiza `← {label}` con clases distintas SHALL alinearse al markup canónico.
- `/transactions/[txId]` (`apps/web/app/(app)/transactions/[txId]/_components/tx-header.tsx`): el `TxHeader` SHALL renderizar `← {backLabel}` con el estilo canónico en su slot izquierdo (en lugar de un icon-only `ArrowLeft`), preservando el slot derecho para el actions menu. La justificación previa de "icon-only porque el browser-back carga la semántica" queda revertida en favor de la consistencia con el resto del app.

Rutas hijas que ya cumplen (porque usan `<PageHeader backLink={...} />`) NO requieren cambios.

#### Scenario: Una ruta hija sin widget compuesto usa PageHeader.backLink

- **WHEN** se renderiza una page bajo `app/(app)/<section>/<child>/page.tsx` que no usa widget compuesto
- **THEN** la page importa y monta `<PageHeader title="..." backLink={{ href: "/<section>...", label: "..." }} />`
- **AND** el back-link visible es `← {label}` con las clases canónicas

#### Scenario: Una ruta hija con widget compuesto monta el back-link canónico arriba del widget

- **WHEN** se renderiza una page bajo `app/(app)/<section>/<child>/page.tsx` que usa un widget compuesto de detalle (`AccountDetailHeader`, `CardDetailHeader`, `GlobalTransactionDetail` u otro listado como excepción en la regla "Las pages no declaran títulos top-level por fuera de PageHeader (web)")
- **THEN** la page renderiza, como hermano arriba del widget, un `<Link>` con texto `← {label}` y clases `text-sm text-muted-foreground hover:text-foreground transition-colors`
- **AND** el widget compuesto se mantiene sin cambios debajo

#### Scenario: TxHeader muestra label en lugar de icon-only

- **WHEN** se navega a `/transactions/[txId]` (con cualquier `from` query param o sin él)
- **THEN** `TxHeader` renderiza un `<Link>` con texto `← {backLabel}` (ej. `← Movimientos`, `← Visa Galicia`) en su slot izquierdo
- **AND** el slot derecho (`actions`) sigue montando el `TxActionsMenu` cuando aplique
- **AND** el componente NO renderiza únicamente un icono `ArrowLeft` sin label

#### Scenario: /cards/[id] usa el back-link canónico

- **WHEN** se navega a `/cards/[id]` (cualquier variante: con history, sin history, archivada sin pendings)
- **THEN** el back-link arriba de `CardDetailHeader` es un `<Link>` con texto `← {t('back_label')}` y clases canónicas
- **AND** el `CardDetailHeader` (avatar + nombre + status pill + bank) sigue renderizándose debajo sin cambios

#### Scenario: /accounts/[id] usa el back-link canónico

- **WHEN** se navega a `/accounts/[id]`
- **THEN** el back-link arriba de `AccountDetailHeader` es un `<Link>` con texto `← {t('title')}` (o el label que aplique) y clases canónicas
- **AND** el `AccountDetailHeader` sigue renderizándose debajo sin cambios
