## 1. Contract compartido

- [x] 1.1 Agregar el tipo `PageHeaderProps` a `packages/ui-contracts/src/index.ts` con `title`, `backLink?`, `actions?` y `className?`, siguiendo el formato del archivo y manteniendo el JSDoc por campo.
- [x] 1.2 Verificar con `pnpm --filter web exec tsc --noEmit` que el tipo compila sin romper imports existentes.

## 2. Implementación web

- [x] 2.1 Crear `apps/web/components/ui/page-header.tsx` como Server Component que renderiza `backLink` (si hay) con `next/link` y el `<h1>` con clases `text-2xl font-semibold tracking-tight`, y opcionalmente el slot `actions` a la derecha del título con `flex items-center justify-between gap-2`. Importar `PageHeaderProps` desde `@grana/ui-contracts`.
- [x] 2.2 Crear `apps/web/components/ui/page-header.stories.tsx` con cuatro stories: sólo `title`, `title + backLink`, `title + actions`, los tres juntos. Validar localmente con `pnpm storybook` (verificación visual queda para el owner).
- [x] 2.3 (Agregado durante implementación) Extender `PageHeaderProps` con `description?: string` y actualizar la story con dos variantes adicionales (`title + description`, `title + description + actions`). Razón: 4 list pages necesitan subtítulo dentro del header; ver design.md Decisión 7.

## 3. Migración web — list/index pages

- [x] 3.1 `apps/web/app/(app)/accounts/page.tsx` — `<PageHeader title="Cuentas" actions={...crear cuenta} />`.
- [x] 3.2 `apps/web/app/(app)/cards/page.tsx` — `<PageHeader title="Tarjetas" actions={...agregar tarjeta} />`.
- [x] 3.3 `apps/web/app/(app)/transactions/page.tsx` — `<PageHeader title="Movimientos" description="..." actions={Recurrencias} />`. **Cambio incidental**: eliminado el eyebrow "Tus movimientos" por redundante.
- [x] 3.4 `apps/web/app/(app)/transactions/recurring/page.tsx` — `<PageHeader title="Recurrencias" description="..." backLink={Movimientos} />`.
- [x] 3.5 `apps/web/app/(app)/settings/page.tsx` — `<PageHeader title="Configuración" />`.
- [x] 3.6 `apps/web/app/(app)/settings/categories/page.tsx` — `<PageHeader title="Categorías" description="..." actions={+ Agregar} />`.
- [x] 3.7 `apps/web/app/(app)/settings/categories/[id]/subcategories/page.tsx` — `<PageHeader title="Subcategorías" description={categoryDisplayName} backLink={Categorías} actions={!isSystem && + Agregar} />`.
- [x] 3.8 `apps/web/app/(app)/cards/[id]/periods/page.tsx` — `<PageHeader title="Resúmenes" backLink={cardDetail.name} />`.

## 4. Migración web — form/edit/new/detail con `<h1>`

- [x] 4.1 `apps/web/app/(app)/accounts/new/page.tsx` — migrada.
- [x] 4.2 `apps/web/app/(app)/accounts/[id]/edit/page.tsx` — migrada.
- [x] 4.3 `apps/web/app/(app)/cards/new/page.tsx` — migrada; el subtítulo dinámico (novato/experto) entra como `description`.
- [x] 4.4 `apps/web/app/(app)/cards/[id]/edit/page.tsx` — migrada.
- [x] 4.5 `apps/web/app/(app)/cards/[id]/periods/[periodId]/page.tsx` — migrada; "Vence DD/MM/YYYY" entra como `description`, `EditDatesSheet` como `actions`.
- [x] 4.6 `apps/web/app/(app)/cards/[id]/periods/[periodId]/pay/page.tsx` — migrada.
- [x] 4.7 `apps/web/app/(app)/transactions/recurring/[id]/page.tsx` — migrada; el eyebrow de status (no redundante) se dobló dentro de `description` (`"Activa · Cuenta · ARS"`).
- [x] 4.8 `apps/web/app/(app)/accounts/[id]/transactions/new/page.tsx` — migrada.
- [x] 4.9 `apps/web/app/(app)/accounts/[id]/transactions/[txId]/edit/page.tsx` — migrada.
- [x] 4.10 `apps/web/app/(app)/settings/categories/new/page.tsx` — migrada.
- [x] 4.11 `apps/web/app/(app)/settings/categories/[id]/edit/page.tsx` — migrada.
- [x] 4.12 `apps/web/app/(app)/settings/categories/[id]/subcategories/new/page.tsx` — migrada.

## 5. Verificación anti-regresión web

- [x] 5.1 `grep -rn "<h1" apps/web/app/(app)` devuelve solo los 3 headers compuestos de detalle listados como excepción (`CardHero`, `DashboardHeader`, `AccountDetailHeader`). Migración limpia.
- [x] 5.2 `pnpm --filter web build` pasa sin errores.
- [x] 5.3 Verificación visual local (`pnpm dev`): owner confirmó OK.

## 6. Implementación mobile

- [x] 6.1 Crear `apps/mobile/components/ui/PageHeader.tsx` — usa `View` + `Text` (NativeWind), `Link` de `expo-router` con `asChild` para back link, `accessibilityRole="header"` en el título, colores vía tokens (`text-foreground`, `text-text-soft`). Importa `PageHeaderProps` desde `@grana/ui-contracts`.
- [x] 6.2 `apps/mobile/app/(app)/movimientos.tsx` — refactorizada a `<PageHeader title="Movimientos" />` en el top de la pantalla.
- [x] 6.3 `apps/mobile/app/(app)/accounts.tsx` — refactorizada a `<PageHeader title="Cuentas" />`.
- [x] 6.4 `apps/mobile/app/(app)/tarjetas.tsx` — refactorizada a `<PageHeader title="Tarjetas" />`.

## 7. Verificación mobile

- [x] 7.1 `pnpm --filter mobile exec tsc --noEmit` pasa sin errores; el tipo cross-platform compila.
- [x] 7.2 Verificación visual local en simulador Android: owner confirmó OK (después de recompilar el dev client por un mismatch nativo de reanimated, no relacionado a este change).

## 8. Archive

- [ ] 8.1 Archivar el change con el skill `openspec-archive-change` antes del merge a `main`.
- [ ] 8.2 Integrar los deltas del spec de `page-header` en `openspec/specs/page-header/spec.md` (capability nueva: el archive crea el master spec a partir del delta `## ADDED Requirements`). Reemplazar el `Purpose: TBD` placeholder con una descripción real de 2-4 líneas del capability.
- [ ] 8.3 Actualizar `CLAUDE.md`: agregar `page-header` a la sección "Modules" (categoría aparte de cross-cutting/primitivas, paralelo a `route-loading-and-errors`), o documentar `PageHeader` en una sección breve de "Primitivas UI compartidas" si esa sección encaja mejor. Decidir el lugar al archivar.
- [ ] 8.4 Correr `pnpm openspec:check` y confirmar que pasa antes del merge.
