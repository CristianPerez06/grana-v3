## 1. i18n

- [x] 1.1 Agregar keys nuevas en `packages/i18n-messages` (es + en): chip `dashboard.month.adjustment_unregistered`; Comprometido `outflow_label` ("Ya sale"), `income_tile_title`/`income_tile_sub` ("Ya entra"), `net_surplus`/`net_deficit` (cierre neto); Gastaste este mes `dashboard.spent.*`; Compartido `dashboard.shared_strip.*`; concentración `dashboard.accounts.concentration_lead`.
- [x] 1.2 Verificar que no quedan strings hardcodeados en los componentes nuevos (todo desde el catálogo) — paridad es/en verificada.

## 2. "Dónde está" — concentración (web)

- [x] 2.1 Reescribir `accounts-card.tsx`: callout de concentración (`pct = cuenta[0].ars / Σ ars`, entero; oculto si Σ=0).
- [x] 2.2 Barra de concentración: un segmento por cuenta con ancho = `cuenta.ars / Σ` (color de identidad de cuenta, min-width visible para sub-pixel); data-driven.
- [x] 2.3 Grilla compacta 2-col con las cuentas restantes + fila "En dólares" en emerald; saldo cero atenuado.
- [x] 2.4 Mantener cap de 6 cuentas, link "Ver todas" → `/accounts`, y eye-mask en todos los importes.
- [x] 2.5 Helper puro de concentración (`lib/dashboard/concentration.ts`) + test unitario (1 cuenta = 100%, Σ=0 sin callout, proporciones, overdraft).

## 3. "Comprometido" — tiles + cierre neto (web)

- [x] 3.1 Reemplazar el cuerpo `FlowRow` de `committed-section.tsx` por dos mini-tiles de egreso (Resúmenes tarjeta / Gastos recurrentes) con ícono + label + monto; total titular intacto.
- [x] 3.2 Estado con ingreso recurrente (`recurringIncome > 0`): sub-label "YA SALE", tile "Ya entra" full-width en emerald con el ingreso en positivo.
- [x] 3.3 Banda de cierre neto: `neto = recurringIncome − totalComprometido`; positivo → "+neto a favor" (emerald), negativo → déficit (expense). Data-driven, eye-mask.
- [x] 3.4 Sin ingreso recurrente: no renderizar sub-label, tile verde ni banda. Mantener strip USD y estado vacío/error/skeleton existentes.

## 4. "Gastaste este mes" — barra caja vs tarjeta (web)

- [x] 4.1 Crear `spent-this-month-section.tsx` reusando las query keys `balance-series` + `category-breakdown` (sin fetch nuevo); cálculo `caja`/`devengado`/`financiado` como en la nota actual.
- [x] 4.2 Barra de 2 segmentos proporcionales (`caja/total`, `financiado/total`): "De tu caja" (slate) + "Financiado en tarjeta" (terracota) con label + monto; total como titular; caption "se paga en los próximos resúmenes".
- [x] 4.3 Render solo si `financiado > 0`; colapsar a columna en mobile; eye-mask; seguir el navegador de mes.
- [x] 4.4 Eliminar `financed-on-card-note.tsx` y su uso; actualizar imports.

## 5. Tira "Compartido" (web)

- [x] 5.1 Container/boundary propio (`shared-strip-container.tsx`) que consume el neto derivado del Hogar de `apps/web/lib/shared/queries.ts` (sin duplicar matemática); tolerante a fallas (try/catch → null).
- [x] 5.2 Componente de tira (`shared-strip.tsx`): ícono + avatares/iniciales de los 2 miembros + "Hogar · vos y Martín" + neto con dirección (`te deben` emerald / `debés` expense), por moneda; navega a `/shared`; read-only; eye-mask.
- [x] 5.3 Gate de visibilidad: no montar si no hay Hogar de 2 o no hay actividad/neto (ambas monedas settled).

## 6. Detalle "En qué gasté" + chip Ajustes (web)

- [x] 6.1 `spending-section.tsx`: agregar barra proporcional bajo cada fila de leyenda (`monto / max`, color del slice); no aplicar a filas de crédito.
- [x] 6.2 `month-balance-section.tsx`: agregar chip "SIN REGISTRAR" junto al monto de la fila Ajustes (i18n, ámbar); conservar el aviso educativo y el eye-mask.

## 7. Composición y orden (web)

- [x] 7.1 Actualizar `dashboard-content.tsx`: fila Hero+Dónde → fila Balance+Comprometido → Compartido (cond.) → Gastaste este mes (cond.) → ¿En qué gasté?, cada una con su `<Suspense>`/skeleton.
- [x] 7.2 Ajustar skeletons afectados: `hero-skeleton` (Dónde está → callout + barra + grilla) y `committed-skeleton` (→ dos tiles) shape-matched tras el rediseño.

## 8. Responsive + accesibilidad

- [x] 8.1 Breakpoints en código: fila superior y segunda fila a 1 columna bajo `lg`; barra Gastaste y barra de concentración a columna en mobile; dona centrada (sin tocar).
- [x] 8.2 Roles/labels accesibles: tira Compartido como `<Link>` con texto, chips/barras decorativos `aria-hidden`, foco visible heredado de los primitivos.

## 9. Verificación

- [x] 9.1 `pnpm --filter web lint` y typecheck sin errores; `pnpm build` OK (`/dashboard` compila).
- [x] 9.2 Tests de los helpers puros nuevos (concentración) en verde; suite completa 394/394.
- [ ] 9.3 Correr la app y validar visualmente los dos estados de Comprometido (con/sin ingreso), el caso sin Compartido, el caso sin consumo de tarjeta, y el eye-mask sobre cada importe nuevo — pendiente de la revisión del usuario.
- [x] 9.4 Archivar el change en la branch antes del merge (mover a `archive/`, sincronizar `openspec/specs/dashboard/spec.md`, `pnpm openspec:check`). El merge squash lo hace el usuario.
