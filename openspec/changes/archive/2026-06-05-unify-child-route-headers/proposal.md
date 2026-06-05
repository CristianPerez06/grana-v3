## Why

Las section layouts de `/transactions`, `/accounts` y `/cards` montan su section header sin condicionar al pathname, así que toda ruta hija pinta **dos headers apilados** (el de la section + el propio de la page). `/settings` ya hace lo correcto y devuelve `null` fuera de `/settings`, pero las otras tres no replican el patrón. Aparte de los headers duplicados, las rutas hijas mezclan estilos de back-link (`← Cuentas`, `‹ Tarjetas`, flecha icon-only sin label), lo que rompe la consistencia visual del back-affordance que `PageHeader.backLink` ya define como canónico.

## What Changes

- `TransactionsHeader`, `AccountsHeader`, `CardsHeader` SHALL short-circuit (`return null`) cuando `usePathname()` no coincide con su section root (`/transactions`, `/accounts`, `/cards`). Réplica del patrón existente en `SettingsHeader`.
- El back-link de toda ruta hija bajo `(app)/` SHALL renderizarse con el estilo canónico de `PageHeader.backLink`: `← {label}` con clases `text-sm text-muted-foreground hover:text-foreground transition-colors`. Aplica a:
  - `/cards/[id]`: reemplazar el componente local `Breadcrumb` (`‹ Tarjetas`) por el estilo canónico.
  - `/accounts/[id]`: reemplazar el `Link` inline (`← Cuentas`) por el estilo canónico.
  - `/transactions/[txId]`: cambiar `TxHeader` de icon-only (`ArrowLeft` sin label) a `← {backLabel}` preservando el slot derecho con el actions menu.
- El resto de las rutas hijas (las que ya usan `PageHeader` con `backLink`) NO cambian.
- **BREAKING (interno)**: la decisión documentada en el comentario de `tx-header.tsx` ("icon-only porque el back del browser carga la semántica") queda revertida en favor de la consistencia con el resto del app.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `page-header`: agregar requirements que codifican (a) el patrón "section header solo en section root" y (b) la regla "back-link canónico unificado" para rutas hijas bajo `(app)/`. Incluye scenarios que listan las section layouts cubiertas y las páginas con headers compuestos (account/card/tx detail) que mantienen su widget rico debajo del back-link canónico.

## Impact

- **Código afectado (web)**:
  - `apps/web/app/(app)/transactions/_components/transactions-header.tsx`
  - `apps/web/app/(app)/accounts/_components/accounts-header.tsx`
  - `apps/web/app/(app)/cards/_components/cards-header.tsx`
  - `apps/web/app/(app)/cards/[id]/page.tsx` (`Breadcrumb` local)
  - `apps/web/app/(app)/accounts/[id]/_components/account-detail-content.tsx` (link inline)
  - `apps/web/app/(app)/transactions/[txId]/_components/tx-header.tsx`
- **Mobile**: sin cambios. La regla nueva aplica a `apps/web` exclusivamente; mobile usa `PageHeader` directo en cada pantalla y no tiene section layouts equivalentes.
- **APIs / DB / deps**: ninguno. Es 100% UI client-side.
- **Riesgo**: el `TransactionsHeader` precarga 3 queries (accounts, categories, household) vía `useQueries` para habilitar el botón "Registrar movimiento"; al devolver `null` fuera de `/transactions`, esas queries no se ejecutan en rutas hijas. El comentario actual indica que `MovementDrawerLoader` downstream las dispara igual con el mismo `queryKey` (TanStack dedupea); en rutas hijas que no monten `MovementDrawerLoader`, simplemente no se gatean prematuramente — sin impacto funcional.
