## 1. Short-circuit section headers fuera del root

- [x] 1.1 Agregar `if (pathname !== '/transactions') return null` en `apps/web/app/(app)/transactions/_components/transactions-header.tsx` antes del `return <PageHeader />`. Mantener `useQueries` dentro del flujo: la guarda queda después de los hooks para no romper las reglas de React.
- [x] 1.2 Agregar `if (pathname !== '/accounts') return null` en `apps/web/app/(app)/accounts/_components/accounts-header.tsx` antes del `return <PageHeader />`. Si la guarda quita la necesidad del flag `isListRoot`, simplificar el resto del componente (la institución solo se fetchea en el root igual, sigue igual).
- [x] 1.3 Agregar `if (pathname !== '/cards') return null` en `apps/web/app/(app)/cards/_components/cards-header.tsx` antes del `return <PageHeader />`. Simplificar `isWalletRoot` / branches dependientes si la guarda los hace redundantes.

## 2. Unificar back-link al estilo canónico de PageHeader

- [x] 2.1 En `apps/web/app/(app)/cards/[id]/page.tsx`, reemplazar el componente local `Breadcrumb` (`‹ {label}`) por un `<Link href="/cards" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{'← '}{t('back_label')}</Link>` antes del `CardDetailHeader`. Reemplazar las 3 invocaciones (`!cardHasHistory && cardDetail.is_active`, `!cardDetail.is_active && !hasPendings`, render principal). Borrar la función `Breadcrumb` local.
- [x] 2.2 En `apps/web/app/(app)/accounts/[id]/_components/account-detail-content.tsx`, normalizar el `<Link href="/accounts" ...>` que renderiza `← {t('title')}` al markup canónico exacto (mismas clases: `text-sm text-muted-foreground hover:text-foreground transition-colors`). El wrapper `div` actual con `flex items-center gap-3` puede quedar pero alinearlo al markup que produce `PageHeader.backLink` (es solo el `<Link>` envuelto en el `flex flex-col gap-3` del componente, ver `page-header.tsx:117-128`). **No-op**: el archivo ya estaba alineado al markup canónico.
- [x] 2.3 En `apps/web/app/(app)/transactions/[txId]/_components/tx-header.tsx`, reemplazar el `<Link>` icon-only (`ArrowLeft size={20}`) por un `<Link>` con texto `← {backLabel}` y clases `text-sm text-muted-foreground hover:text-foreground transition-colors`. Mantener el contenedor padre `flex items-center justify-between` y el slot derecho `actions` intactos. Quitar el import de `ArrowLeft` y la `aria-label` (el texto del link ya es accesible). Borrar el comentario que justificaba el icon-only.

## 3. Verificación funcional

- [x] 3.1 `pnpm --filter @grana/web typecheck` (o equivalente del repo) limpio. **Nota**: el filtro correcto es `pnpm --filter web` (package name es `web`, no `@grana/web`).
- [x] 3.2 `pnpm --filter @grana/web lint` limpio.
- [x] 3.3 Browse manual: `/transactions/recurring`, `/transactions/recurring/[id]`, `/transactions/[txId]`, `/transactions/[txId]/edit`, `/accounts/new`, `/accounts/[id]`, `/accounts/[id]/edit`, `/cards/new`, `/cards/[id]`, `/cards/[id]/edit`, `/cards/[id]/periods`, `/cards/[id]/periods/[periodId]`, `/cards/[id]/periods/[periodId]/pay`. En todas: un solo header, back-link en estilo `← {label}`.
- [x] 3.4 Sanity check de `/transactions`, `/accounts`, `/cards`, `/settings`, `/settings/categories/**`: sus headers siguen apareciendo en el root (no se rompió la guarda al revés).
- [x] 3.5 Verificar que el botón "Registrar movimiento" del root de `/transactions` sigue gateando correctamente al cargar (sin regresión en `useQueries` / `MovementDrawerLoader`).

## 4. Spec sync y archivo

- [x] 4.1 Correr `openspec validate unify-child-route-headers --strict` y resolver cualquier warning.
- [x] 4.2 Cuando todas las tasks anteriores estén marcadas, archivar el change con `/opsx:archive` (mergea el delta a `openspec/specs/page-header/spec.md`).
