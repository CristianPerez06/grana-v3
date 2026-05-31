# Tareas — Consolidar las tarjetas del dashboard sobre `Card`

> Web-only. No se toca `@grana/ui-contracts` ni mobile.

## Grupo 1 · Reshape del primitivo `Card`

- [x] 1.1. Cambiar el radio del shell en `apps/web/components/ui/card.tsx`: `rounded-[var(--radius-lg)]` → `rounded-2xl`. Mantener `border bg shadow-sm`; sin padding en el shell.
- [x] 1.2. Agregar prop `variant: 'default' | 'emerald'` (default cuando se omite) como extensión web-local: `type CardProps = ContractCardProps & { variant?: 'default' | 'emerald' } & DivProps`. `default` → `border-border bg-card`; `emerald` → `border-emerald/30 bg-emerald/5`. `cn()`/twMerge resuelve el override de border/bg.
- [x] 1.3. Conservar `CardHeader`/`CardContent`/`CardFooter` tal cual (`CardContent` sigue `p-6 pt-0`). No hornear padding en el shell.
- [x] 1.4. `card.stories.tsx`: agregar story de `variant="emerald"`; confirmar que `Default` (header-less, `CardContent pt-6`) y `FullComposition` se ven correctos con el radio nuevo.

## Grupo 2 · Migrar las cinco secciones a componer `Card`

- [x] 2.1. `hero-section.tsx` → `<Card className="min-h-[10rem]"><CardContent className="pt-6">…</CardContent></Card>`. Quitar el shell inline (`rounded-2xl border border-border bg-card p-6 shadow-sm`).
- [x] 2.2. `month-balance-section.tsx` → `<Card className="h-full min-h-[26rem] flex flex-col overflow-hidden">`; `CardHeader` con título + navegador mensual en fila `justify-between`; `CardContent` con el chart. **Preservar** el estado de carga/error compacto y "sin layout shift" (título + navegador siempre visibles, área async en `CardContent`).
- [x] 2.3. `upcoming-fortnight-section.tsx` → `<Card className="h-full min-h-[20rem]">`; `CardHeader` (título) + `CardContent` (listas).
- [x] 2.4. `welcome-first-move-card.tsx` → `<Card variant="emerald">` + `CardContent` (pt restaurado si va sin header). Quitar el shell emerald inline.
- [x] 2.5. `category-teaser.tsx` → `<Card>` default; `CardHeader` con título + "Ver desglose" en fila `justify-between`; `CardContent` con las 3 barras. Mantener `if (slices.length === 0) return null`. Esto le da `bg-card` (elimina el fondo gris).
- [x] 2.6. Grep de control: ninguna de las cinco secciones retiene `rounded-2xl`/`bg-card`/`shadow-sm`/`border-border` de shell fuera de `Card`.

## Grupo 3 · Verificación

- [x] 3.1. `pnpm --filter web typecheck` y `pnpm --filter web lint` OK.
- [x] 3.2. Storybook: `Card` default + emerald + composición completa + header-less se ven con `rounded-2xl`.
- [x] 3.3. Revisión visual del dashboard: las 5 tarjetas comparten radio/fondo/sombra; el teaser **ya no se ve gris** (tiene `bg-card`); la de bienvenida sigue verde (`emerald`).
- [x] 3.4. Paridad de comportamiento de "Balance del mes": navegación mensual, carga/error compacto y sin layout shift, igual que antes.
- [x] 3.5. `pnpm --filter mobile typecheck` OK (sin tocar el contrato, mobile no debe verse afectado).
- [x] 3.6. `pnpm openspec:check` OK.
