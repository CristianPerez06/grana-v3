# Tareas — Rediseño visual del módulo Movimientos

## Grupo 1 · Tokens y design system

- [ ] 1.1. Agregar token `--expense: #B56A5A` a `packages/ui-tokens/src/theme.css` (light y dark si aplica).
- [ ] 1.2. Agregar aliases semánticos: `--income` (alias del emerald existente), `--text-neutral-amount` (alias del ink), `--text-pending` (alias del muted).
- [ ] 1.3. Exponer las variants Tailwind: `text-expense`, `text-income`, `text-neutral-amount`, `text-pending` (y `bg-*` / `border-*` para `expense` por si se usan en chips).
- [ ] 1.4. Validar que Tailwind 4 del repo resuelve la slash notation `bg-cat-1/14`. Si no, documentar el fallback (`color-mix(...)`) en `theme.css`.

## Grupo 2 · Lógica pura

- [ ] 2.1. Crear `buildDonutSegments(slices)` en `packages/money-logic/src/spending.ts` (o módulo equivalente). Devuelve `Array<{ color, length, offset }>` para renderizar los segmentos SVG. Tests: una sola categoría, dos, cinco, seis (colapsa en "otros").
- [ ] 2.2. Crear `buildSliceMetaLine(slice, stats)` en `packages/money-logic`. Decide la copy de meta enriquecida según el slice (cuotas dominantes, recurrentes, default). Tests para los tres casos.
- [ ] 2.3. Actualizar la query `getMonthCategoryBreakdown` en `apps/web/lib/transactions/queries.ts` para que devuelva los stats que `buildSliceMetaLine` necesita (cantidad de movimientos, cantidad de cuotas, cantidad de recurrentes por slice).

## Grupo 3 · `PageHeader` con variant narrativa

- [ ] 3.1. Extender `packages/ui-contracts/src/page-header.ts` con props opcionales: `eyebrow?: string`, `monthLabel?: string`, `prevMonthHref?: string`, `nextMonthHref?: string`. `subtitle` ya existe como `description` — confirmar si rename es necesario para reflejar que ahora acepta `ReactNode` y no solo `string`.
- [ ] 3.2. Actualizar `apps/web/components/ui/page-header.tsx` para que renderice el patrón narrativo cuando se pasan los props nuevos. El patrón clásico se mantiene si no se pasan.
- [ ] 3.3. Storybook story nueva para `PageHeader` variant `narrative`.

## Grupo 4 · `MovementRow` con color semántico y chip de recurrencia

- [ ] 4.1. Reemplazar `text-red-600` por `text-expense` en `apps/web/lib/transactions/components/movement-row.tsx` para los casos: `expense`, `card_payment`, `installment_purchase`, ajuste negativo.
- [ ] 4.2. Reemplazar `text-green-600` por `text-income` para los casos: `income`, `reimbursement` recibido, ajuste positivo.
- [ ] 4.3. Aplicar `text-neutral-amount` (alias de `text-foreground`) para `transfer`, `exchange`, ajuste sin signo.
- [ ] 4.4. Aplicar `text-pending` (alias de `text-muted-foreground`) para reintegros pendientes.
- [ ] 4.5. Cambiar el indicador de recurrencia: del `<Repeat size={12}>` suelto al chip slate con label "Recurrente" + ícono `Repeat 10px`. Reusar el patrón visual del chip de "review" como referencia de estructura.
- [ ] 4.6. Actualizar los tests/stories de `MovementRow` para reflejar el nuevo chip y los nuevos tokens de color.

## Grupo 5 · `CategorySpendingOverview` híbrido

- [ ] 5.1. Editar `apps/web/lib/transactions/components/category-spending-overview.tsx` para renderizar la variante híbrida.
- [ ] 5.2. Componente interno `<Donut slices={...}>` que toma los segments de `buildDonutSegments` y los renderiza con SVG puro. Centro: eyebrow + monto + caption.
- [ ] 5.3. Renderizar ranking lateral con hasta 5 filas: dot color + emoji + nombre + meta enriquecida + monto. Sexta fila colapsa el resto en "+ N categorías más".
- [ ] 5.4. Footer del card: "Sin contar consumos en tarjeta sin pagar" + link "Ver el detalle →".
- [ ] 5.5. Mantener el switcher ARS/USD (ya está en el call site, no se toca).
- [ ] 5.6. Story de Storybook con los casos: ARS típico, USD con 2 categorías, 1 sola categoría, 8+ categorías (colapsa).

## Grupo 6 · `MovementFilters` barra compacta

- [ ] 6.1. Confirmar que la barra de búsqueda + botón Filtros con badge ya están según las decisiones del roadmap previo. Si no, ajustar la altura (`h-11` → `h-44px` si difiere) y el badge del contador.
- [ ] 6.2. El panel inline existente queda como está (el sheet desde la derecha es una iteración futura, fuera del scope de este change).

## Grupo 7 · Header del `/transactions/page.tsx`

- [ ] 7.1. Reemplazar el `PageHeader` actual por el nuevo `PageHeader` con variant narrativa. Props: `eyebrow="Movimientos"`, `monthLabel="<mes> <año>"`, `prevMonthHref={shiftMonth(month, -1)}`, `nextMonthHref={shiftMonth(month, +1)}`, `subtitle=<conteo + moneda + link recurrencias>`.
- [ ] 7.2. Eliminar los botones de "Recurrencias" y "Registrar movimiento" del header (el FAB cubre registrar; el link en el subtítulo cubre recurrencias).
- [ ] 7.3. Mover el link "Ver recurrencias →" al subtítulo del header: texto `· Ver recurrencias →` peso 500, 13px, color slate, hover navy.
- [ ] 7.4. Calcular `monthLabel` con `Intl.DateTimeFormat` respetando el locale del usuario.

## Grupo 8 · Loading skeleton

- [ ] 8.1. Crear `apps/web/lib/transactions/components/movement-list-skeleton.tsx` con dos day groups skeleton (3 y 4 filas respectivamente) usando `bg-muted animate-pulse`.
- [ ] 8.2. Usar `<Suspense fallback={<MovementListSkeleton />}>` en `apps/web/app/(app)/transactions/page.tsx` envolviendo el render del `MovementList`.

## Grupo 9 · Empty state contextual del mes vacío

- [ ] 9.1. Agregar query liviana en `apps/web/lib/transactions/queries.ts`: `hasAnyTransaction(): Promise<boolean>` con `SELECT 1 LIMIT 1`.
- [ ] 9.2. En `apps/web/app/(app)/transactions/page.tsx`, cuando `emptyVariant === 'none'`, decidir la copy: bienvenida si `!hasAny`, contextual al mes si `hasAny`.
- [ ] 9.3. Agregar claves i18n en `packages/i18n-messages/src/{es,en}.json`: `transactions.empty.welcome.title`, `transactions.empty.welcome.body`, `transactions.empty.welcome.cta`, `transactions.empty.month.title` (acepta `{month}` placeholder), `transactions.empty.month.body`.

## Grupo 10 · Mobile contracts

- [ ] 10.1. Actualizar `packages/ui-contracts/src/page-header.ts` con los props nuevos. Verificar que TypeScript del lado mobile no rompa (los props son opcionales).
- [ ] 10.2. Agregar nota en `packages/ui-contracts/README.md` explicando la nueva variant `narrative` para que el tech lead la replique en mobile.

## Grupo 11 · Verificación

- [ ] 11.1. `pnpm typecheck` verde.
- [ ] 11.2. `pnpm lint` verde.
- [ ] 11.3. `pnpm test` verde (los nuevos tests de `buildDonutSegments` y `buildSliceMetaLine` incluidos).
- [ ] 11.4. `pnpm build` (web) verde.
- [ ] 11.5. Verificar en navegador (`pnpm dev`): pantalla `/transactions`, vista de cuenta `/accounts/[id]`, formularios `/transactions/new` y `/transactions/[id]/edit`, detalle. Comparar con `docs/design/movimientos/12-hibrido-final.html` para verificar fidelidad visual.

## Grupo 12 · Archive

- [ ] 12.1. Mover el change a `openspec/changes/archive/YYYY-MM-DD-redesign-transactions-visuals/`.
- [ ] 12.2. Aplicar deltas a `openspec/specs/transactions/spec.md` (integrar ADDED y MODIFIED a la sección flat `## Requirements`).
- [ ] 12.3. Confirmar que no quedan placeholders `Purpose: TBD` en master specs.
- [ ] 12.4. Correr el check de hygiene equivalente a `pnpm openspec:check` (en Windows hay que correrlo via `Grep` por el bash script issue).
- [ ] 12.5. Actualizar `AGENTS.md` sección "Modules" si corresponde (probablemente no — el módulo `transactions` ya está marcado ✅ Done).
