# Design: redesign-dashboard-home

## Context

El dashboard web actual (`apps/web/app/(app)/dashboard/`) sigue el patrón RSC + `<Suspense>` por sección: `page.tsx` monta `EyeMaskProvider` + `DashboardHeader` + `DashboardContent`, y cada sección tiene su container async + skeleton shape-matched. El data layer vive en `@grana/dashboard` (client-injected) y ya cubre todo lo que el rediseño necesita: `getDashboardHero` (totales + desglose por cuenta), `getMonthBalanceSeries` (ingresos/gastos/neto por moneda) y `getMonthCategoryBreakdown` (gasto neto por categoría y moneda). Existen server actions para el fetch client-side por mes (`fetchMonthBalanceSeries`, `getMonthCategoryBreakdownAction`).

El handoff (`docs/design/design_handoff_dashboard_inicio/README.md`) define la nueva pantalla: fila superior "Para gastar · hoy" (card navy) + "Dónde está" (cuentas), "Balance del mes" (neto + barras + strip USD), "En qué se fue" (dona + leyenda + toggle ARS/USD), con el selector de mes en el header.

Restricciones: web only (mobile intacto); shell intacto (sidebar/topbar/drawer/FAB); el código y el design system mandan sobre los hex del handoff; bimoneda sin merge; `getTodayAR()` para "hoy"; montos con `MaskedAmount`/eye-mask.

## Goals / Non-Goals

**Goals:**

- Recrear la pantalla del handoff con alta fidelidad usando tokens de `@grana/ui-tokens`, primitivas existentes (`Card`, `Button`, `Segmented`, `MonthNavigator`, `MaskedAmount`, `AccountAvatar`) y lucide-react.
- Un único estado de mes compartido (header) que gobierna "Balance del mes" y "En qué se fue" sin tocar la URL.
- Barras y tramos de la dona 100% derivados de datos.
- Mantener el patrón de streaming por sección (Suspense + skeleton shape-matched, sin layout shift).

**Non-Goals:**

- Tocar el dashboard mobile, el shell web, o el flujo de alta de movimientos.
- Cambiar queries/agregaciones de `@grana/dashboard` o el schema.
- Bottom-nav mobile del handoff (descartada por decisión de producto).
- El desglose completo de Movimientos (`CategorySpendingOverview`) no se modifica.

## Decisions

### D1 — Estado de mes compartido: `DashboardMonthProvider` client-side

Un context client (`dashboard-month-context.tsx`, patrón espejo de `eye-mask-context.tsx`) posee `{year, month}` seleccionado, inicializado al mes actual (`getTodayAR()` server-side, pasado por prop). El `MonthNavigator` existente se monta en el `DashboardHeader` y muta este context. "Balance del mes" y "En qué se fue" lo consumen: server-render del mes actual como `initialData` (igual que hoy) y, cuando `selected !== current`, fetch client-side vía las server actions existentes con estado loading/error in-card (patrón ya probado en `MonthBalanceSection`). No URL state, no persistencia, límite 12 meses atrás, flecha derecha disabled en el mes actual — reglas que ya existen y se conservan.

*Alternativa considerada:* searchParams + re-render RSC. Descartada: la spec actual ya prohíbe que el cambio de mes navegue/recargue, y el patrón server-action está implementado.

### D2 — Fila superior: un container, dos cards

`getDashboardHero` ya devuelve totales + desglose por cuenta en una llamada. Un único container async (`hero-section-container.tsx`) renderiza el grid `md:grid-cols-[1.15fr_1fr]` con las dos cards como componentes presentacionales separados:

- **`HeroSection` (rediseñada)**: card navy (`bg-surface-dark`), eyebrow "PARA GASTAR · HOY", monto ARS grande con decimales reducidos, chip "USD" + monto USD, caption al fondo. Sigue linkeando a `/accounts` (requirement read-only). Sin desglose de cuentas adentro (se muda a la card vecina).
- **`AccountsCard` (nueva, "Dónde está")**: filas de **todas** las cuentas cash/bank (ya vienen ordenadas por ARS desc) con `AccountAvatar` chico + nombre + monto ARS (gris `text-faint` si es cero); fila final "En dólares" en emerald con el total USD; link "Ver todas" → `/accounts`. Si `accounts.length > 6` se truncará a 6 + "Ver todas" (la card no debe crecer sin límite).

La fila USD de la card usa el **total** USD del hero (no per-cuenta), igual que el handoff ("la tenencia En dólares").

*Alternativa:* dos containers/dos queries. Descartada: doble fetch del mismo dato.

### D3 — "Balance del mes": presentacional nuevo, mismo seam de datos

`MonthBalanceSection` se reescribe (client) manteniendo su contrato de datos (`MonthBalanceByCurrency` + fetch por mes), pero el cuerpo pasa de chart a:

- Eyebrow "BALANCE" + neto ARS grande con signo y color (`text-positive` si ≥0, `text-expense` si <0).
- Filas Ingresos/Gastos: dot + label + monto, barra debajo. **Anchos**: la serie mayor entre `totalIncome` y `totalExpense` ocupa 100%; la otra escala proporcional (`min/max`); ambos cero → barras vacías. Nunca hardcodeado.
- Strip USD: chip "USD" + neto USD con signo/color + "Ingresos US$X · Gastos US$Y". Se muestra siempre (bimoneda por defecto; con cero actividad muestra ceros, coherente con el hero).

`MonthBalanceChart` y su story dejan de usarse en web y **se eliminan** (el chart sigue existiendo en mobile, que no se toca). El `MonthNavigator` sale de esta card (vive en el header, D1); título y cuerpo quedan, el skeleton se actualiza a la nueva anatomía (neto + 2 filas con barra + strip).

### D4 — "En qué se fue": componente nuevo lean, dona SVG, colores de DB

Nueva sección `SpendingSection` (reemplaza `CategoryTeaser` en web):

- Datos: `getMonthCategoryBreakdown` + `buildCategorySlices` de `@grana/money-logic` con `topN: 5` y bucket "Otros" (el handoff muestra 5 tramos; el cálculo nunca se duplica).
- **Dona**: componente SVG propio (`spending-donut.tsx`) con la técnica de strokes circulares de `AnimatedDonut` (`category-spending-overview.tsx`) pero sin drill ni animación de hijos — los tramos se derivan de `slice.percentage`. No se usa `conic-gradient` CSS: el idioma del codebase para donas es SVG. Centro: "GASTOS" + total del mes (enmascarable).
- **Colores**: cada tramo usa `slice.color` (color de la categoría en DB) con fallback posicional a la paleta `--cat-*`, **igual que el desglose de Movimientos** — la misma categoría debe verse del mismo color en ambas pantallas. Los hex de la dona del handoff son ilustrativos.
- **Toggle ARS/USD**: primitiva `Segmented` existente; estado local del componente. El breakdown ya viene con ambas monedas en una llamada, el toggle no refetchea.
- Leyenda: dot + nombre + monto (`MaskedAmount`) + porcentaje. Labels traducidos vía `translateCategoryLabel` (igual que el teaser actual). Cada fila linkea al desglose de Movimientos filtrado por categoría (`/transactions?...`, mismos hrefs que usa el overview).
- Sin gastos en el mes/moneda: estado vacío neutral dentro de la card (la card no desaparece — ahora es una sección principal, no un teaser condicional).
- Mes seleccionado ≠ actual → fetch vía `getMonthCategoryBreakdownAction` con skeleton in-card (mismo patrón que D3).

### D5 — Header: saludo + neto del mes en curso + controles

`DashboardHeader` (client, ya existe) incorpora: el subtítulo pasa a "{fecha} · vas **{neto}** este mes" y a la derecha se suman `MonthNavigator` (D1) + eye + "Nuevo movimiento" (desktop only, sin cambios). El neto del subtítulo es **siempre el mes actual** (no sigue al selector — es contexto de "hoy", como "Para gastar") y refiere al neto ARS. Se obtiene con un fetch client-side liviano (`fetchMonthBalanceSeries(currentYear, currentMonth)` ya existe); mientras no resuelve o si falla, el subtítulo muestra solo la fecha (sin placeholder que cause shift — el monto aparece appendeado al resolver, shift de texto inline aceptado). El neto respeta el eye-mask.

*Alternativa:* pasarlo como prop server-side. Descartada: el header renderiza desde el primer paint sin esperar queries (requirement existente) y ya resuelve el nombre client-side.

### D6 — Bajas en web: "Lo que viene" y welcome card

`page.tsx`/`dashboard-content.tsx` dejan de montar `UpcomingFortnightSectionContainer` y `WelcomeFirstMoveCardContainer`. Los componentes web de upcoming/welcome (`upcoming-*`, `welcome-*`) **se eliminan** de `apps/web` — la spec post-archive ya no los exige en web y el código muerto contradice "el repo es la memoria". Las queries (`getUpcomingFortnight`, `hasUserMovements`, `buildUpcomingFortnight`, `UpcomingItem*`) permanecen en `@grana/dashboard` porque mobile las consume.

### D7 — Tokens nuevos en `@grana/ui-tokens`

El handoff usa ámbar (`#E79A2B`) y rosa (`#C95C86`) que no existen en el theme. Se agregan como extensión de la paleta de categorías (`--cat-6: ámbar`, `--cat-7: rosa`, con sus `--color-*` en `@theme inline`), valores ajustados a la familia tonal existente. Todos los demás colores del handoff se mapean a tokens existentes: navy → `--navy`/`surface-dark`, emerald `#11B981` → `--emerald #10B981`, terracota `#C2705C` → `--terracotta #B56A5A`, slate → `--slate`, violeta → `--account-violet`, bordes/fondos/textos → neutrals del theme. No se introducen hex inline en componentes.

### D8 — i18n

Keys nuevas bajo `dashboard.*` en `@grana/i18n-messages` (es + en): eyebrow/caption de "Para gastar", título/strip de "Dónde está", "vas {amount} este mes", labels de "En qué se fue" (título, GASTOS, vacío). Keys de upcoming/welcome quedan (mobile las usa).

## Risks / Trade-offs

- **[Divergencia web/mobile crece]** Mobile queda con Hero viejo + "Lo que viene" + chart. → Aceptado explícitamente (paridad mobile = módulo aparte, precedente: cards). Las specs quedan tagged por plataforma para que la deuda sea visible.
- **[Doble fetch del balance del mes actual]** El header (D5) y la sección Balance piden el mismo mes al montar. → Aceptado: la query es liviana y los seams son independientes; unificarlos acoplaría el header (client, primer paint) al streaming de la sección. Si molesta, se optimiza después con cache del action.
- **[Card "Dónde está" con muchas cuentas]** Altura de la fila superior dispareja. → Truncado a 6 cuentas + "Ver todas" (D2); `align-items: stretch` + `margin-top:auto` en el caption del hero absorben diferencias menores.
- **[Eliminar componentes web de upcoming/welcome]** Si producto los quiere de vuelta, es un revert de git. → Riesgo bajo; decisión de producto registrada en el proposal.
- **[Dona con >5 categorías]** El bucket "Otros" esconde detalle. → Es teaser navegable: el detalle completo vive en Movimientos, cada fila linkea.

## Open Questions

(ninguna — decisiones de producto ya tomadas: fidelidad estricta al handoff, shell intacto, web only)
